export function extractShaderErrorLines(log: string): number[] {
  const lines = new Set<number>();
  const pattern = /ERROR:\s*\d+:(\d+):/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(log)) !== null) {
    const lineNum = Number(m[1]);
    if (!Number.isNaN(lineNum) && lineNum > 0) {
      lines.add(lineNum);
    }
  }
  return Array.from(lines).sort((a, b) => a - b);
}

export function logShaderErrorContext(tag: string, source: string, log: string, radius = 2): void {
  if (!source || !log) return;
  const errorLines = extractShaderErrorLines(log);
  if (errorLines.length === 0) return;

  const srcLines = source.split('\n');
  for (const lineNo of errorLines) {
    const from = Math.max(1, lineNo - radius);
    const to = Math.min(srcLines.length, lineNo + radius);
    const snippet: string[] = [];
    for (let i = from; i <= to; i++) {
      const marker = i === lineNo ? '>>' : '  ';
      snippet.push(`${marker} ${i.toString().padStart(4, ' ')}| ${srcLines[i - 1]}`);
    }
    console.error(`${tag} 错误行上下文(${lineNo}):\n${snippet.join('\n')}`);
  }
}

export function isVerboseShaderLogsEnabled(): boolean {
  try {
    if (typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('we_shader_verbose') === '1') return true;
    }
  } catch {
    // ignore URL parse errors
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem('we_shader_verbose') === '1';
    }
  } catch {
    // ignore storage access errors
  }

  return false;
}
