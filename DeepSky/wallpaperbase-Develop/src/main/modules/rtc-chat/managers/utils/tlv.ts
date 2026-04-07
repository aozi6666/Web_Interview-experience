export function buildTLV(magic: string, payload: string): Buffer | null {
  if (!magic || magic.length !== 4) {
    return null;
  }
  const body = Buffer.from(payload ?? '', 'utf8');
  const buffer = Buffer.alloc(8 + body.length);
  buffer.write(magic, 0, 4, 'utf8');
  buffer.writeUInt32BE(body.length, 4);
  body.copy(buffer, 8);
  return buffer;
}

export function parseTLV(buffer: Buffer, expectedMagic: string): string | null {
  if (!buffer || buffer.length < 8) {
    return null;
  }
  const magic = buffer.slice(0, 4).toString('utf8');
  if (magic !== expectedMagic) {
    return null;
  }
  const length = buffer.readUInt32BE(4);
  if (buffer.length - 8 !== length) {
    return null;
  }
  return buffer.slice(8, 8 + length).toString('utf8');
}
