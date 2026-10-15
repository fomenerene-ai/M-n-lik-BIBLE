/**
 * Minimal JSON schema validation for model outputs, and conversion to the subset the API accepts
 * for structured outputs. Pure.
 *
 * Supported keywords: type, properties, required, items, enum, minimum, maximum, maxItems, minItems,
 * maxLength, minLength, additionalProperties (false). Constraints the API does not support
 * (numeric and length limits) are stripped by toApiSchema and checked locally by validate.
 */

const LOCAL_ONLY = ['minimum', 'maximum', 'maxItems', 'minItems', 'maxLength', 'minLength'];

/**
 * Validates a value. Returns a list of human-readable errors (empty when valid).
 * @param {any} value
 * @param {object} schema
 * @param {string} [path]
 * @returns {string[]}
 */
export function validate(value, schema, path = '$') {
  const errs = [];
  const t = schema.type;
  const typeOk = {
    object: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
    array: Array.isArray,
    string: (v) => typeof v === 'string',
    number: (v) => typeof v === 'number' && Number.isFinite(v),
    integer: Number.isInteger,
    boolean: (v) => typeof v === 'boolean',
  };
  if (t && !typeOk[t](value)) return [`${path} should be ${t}`];
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${path} should be one of ${schema.enum.join(', ')}`);
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errs.push(`${path} should be >= ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errs.push(`${path} should be <= ${schema.maximum}`);
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errs.push(`${path} is too short`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errs.push(`${path} is too long`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errs.push(`${path} needs at least ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errs.push(`${path} has more than ${schema.maxItems} items`);
    if (schema.items) value.forEach((v, i) => errs.push(...validate(v, schema.items, `${path}[${i}]`)));
  }
  if (t === 'object') {
    for (const k of schema.required || []) if (!(k in value)) errs.push(`${path}.${k} is missing`);
    for (const [k, sub] of Object.entries(schema.properties || {})) if (k in value) errs.push(...validate(value[k], sub, `${path}.${k}`));
  }
  return errs;
}

/**
 * Returns a copy of the schema without local-only constraints, with additionalProperties: false and
 * every property required on objects, as structured outputs expect.
 * @param {object} schema
 */
export function toApiSchema(schema) {
  const out = {};
  for (const [k, v] of Object.entries(schema)) {
    if (LOCAL_ONLY.includes(k)) continue;
    if (k === 'properties') out.properties = Object.fromEntries(Object.entries(v).map(([pk, pv]) => [pk, toApiSchema(pv)]));
    else if (k === 'items') out.items = toApiSchema(v);
    else out[k] = v;
  }
  if (out.type === 'object') {
    out.additionalProperties = false;
    out.required = Object.keys(out.properties || {});
  }
  return out;
}

/**
 * Extracts JSON from model text: strips code fences and surrounding prose defensively.
 * @param {string} text
 * @returns {any}
 * @throws {SyntaxError}
 */
export function parseJsonLoose(text) {
  let t = String(text || '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  try { return JSON.parse(t); } catch { /* fall through */ }
  const start = t.search(/[[{]/);
  const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1));
  throw new SyntaxError('No JSON found in the answer');
}
