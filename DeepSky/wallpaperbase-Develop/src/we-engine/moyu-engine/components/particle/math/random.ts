export function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randSignedRange(halfRange: number): number {
  return (Math.random() * 2 - 1) * halfRange;
}

export function randPowRange(min: number, max: number, exponent: number): number {
  return min + Math.pow(Math.random(), exponent) * (max - min);
}

export function randInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  return Math.floor(Math.random() * maxExclusive);
}
