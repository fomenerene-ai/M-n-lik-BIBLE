/**
 * Server-sent events parser for the Messages API stream. Pure.
 */

/**
 * Creates a parser. Feed it decoded text chunks; it calls onEvent(type, data) for each complete event.
 * @param {(type: string, data: any) => void} onEvent
 * @returns {{feed: (chunk: string) => void, end: () => void}}
 */
export function createSseParser(onEvent) {
  let buf = '';
  let type = 'message';
  let data = [];
  const dispatch = () => {
    if (!data.length) { type = 'message'; return; }
    const raw = data.join('\n');
    data = [];
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = raw; }
    onEvent(type, parsed);
    type = 'message';
  };
  const line = (l) => {
    if (l === '') { dispatch(); return; }
    if (l.startsWith(':')) return;
    const i = l.indexOf(':');
    const field = i < 0 ? l : l.slice(0, i);
    const value = i < 0 ? '' : l.slice(i + 1).replace(/^ /, '');
    if (field === 'event') type = value;
    else if (field === 'data') data.push(value);
  };
  return {
    feed(chunk) {
      buf += chunk;
      let idx;
      while ((idx = buf.search(/\r\n|\n|\r/)) >= 0) {
        const nl = buf[idx] === '\r' && buf[idx + 1] === '\n' ? 2 : 1;
        line(buf.slice(0, idx));
        buf = buf.slice(idx + nl);
      }
    },
    end() { if (buf) line(buf); buf = ''; dispatch(); },
  };
}
