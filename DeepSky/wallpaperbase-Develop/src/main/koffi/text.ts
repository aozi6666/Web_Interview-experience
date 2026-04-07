/**
 * 将 JavaScript 字符串转换为 Windows API 所需的 UTF-16LE 宽字符 Buffer。
 */
export function TEXT(text: string): Buffer {
  return Buffer.from(`${text}\0`, 'ucs2');
}
