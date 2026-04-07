export function normalizePreprocessorWhitespace(source: string): string {
  return source.replace(/[ \t]+$/gm, '');
}

interface PreprocessorState {
  parentActive: boolean;
  branchTaken: boolean;
  active: boolean;
}

export function evalPreprocessorExpr(expr: string, defines: Record<string, number>): boolean {
  expr = expr.replace(/\/\/.*$/, '').replace(/;+$/, '').trim();
  while (expr.startsWith('(') && expr.endsWith(')')) {
    let depth = 0;
    let isWrapped = true;
    for (let i = 0; i < expr.length - 1; i++) {
      if (expr[i] === '(') depth++;
      else if (expr[i] === ')') depth--;
      if (depth === 0) { isWrapped = false; break; }
    }
    if (isWrapped) expr = expr.slice(1, -1).trim();
    else break;
  }
  {
    let depth = 0;
    for (let i = 0; i < expr.length; i++) {
      if (expr[i] === '(') depth++;
      else if (expr[i] === ')') depth--;
      if (depth === 0 && expr.slice(i, i + 2) === '||') {
        const left = expr.slice(0, i);
        const right = expr.slice(i + 2);
        return evalPreprocessorExpr(left, defines) || evalPreprocessorExpr(right, defines);
      }
    }
  }
  {
    let depth = 0;
    for (let i = 0; i < expr.length; i++) {
      if (expr[i] === '(') depth++;
      else if (expr[i] === ')') depth--;
      if (depth === 0 && expr.slice(i, i + 2) === '&&') {
        const left = expr.slice(0, i);
        const right = expr.slice(i + 2);
        return evalPreprocessorExpr(left, defines) && evalPreprocessorExpr(right, defines);
      }
    }
  }
  if (expr.startsWith('!')) {
    return !evalPreprocessorExpr(expr.slice(1), defines);
  }
  const compMatch = expr.match(/^(\w+)\s*(==|!=|>=|<=|>|<)\s*(\w+)$/);
  if (compMatch) {
    const leftName = compMatch[1];
    const rightName = compMatch[3];
    const left = leftName in defines ? defines[leftName] : (parseInt(leftName, 10) || 0);
    const right = rightName in defines ? defines[rightName] : (parseInt(rightName, 10) || 0);
    switch (compMatch[2]) {
      case '==': return left === right;
      case '!=': return left !== right;
      case '>=': return left >= right;
      case '<=': return left <= right;
      case '>': return left > right;
      case '<': return left < right;
    }
  }
  const definedMatch = expr.match(/^defined\s*\(\s*(\w+)\s*\)$/);
  if (definedMatch) {
    return definedMatch[1] in defines;
  }
  if (expr in defines) return defines[expr] !== 0;
  const intVal = parseInt(expr, 10);
  if (!isNaN(intVal)) return intVal !== 0;
  return false;
}

export function preprocessShader(source: string, defines: Record<string, number>): string {
  const localDefines = { ...defines };
  const stack: PreprocessorState[] = [
    { parentActive: true, branchTaken: true, active: true },
  ];
  const lines = source.split('\n');
  const result: string[] = [];
  function isActive(): boolean {
    return stack[stack.length - 1].active;
  }
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('// [COMBO]')) continue;
    const defineMatch = trimmed.match(/^#define\s+(\w+)\s+(.*)/);
    if (defineMatch && isActive()) {
      const name = defineMatch[1];
      const value = defineMatch[2].trim();
      localDefines[name] = parseInt(value, 10) || 0;
      result.push(line);
      continue;
    }
    const ifMatch = trimmed.match(/^#if\s+(.+)/);
    if (ifMatch) {
      const parentActive = isActive();
      const exprTrue = parentActive && evalPreprocessorExpr(ifMatch[1], localDefines);
      stack.push({ parentActive, branchTaken: exprTrue, active: exprTrue });
      continue;
    }
    const ifdefMatch = trimmed.match(/^#ifdef\s+(\w+)/);
    if (ifdefMatch) {
      const parentActive = isActive();
      const defined = parentActive && (ifdefMatch[1] in localDefines);
      stack.push({ parentActive, branchTaken: defined, active: defined });
      continue;
    }
    const ifndefMatch = trimmed.match(/^#ifndef\s+(\w+)/);
    if (ifndefMatch) {
      const parentActive = isActive();
      const notDefined = parentActive && !(ifndefMatch[1] in localDefines);
      stack.push({ parentActive, branchTaken: notDefined, active: notDefined });
      continue;
    }
    const elifMatch = trimmed.match(/^#elif\s+(.+)/);
    if (elifMatch) {
      const state = stack[stack.length - 1];
      if (state.parentActive && !state.branchTaken) {
        const exprTrue = evalPreprocessorExpr(elifMatch[1], localDefines);
        state.active = exprTrue;
        if (exprTrue) state.branchTaken = true;
      } else {
        state.active = false;
      }
      continue;
    }
    if (/^#else\b/.test(trimmed)) {
      const state = stack[stack.length - 1];
      if (state.parentActive && !state.branchTaken) {
        state.active = true;
        state.branchTaken = true;
      } else {
        state.active = false;
      }
      continue;
    }
    if (/^#endif\b/.test(trimmed)) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (isActive()) {
      result.push(line);
    }
  }
  return result.join('\n');
}
