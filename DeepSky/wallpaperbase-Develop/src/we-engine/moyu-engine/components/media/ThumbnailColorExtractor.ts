import type { MediaColor, MediaThumbnailEventData } from './types';

type Rgb = [number, number, number];

function toColor(rgb: Rgb): MediaColor {
  return {
    x: rgb[0] / 255,
    y: rgb[1] / 255,
    z: rgb[2] / 255,
  };
}

function luminance(rgb: Rgb): number {
  const toLinear = (v: number): number => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = toLinear(rgb[0]);
  const g = toLinear(rgb[1]);
  const b = toLinear(rgb[2]);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

function colorDistance(a: Rgb, b: Rgb): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function pickDistinctColors(candidates: Array<{ rgb: Rgb; count: number }>): [Rgb, Rgb, Rgb] {
  const fallback: Rgb = [0, 0, 0];
  if (candidates.length === 0) return [fallback, fallback, fallback];

  const primary = candidates[0].rgb;
  const secondary = ((): Rgb => {
    let best = primary;
    let bestScore = -1;
    for (let i = 1; i < candidates.length; i += 1) {
      const c = candidates[i];
      const score = colorDistance(primary, c.rgb) * (1 + Math.log1p(c.count));
      if (score > bestScore) {
        bestScore = score;
        best = c.rgb;
      }
    }
    return best;
  })();

  const tertiary = ((): Rgb => {
    let best = secondary;
    let bestScore = -1;
    for (let i = 1; i < candidates.length; i += 1) {
      const c = candidates[i];
      const score = (
        colorDistance(primary, c.rgb)
        + colorDistance(secondary, c.rgb)
      ) * (1 + Math.log1p(c.count));
      if (score > bestScore) {
        bestScore = score;
        best = c.rgb;
      }
    }
    return best;
  })();

  return [primary, secondary, tertiary];
}

function quantizedPalette(data: Uint8ClampedArray): Array<{ rgb: Rgb; count: number }> {
  const buckets = new Map<number, { r: number; g: number; b: number; count: number }>();
  const pixelCount = Math.floor(data.length / 4);
  const stride = Math.max(1, Math.floor(pixelCount / 4096));

  for (let i = 0; i < pixelCount; i += stride) {
    const base = i * 4;
    const r = data[base];
    const g = data[base + 1];
    const b = data[base + 2];
    const a = data[base + 3];
    if (a < 24) continue;

    const qr = r >> 4;
    const qg = g >> 4;
    const qb = b >> 4;
    const key = (qr << 8) | (qg << 4) | qb;
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, count: 0 };
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  return Array.from(buckets.values())
    .filter((b) => b.count > 0)
    .map((b) => ({
      rgb: [
        Math.round(b.r / b.count),
        Math.round(b.g / b.count),
        Math.round(b.b / b.count),
      ] as Rgb,
      count: b.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 24);
}

function imageDataFromSource(source: ImageData | HTMLImageElement | HTMLCanvasElement | ImageBitmap): ImageData {
  if (source instanceof ImageData) return source;
  const canvas = document.createElement('canvas');
  const width = 'width' in source ? source.width : 1;
  const height = 'height' in source ? source.height : 1;
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new ImageData(1, 1);
  }
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export class ThumbnailColorExtractor {
  static extract(source: ImageData | HTMLImageElement | HTMLCanvasElement | ImageBitmap): MediaThumbnailEventData {
    const imageData = imageDataFromSource(source);
    const palette = quantizedPalette(imageData.data);
    const [primary, secondary, tertiary] = pickDistinctColors(palette);
    const white: Rgb = [255, 255, 255];
    const black: Rgb = [0, 0, 0];

    const textCandidates: Rgb[] = [secondary, tertiary, white, black];
    let textColor = white;
    let bestContrast = -1;
    for (const candidate of textCandidates) {
      const contrast = contrastRatio(primary, candidate);
      if (contrast > bestContrast) {
        bestContrast = contrast;
        textColor = candidate;
      }
    }

    const highContrastColor = contrastRatio(primary, white) >= contrastRatio(primary, black) ? white : black;

    return {
      hasThumbnail: true,
      primaryColor: toColor(primary),
      secondaryColor: toColor(secondary),
      tertiaryColor: toColor(tertiary),
      textColor: toColor(textColor),
      highContrastColor: toColor(highContrastColor),
    };
  }
}
