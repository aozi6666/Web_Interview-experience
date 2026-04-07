import type { OutboundWsMessage } from '../../websocket/types';

type ParseIssueLevel = 'warn' | 'error';

export interface ParseIssue {
  level: ParseIssueLevel;
  reason: string;
  raw: string;
}

export interface ParseAiSubtitleForUeResult {
  displayText: string;
  outboundCommands: OutboundWsMessage[];
  issues: ParseIssue[];
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeMoveCommand(obj: JsonObject): OutboundWsMessage | null {
  if (obj.type !== 'moveCommand') {
    return null;
  }
  const nameFromTop = typeof obj.name === 'string' ? obj.name.trim() : '';
  const dataObj = isObject(obj.data) ? obj.data : null;
  const nameFromData =
    dataObj && typeof dataObj.name === 'string' ? dataObj.name.trim() : '';
  const name = nameFromTop || nameFromData;
  if (!name) {
    return null;
  }
  return {
    type: 'moveCommand',
    data: { name },
    msgSource: 'electron',
  };
}

function normalizePlayerState(obj: JsonObject): OutboundWsMessage | null {
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
  const actionName =
    (typeof dataObj.action === 'string' ? dataObj.action : '') ||
    (typeof dataObj.name === 'string' ? dataObj.name : '');
  const normalizedName = actionName.trim();
  if (!normalizedName) {
    return null;
  }
  return {
    type: 'action',
    data: {
      action: normalizedName,
      data: dataObj.data ?? null,
    },
    msgSource: 'electron',
  };
}

function normalizeChangeCloth(obj: JsonObject): OutboundWsMessage | null {
  if (obj.type !== 'changeCloth') {
    return null;
  }
  return {
    type: 'changeCloth',
    msgSource: 'electron',
  };
}

function normalizeEmotionAction(obj: JsonObject): OutboundWsMessage | null {
  if ('type' in obj) {
    return null;
  }
  const emotion =
    typeof obj.emotion === 'string' ? obj.emotion.trim() : undefined;
  const action = typeof obj.action === 'string' ? obj.action.trim() : undefined;
  if (!emotion && !action) {
    return null;
  }
  return {
    type: 'playerState',
    expression: { type: emotion || '' },
    action: { type: action || '' },
    msgSource: 'electron',
  };
}

function normalizeCommand(
  obj: JsonObject,
  raw: string,
  issues: ParseIssue[],
): OutboundWsMessage | null {
  const command =
    normalizeChangeCloth(obj) ||
    normalizeMoveCommand(obj) ||
    normalizePlayerState(obj) ||
    normalizeActionCommand(obj) ||
    normalizeEmotionAction(obj);

  if (!command) {
    if (typeof obj.type === 'string') {
      issues.push({
        level: 'error',
        reason: `无法识别或字段不完整的命令: ${obj.type}`,
        raw,
      });
    }
    return null;
  }

  return command;
}

export function parseAiSubtitleForUe(
  input: string,
): ParseAiSubtitleForUeResult {
  if (!input || !input.trim()) {
    return { displayText: '', outboundCommands: [], issues: [] };
  }

  const issues: ParseIssue[] = [];
  const outboundCommands: OutboundWsMessage[] = [];
  const displayText = input.replace(/\{[^{}]*\}/g, (block) => {
    try {
      const parsed: unknown = JSON.parse(block);
      if (!isObject(parsed)) {
        return block;
      }
      const command = normalizeCommand(parsed, block, issues);
      if (!command) {
        return block;
      }
      outboundCommands.push(command);
      return '';
    } catch {
      issues.push({
        level: 'warn',
        reason: 'JSON 解析失败',
        raw: block,
      });
      return block;
    }
  });

  return {
    displayText: displayText.replace(/\s{2,}/g, ' ').trim(),
    outboundCommands,
    issues,
  };
}
