import {
  parseAiCommandsFromSubtitle,
  stripCommandBlocksFromText,
} from './aiCommandParser';

describe('parseAiCommandsFromSubtitle', () => {
  it('should split mixed subtitle text and shorthand emotion/action command', () => {
    const input = '沉住气呀😆{"emotion":"happy","action":"gesture"}';

    const result = parseAiCommandsFromSubtitle(input);

    expect(result.cleanText).toBe('沉住气呀😆');
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0]).toEqual({
      type: 'playerState',
      expression: { type: 'happy' },
      action: { type: 'gesture' },
      msgSource: 'electron',
    });
    expect(result.issues).toEqual([]);
  });

  it('should parse pure shorthand emotion/action command without subtitle text', () => {
    const input = '{"emotion":"happy","action":"gesture"}';

    const result = parseAiCommandsFromSubtitle(input);

    expect(result.cleanText).toBe('');
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0]).toEqual({
      type: 'playerState',
      expression: { type: 'happy' },
      action: { type: 'gesture' },
      msgSource: 'electron',
    });
    expect(result.issues).toEqual([]);
  });

  it('should keep unsupported json blocks in clean text', () => {
    const input = '你好{"foo":"bar"}';

    const result = parseAiCommandsFromSubtitle(input);

    expect(result.cleanText).toBe('你好{"foo":"bar"}');
    expect(result.commands).toEqual([]);
    expect(result.issues).toEqual([]);
  });
});

describe('stripCommandBlocksFromText', () => {
  it('should keep plain text untouched', () => {
    const input = '这是普通字幕';

    const result = stripCommandBlocksFromText(input);

    expect(result).toBe('这是普通字幕');
  });

  it('should remove supported command block from mixed text', () => {
    const input = '你好{"type":"moveCommand","name":"wave"}世界';

    const result = stripCommandBlocksFromText(input);

    expect(result).toBe('你好世界');
  });

  it('should remove multiple supported command blocks', () => {
    const input =
      'A{"type":"changeCloth"}B{"emotion":"happy","action":"gesture"}C';

    const result = stripCommandBlocksFromText(input);

    expect(result).toBe('ABC');
  });

  it('should trim dangling json tail in streaming subtitle', () => {
    const input = '请看这里 {"type":"moveCommand","name":"w';

    const result = stripCommandBlocksFromText(input);

    expect(result).toBe('请看这里');
  });
});
