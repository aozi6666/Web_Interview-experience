export function getBlockCompressedExpectedSize(width: number, height: number, bytesPerBlock: number): number {
  return Math.ceil(width / 4) * Math.ceil(height / 4) * bytesPerBlock;
}

export function rgb565toRGB(c: number): [number, number, number] {
  const r = (c >> 11) & 0x1F;
  const g = (c >> 5) & 0x3F;
  const b = c & 0x1F;
  return [
    (r << 3) | (r >> 2),
    (g << 2) | (g >> 4),
    (b << 3) | (b >> 2),
  ];
}

export function decodeDXT5(data: Uint8Array, width: number, height: number): Uint8Array {
  const blocksX = Math.ceil(width / 4);
  const blocksY = Math.ceil(height / 4);
  const rgba = new Uint8Array(width * height * 4);
  let pos = 0;

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const alpha0 = data[pos];
      const alpha1 = data[pos + 1];
      let alphaBits = 0;
      for (let i = 0; i < 6; i++) {
        alphaBits += data[pos + 2 + i] * (2 ** (i * 8));
      }
      pos += 8;
      const alphaTable = new Uint8Array(8);
      alphaTable[0] = alpha0;
      alphaTable[1] = alpha1;
      if (alpha0 > alpha1) {
        alphaTable[2] = Math.floor((6 * alpha0 + alpha1) / 7);
        alphaTable[3] = Math.floor((5 * alpha0 + 2 * alpha1) / 7);
        alphaTable[4] = Math.floor((4 * alpha0 + 3 * alpha1) / 7);
        alphaTable[5] = Math.floor((3 * alpha0 + 4 * alpha1) / 7);
        alphaTable[6] = Math.floor((2 * alpha0 + 5 * alpha1) / 7);
        alphaTable[7] = Math.floor((alpha0 + 6 * alpha1) / 7);
      } else {
        alphaTable[2] = Math.floor((4 * alpha0 + alpha1) / 5);
        alphaTable[3] = Math.floor((3 * alpha0 + 2 * alpha1) / 5);
        alphaTable[4] = Math.floor((2 * alpha0 + 3 * alpha1) / 5);
        alphaTable[5] = Math.floor((alpha0 + 4 * alpha1) / 5);
        alphaTable[6] = 0;
        alphaTable[7] = 255;
      }

      const c0raw = data[pos] | (data[pos + 1] << 8);
      const c1raw = data[pos + 2] | (data[pos + 3] << 8);
      const colorBits = data[pos + 4] | (data[pos + 5] << 8) | (data[pos + 6] << 16) | ((data[pos + 7] << 24) >>> 0);
      pos += 8;
      const c0 = rgb565toRGB(c0raw);
      const c1 = rgb565toRGB(c1raw);
      const colors: [number, number, number][] = [c0, c1, [0, 0, 0], [0, 0, 0]];
      colors[2] = [
        Math.floor((2 * c0[0] + c1[0]) / 3),
        Math.floor((2 * c0[1] + c1[1]) / 3),
        Math.floor((2 * c0[2] + c1[2]) / 3),
      ];
      colors[3] = [
        Math.floor((c0[0] + 2 * c1[0]) / 3),
        Math.floor((c0[1] + 2 * c1[1]) / 3),
        Math.floor((c0[2] + 2 * c1[2]) / 3),
      ];
      for (let py = 0; py < 4; py++) {
        for (let px = 0; px < 4; px++) {
          const x = bx * 4 + px;
          const y = by * 4 + py;
          if (x >= width || y >= height) continue;
          const pixelIdx = py * 4 + px;
          const colorIdx = (colorBits >> (pixelIdx * 2)) & 0x03;
          const alphaIdx = Math.floor(alphaBits / (2 ** (pixelIdx * 3))) & 0x07;
          const outOff = (y * width + x) * 4;
          rgba[outOff] = colors[colorIdx][0];
          rgba[outOff + 1] = colors[colorIdx][1];
          rgba[outOff + 2] = colors[colorIdx][2];
          rgba[outOff + 3] = alphaTable[alphaIdx];
        }
      }
    }
  }
  return rgba;
}

export function decodeDXT5Downsampled(
  data: Uint8Array, width: number, height: number, step: number = 1,
): { data: Uint8Array; width: number; height: number } {
  const blocksX = Math.ceil(width / 4);
  const blocksY = Math.ceil(height / 4);
  const outW = Math.ceil(blocksX / step);
  const outH = Math.ceil(blocksY / step);
  const rgba = new Uint8Array(outW * outH * 4);
  const REP_IDX = 5;
  for (let oby = 0; oby < outH; oby++) {
    const by = oby * step;
    for (let obx = 0; obx < outW; obx++) {
      const bx = obx * step;
      const pos = (by * blocksX + bx) * 16;
      const a0 = data[pos];
      const a1 = data[pos + 1];
      let alphaBits = 0;
      for (let i = 0; i < 6; i++) {
        alphaBits += data[pos + 2 + i] * (2 ** (i * 8));
      }
      const aIdx = Math.floor(alphaBits / (2 ** (REP_IDX * 3))) & 0x07;
      let alpha: number;
      if (aIdx === 0) alpha = a0;
      else if (aIdx === 1) alpha = a1;
      else if (a0 > a1) alpha = Math.floor(((7 - aIdx) * a0 + (aIdx - 1) * a1) / 7 + 0.5);
      else if (aIdx <= 5) alpha = Math.floor(((5 - (aIdx - 2)) * a0 + (aIdx - 2) * a1) / 5 + 0.5);
      else alpha = aIdx === 6 ? 0 : 255;

      const c0raw = data[pos + 8] | (data[pos + 9] << 8);
      const c1raw = data[pos + 10] | (data[pos + 11] << 8);
      const colorBits = data[pos + 12] | (data[pos + 13] << 8) | (data[pos + 14] << 16) | ((data[pos + 15] << 24) >>> 0);
      const c0 = rgb565toRGB(c0raw);
      const c1 = rgb565toRGB(c1raw);
      const cIdx = (colorBits >> (REP_IDX * 2)) & 0x03;
      let r: number;
      let g: number;
      let b: number;
      if (cIdx === 0) { r = c0[0]; g = c0[1]; b = c0[2]; }
      else if (cIdx === 1) { r = c1[0]; g = c1[1]; b = c1[2]; }
      else if (cIdx === 2) {
        r = Math.floor((2 * c0[0] + c1[0]) / 3);
        g = Math.floor((2 * c0[1] + c1[1]) / 3);
        b = Math.floor((2 * c0[2] + c1[2]) / 3);
      } else {
        r = Math.floor((c0[0] + 2 * c1[0]) / 3);
        g = Math.floor((c0[1] + 2 * c1[1]) / 3);
        b = Math.floor((c0[2] + 2 * c1[2]) / 3);
      }
      const outOff = (oby * outW + obx) * 4;
      rgba[outOff] = r;
      rgba[outOff + 1] = g;
      rgba[outOff + 2] = b;
      rgba[outOff + 3] = alpha;
    }
  }
  return { data: rgba, width: outW, height: outH };
}

export function decodeDXT1Downsampled(
  data: Uint8Array, width: number, height: number, step: number = 1,
): { data: Uint8Array; width: number; height: number } {
  const blocksX = Math.ceil(width / 4);
  const blocksY = Math.ceil(height / 4);
  const outW = Math.ceil(blocksX / step);
  const outH = Math.ceil(blocksY / step);
  const rgba = new Uint8Array(outW * outH * 4);
  const REP_IDX = 5;
  for (let oby = 0; oby < outH; oby++) {
    const by = oby * step;
    for (let obx = 0; obx < outW; obx++) {
      const bx = obx * step;
      const pos = (by * blocksX + bx) * 8;
      const c0raw = data[pos] | (data[pos + 1] << 8);
      const c1raw = data[pos + 2] | (data[pos + 3] << 8);
      const colorBits = data[pos + 4] | (data[pos + 5] << 8) | (data[pos + 6] << 16) | ((data[pos + 7] << 24) >>> 0);
      const c0 = rgb565toRGB(c0raw);
      const c1 = rgb565toRGB(c1raw);
      const cIdx = (colorBits >> (REP_IDX * 2)) & 0x03;
      let r: number;
      let g: number;
      let b: number;
      let a: number;
      if (cIdx === 0) { r = c0[0]; g = c0[1]; b = c0[2]; a = 255; }
      else if (cIdx === 1) { r = c1[0]; g = c1[1]; b = c1[2]; a = 255; }
      else if (c0raw > c1raw) {
        if (cIdx === 2) {
          r = Math.floor((2 * c0[0] + c1[0]) / 3);
          g = Math.floor((2 * c0[1] + c1[1]) / 3);
          b = Math.floor((2 * c0[2] + c1[2]) / 3);
        } else {
          r = Math.floor((c0[0] + 2 * c1[0]) / 3);
          g = Math.floor((c0[1] + 2 * c1[1]) / 3);
          b = Math.floor((c0[2] + 2 * c1[2]) / 3);
        }
        a = 255;
      } else if (cIdx === 2) {
        r = Math.floor((c0[0] + c1[0]) / 2);
        g = Math.floor((c0[1] + c1[1]) / 2);
        b = Math.floor((c0[2] + c1[2]) / 2);
        a = 255;
      } else {
        r = 0; g = 0; b = 0; a = 0;
      }
      const outOff = (oby * outW + obx) * 4;
      rgba[outOff] = r;
      rgba[outOff + 1] = g;
      rgba[outOff + 2] = b;
      rgba[outOff + 3] = a;
    }
  }
  return { data: rgba, width: outW, height: outH };
}

export function decodeDXT1(data: Uint8Array, width: number, height: number): Uint8Array {
  const blocksX = Math.ceil(width / 4);
  const blocksY = Math.ceil(height / 4);
  const rgba = new Uint8Array(width * height * 4);
  let pos = 0;
  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const c0raw = data[pos] | (data[pos + 1] << 8);
      const c1raw = data[pos + 2] | (data[pos + 3] << 8);
      const colorBits = data[pos + 4] | (data[pos + 5] << 8) | (data[pos + 6] << 16) | ((data[pos + 7] << 24) >>> 0);
      pos += 8;
      const c0 = rgb565toRGB(c0raw);
      const c1 = rgb565toRGB(c1raw);
      const colors: [number, number, number, number][] = [
        [...c0, 255],
        [...c1, 255],
        [0, 0, 0, 255],
        [0, 0, 0, 255],
      ];
      if (c0raw > c1raw) {
        colors[2] = [Math.floor((2 * c0[0] + c1[0]) / 3), Math.floor((2 * c0[1] + c1[1]) / 3), Math.floor((2 * c0[2] + c1[2]) / 3), 255];
        colors[3] = [Math.floor((c0[0] + 2 * c1[0]) / 3), Math.floor((c0[1] + 2 * c1[1]) / 3), Math.floor((c0[2] + 2 * c1[2]) / 3), 255];
      } else {
        colors[2] = [Math.floor((c0[0] + c1[0]) / 2), Math.floor((c0[1] + c1[1]) / 2), Math.floor((c0[2] + c1[2]) / 2), 255];
        colors[3] = [0, 0, 0, 0];
      }
      for (let py = 0; py < 4; py++) {
        for (let px = 0; px < 4; px++) {
          const x = bx * 4 + px;
          const y = by * 4 + py;
          if (x >= width || y >= height) continue;
          const pixelIdx = py * 4 + px;
          const colorIdx = (colorBits >> (pixelIdx * 2)) & 0x03;
          const outOff = (y * width + x) * 4;
          rgba[outOff] = colors[colorIdx][0];
          rgba[outOff + 1] = colors[colorIdx][1];
          rgba[outOff + 2] = colors[colorIdx][2];
          rgba[outOff + 3] = colors[colorIdx][3];
        }
      }
    }
  }
  return rgba;
}
