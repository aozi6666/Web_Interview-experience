import type { OutboundWsMessage } from '../../websocket/types';

type JsonObject = Record<string, unknown>;

type IssueLevel = 'warn' | 'error';

export interface AiCommandParseIssue {
  level: IssueLevel;
  reason: string;
  raw: string;
}

export interface AiCommandParseResult {
  commands: OutboundWsMessage[];
  cleanText: string;
  issues: AiCommandParseIssue[];
}

function isObject(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeChangeClothCommand(
  obj: JsonObject,
): OutboundWsMessage | null {
  if (obj.type !== 'changeCloth') {
    return null;
  }
  return {
    type: 'changeCloth',
    msgSource: 'electron',
  };
}

function normalizeMoveCommand(obj: JsonObject): OutboundWsMessage | null {
  if (obj.type !== 'moveCommand') {
    return null;
  }
  const topName = typeof obj.name === 'string' ? obj.name.trim() : '';
  const dataObj = isObject(obj.data) ? obj.data : null;
  const dataName =
    dataObj && typeof dataObj.name === 'string' ? dataObj.name.trim() : '';
  const name = topName || dataName;
  if (!name) {
    return null;
  }
  return {
    type: 'moveCommand',
    data: { name },
    name,
    msgSource: 'electron',
  };
}

function normalizePlayerStateCommand(
  obj: JsonObject,
): OutboundWsMessage | null {
  if (obj.type !== 'playerState') {
    return null;
  }
  const expressionObj = isObject(obj.expression) ? obj.expression : null;
  const actionObj = isObject(obj.action) ? obj.action : null;
  const expressionType =
    expressionObj && typeof expressionObj.type === 'string'
      ? expressionObj.type.trim()
      : '';
  const actionType =
    actionObj && typeof actionObj.type === 'string'
      ? actionObj.type.trim()
      : '';
  if (!expressionType && !actionType) {
    return null;
  }
  return {
    type: 'playerState',
    expression: { type: expressionType },
    action: { type: actionType },
    msgSource: 'electron',
  };
}

function normalizeActionCommand(obj: JsonObject): OutboundWsMessage | null {
  if (obj.type !== 'action') {
    return null;
  }
  const dataObj = isObject(obj.data) ? obj.data : null;
  if (!dataObj) {
    return null;
  }
  const name =
    typeof dataObj.name === 'string'
      ? dataObj.name.trim()
      : typeof dataObj.action === 'string'
        ? dataObj.action.trim()
        : '';
  if (!name) {
    return null;
  }
  const extra = 'data' in dataObj ? dataObj.data : undefined;
  return {
    type: 'action',
    data: {
      action: name,
      name,
      data: extra,
    },
    msgSource: 'electron',
  };
}

function normalizeEmotionActionCommand(
  obj: JsonObject,
): OutboundWsMessage | null {
  if ('type' in obj) {
    return null;
  }
  const emotion =
    typeof obj.emotion === 'string' ? obj.emotion.trim() : '';
  const action = typeof obj.action === 'string' ? obj.action.trim() : '';
  if (!emotion && !action) {
    return null;
  }
  return {
    type: 'playerState',
    expression: { type: emotion },
    action: { type: action },
    msgSource: 'electron',
  };
}

function normalizeCommand(obj: JsonObject): OutboundWsMessage | null {
  return (
    normalizeChangeClothCommand(obj) ||
    normalizeMoveCommand(obj) ||
    normalizePlayerStateCommand(obj) ||
    normalizeActionCommand(obj) ||
    normalizeEmotionActionCommand(obj)
  );
}

function extractJsonBlocks(input: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let depth = 0;
  let blockStart = -1;
  let inString = false;
  let escaping = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];

    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }
      if (ch === '\\') {
        escaping = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      if (depth === 0) {
        blockStart = i;
      }
      depth += 1;
      continue;
    }

    if (ch === '}') {
      if (depth <= 0) {
        continue;
      }
      depth -= 1;
      if (depth === 0 && blockStart >= 0) {
        ranges.push({ start: blockStart, end: i + 1 });
        blockStart = -1;
      }
    }
  }

  return ranges;
}

function stripDanglingJsonTail(text: string): string {
  let depth = 0;
  let inString = false;
  let escaping = false;
  let firstDanglingStart = -1;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }
      if (ch === '\\') {
        escaping = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      if (depth === 0) {
        firstDanglingStart = i;
      }
      depth += 1;
      continue;
    }

    if (ch === '}') {
      if (depth <= 0) {
        continue;
      }
      depth -= 1;
      if (depth === 0) {
        firstDanglingStart = -1;
      }
    }
  }

  if (depth > 0 && firstDanglingStart >= 0) {
    return text.slice(0, firstDanglingStart);
  }
  return text;
}

export function stripCommandBlocksFromText(input: string): string {
  if (!input || !input.trim()) {
    return '';
  }

  const ranges = extractJsonBlocks(input);
  if (ranges.length === 0) {
    return stripDanglingJsonTail(input).replace(/\s{2,}/g, ' ').trim();
  }

  let cursor = 0;
  let cleanText = '';

  for (const range of ranges) {
    const raw = input.slice(range.start, range.end);
    cleanText += input.slice(cursor, range.start);
    cursor = range.end;

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (isObject(parsed) && normalizeCommand(parsed)) {
        continue;
      }
      cleanText += raw;
    } catch {
      cleanText += raw;
    }
  }

  cleanText += input.slice(cursor);
  return stripDanglingJsonTail(cleanText).replace(/\s{2,}/g, ' ').trim();
}

export function parseAiCommandsFromSubtitle(input: string): AiCommandParseResult {
  if (!input || !input.trim()) {
    return {
      commands: [],
      cleanText: '',
      issues: [],
    };
  }

  const issues: AiCommandParseIssue[] = [];
  const commands: OutboundWsMessage[] = [];
  const ranges = extractJsonBlocks(input);

  if (ranges.length === 0) {
    return {
      commands,
      cleanText: input.trim(),
      issues,
    };
  }

  let cursor = 0;
  let cleanText = '';
  for (const range of ranges) {
    const raw = input.slice(range.start, range.end);
    cleanText += input.slice(cursor, range.start);
    cursor = range.end;

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!isObject(parsed)) {
        cleanText += raw;
        continue;
      }
      const command = normalizeCommand(parsed);
      if (!command) {
        if (typeof parsed.type === 'string') {
          issues.push({
            level: 'error',
            reason: `不支持或字段不完整的命令: ${parsed.type}`,
            raw,
          });
        }
        cleanText += raw;
        continue;
      }
      commands.push(command);
    } catch {
      issues.push({
        level: 'warn',
        reason: 'JSON 解析失败',
        raw,
      });
      cleanText += raw;
    }
  }
  cleanText += input.slice(cursor);

  return {
    commands,
    cleanText: cleanText.replace(/\s{2,}/g, ' ').trim(),
    issues,
  };
}
