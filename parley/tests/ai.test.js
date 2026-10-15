import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createSseParser } from '../src/ai/sse.js';
import { validate, toApiSchema, parseJsonLoose } from '../src/ai/schema.js';
import { buildBody, buildHeaders, chat, chatJson, ApiError } from '../src/ai/claude.js';
import { REPORT_SCHEMA, CARD_SCHEMA, conversationSystem, SCENARIOS } from '../src/ai/prompts.js';
import { API } from '../src/config.js';

const KEY = 'test-key-not-real';

test('SSE parser handles split chunks and CRLF', () => {
  const events = [];
  const p = createSseParser((t, d) => events.push([t, d]));
  p.feed('event: content_block_delta\r\ndata: {"type":"content_block_delta","de');
  p.feed('lta":{"type":"text_delta","text":"Hi"}}\r\n\r\n: ping\n\nevent: message_stop\ndata: {"type":"message_stop"}\n');
  p.end();
  assert.deepEqual(events.map((e) => e[0]), ['content_block_delta', 'message_stop']);
  assert.equal(events[0][1].delta.text, 'Hi');
});

test('schema validation and API schema conversion', () => {
  const s = { type: 'object', properties: { n: { type: 'integer', minimum: 0, maximum: 10 }, l: { type: 'array', maxItems: 2, items: { type: 'string' } } } };
  assert.deepEqual(validate({ n: 3, l: ['a'] }, s), []);
  assert.equal(validate({ n: 11, l: ['a', 'b', 'c'] }, s).length, 2);
  assert.deepEqual(validate({ l: [] }, s), [], 'properties are required only when listed');
  assert.deepEqual(validate({}, { ...s, required: ['n'] }), ['$.n is missing']);
  const api = toApiSchema(s);
  assert.equal(api.additionalProperties, false);
  assert.deepEqual(api.required, ['n', 'l']);
  assert.equal(api.properties.n.minimum, undefined);
  assert.equal(api.properties.l.maxItems, undefined);
  const r = toApiSchema(REPORT_SCHEMA);
  assert.equal(JSON.stringify(r).includes('maxItems'), false);
  assert.equal(r.properties.recurringErrors.items.additionalProperties, false);
});

test('parseJsonLoose strips fences and prose', () => {
  assert.deepEqual(parseJsonLoose('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonLoose('Here you go: {"a": [1]} thanks'), { a: [1] });
  assert.throws(() => parseJsonLoose('nothing'));
});

test('headers and body follow the API contract', () => {
  const h = buildHeaders(KEY, true);
  assert.equal(h['x-api-key'], KEY);
  assert.equal(h['anthropic-version'], '2023-06-01');
  assert.equal(h['anthropic-dangerous-direct-browser-access'], 'true');
  assert.equal(h['anthropic-beta'], API.fallbackBeta);
  assert.equal(buildHeaders(KEY, false)['anthropic-beta'], undefined);
  const b = buildBody({ model: 'm', messages: [], maxTokens: 999999, effort: 'low', schema: CARD_SCHEMA, cache: true, fallback: true, stream: true, system: 's' });
  assert.equal(b.max_tokens, API.maxTokensCap, 'spend guard caps max_tokens');
  assert.equal(b.output_config.effort, 'low');
  assert.equal(b.output_config.format.type, 'json_schema');
  assert.equal(b.fallbacks, 'default');
  assert.deepEqual(b.cache_control, { type: 'ephemeral' });
  assert.equal(b.stream, true);
});

const realFetch = globalThis.fetch;
let calls;
function mockFetch(responses) {
  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init: { ...init, body: JSON.parse(init.body) } });
    const r = responses.shift();
    if (r instanceof Error) throw r;
    return r;
  };
}
const json = (status, obj, headers = {}) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', ...headers } });
const msg = (text, stop = 'end_turn') => json(200, { content: [{ type: 'thinking', thinking: '' }, { type: 'text', text }], stop_reason: stop, usage: {} });
beforeEach(() => { globalThis.fetch = realFetch; });

test('chat retries on 429 then succeeds', async () => {
  mockFetch([json(429, { error: { message: 'slow down' } }, { 'retry-after': '0.01' }), msg('Hello')]);
  const r = await chat({ apiKey: KEY, model: 'claude-haiku-5-5', messages: [{ role: 'user', content: 'x' }] });
  assert.equal(r.text, 'Hello');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, API.url);
});

test('chat maps 401 without leaking the key', async () => {
  mockFetch([json(401, { error: { message: `invalid x-api-key ${KEY}` } })]);
  await assert.rejects(chat({ apiKey: KEY, model: 'm', messages: [] }), (e) => e instanceof ApiError && e.kind === 'auth' && !JSON.stringify({ m: e.message, d: e.detail }).includes(KEY));
});

test('chat reports refusals and network errors', async () => {
  mockFetch([msg('', 'refusal')]);
  await assert.rejects(chat({ apiKey: KEY, model: 'm', messages: [] }), (e) => e.kind === 'refusal');
  mockFetch([new TypeError('fail'), new TypeError('fail'), new TypeError('fail'), new TypeError('fail')]);
  await assert.rejects(chat({ apiKey: KEY, model: 'm', messages: [] }), (e) => e.kind === 'network');
  assert.equal(calls.length, API.retries + 1);
});

test('chat streams text deltas and ignores thinking', async () => {
  const sse = [
    'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":5}}}\n\n',
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"hmm"}}\n\n',
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"Hi there. "}}\n\n',
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"How are you?"}}\n\n',
    'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":9}}\n\n',
  ].join('');
  mockFetch([new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } })]);
  const deltas = [];
  const r = await chat({ apiKey: KEY, model: 'm', messages: [], stream: true, onText: (d) => deltas.push(d) });
  assert.equal(r.text, 'Hi there. How are you?');
  assert.deepEqual(deltas, ['Hi there. ', 'How are you?']);
  assert.equal(r.usage.output_tokens, 9);
});

test('fallback is dropped once when the API rejects it', async () => {
  mockFetch([json(400, { error: { message: 'fallbacks: unknown beta' } }), msg('ok')]);
  const r = await chat({ apiKey: KEY, model: 'claude-sonnet-5-5', messages: [] });
  assert.equal(r.text, 'ok');
  assert.equal(calls[0].init.body.fallbacks, 'default');
  assert.equal(calls[1].init.body.fallbacks, undefined);
});

test('chatJson repairs invalid output once', async () => {
  globalThis.fetch = realFetch;
  const bad = JSON.stringify({ type: 'word', definition: 'x'.repeat(400), example: 'e' });
  const good = JSON.stringify({ type: 'word', definition: 'to use something to gain an advantage', example: 'We can leverage our network.' });
  mockFetch([msg(bad), msg(good)]);
  const v = await chatJson({ system: 's', messages: [{ role: 'user', content: 'leverage' }], schema: CARD_SCHEMA, apiKey: KEY, model: 'm' });
  assert.equal(v.type, 'word');
  assert.equal(calls.length, 2);
  assert.match(calls[1].init.body.messages[2].content, /not valid/);
});

test('conversation prompt includes persona rules', () => {
  const s = conversationSystem({ scenario: SCENARIOS[0], level: 5, lang: 'en-GB', minutes: 10 });
  assert.match(s, /Never correct the learner/);
  assert.match(s, /Never switch to French/);
  assert.match(s, /British/);
  assert.match(s, /1 to 3 short sentences/);
});
