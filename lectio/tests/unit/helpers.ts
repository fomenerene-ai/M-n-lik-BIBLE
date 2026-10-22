import { readFileSync } from 'node:fs';

export function fixture(name: string): ArrayBuffer {
  const buf = readFileSync(new URL(`../fixtures/${name}`, import.meta.url));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

export function fixtureFile(name: string, type = ''): File {
  return new File([fixture(name)], name, { type });
}
