import {
  getMarkdownText,
  MARKDOWN_FALLBACK_TEXT,
  parseMarkdown,
} from './parseMarkdown';

describe('getMarkdownText', () => {
  it('returns empty string for non-string input', () => {
    expect(getMarkdownText(undefined)).toBe('');
    expect(getMarkdownText(null)).toBe('');
    expect(getMarkdownText(42)).toBe('');
  });

  it('truncates text beyond the max length', () => {
    const long = 'a'.repeat(20_001);
    const result = getMarkdownText(long);
    expect(result.length).toBe(20_000);
    expect(result.endsWith('\n…')).toBe(true);
  });
});

describe('parseMarkdown', () => {
  it('falls back for empty or blank input', () => {
    for (const input of ['', '   \n  ', undefined, null, 42]) {
      const result = parseMarkdown(input);
      expect(result.success).toBe(false);
      expect(result.blocks).toEqual([
        { type: 'paragraph', text: MARKDOWN_FALLBACK_TEXT },
      ]);
    }
  });

  it('parses headings of all levels', () => {
    const result = parseMarkdown(
      '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6',
    );
    expect(result.success).toBe(true);
    expect(result.blocks).toEqual([
      { type: 'heading', level: 1, text: 'H1' },
      { type: 'heading', level: 2, text: 'H2' },
      { type: 'heading', level: 3, text: 'H3' },
      { type: 'heading', level: 4, text: 'H4' },
      { type: 'heading', level: 5, text: 'H5' },
      { type: 'heading', level: 6, text: 'H6' },
    ]);
  });

  it('requires a space after # and allows up to 3 leading spaces', () => {
    const result = parseMarkdown('#Nope\n  ## Ok');
    expect(result.blocks).toEqual([
      { type: 'paragraph', text: '#Nope' },
      { type: 'heading', level: 2, text: 'Ok' },
    ]);
  });

  it('parses unordered list items into one list', () => {
    const result = parseMarkdown('- a\n* b\n+ c');
    expect(result.blocks).toEqual([
      {
        type: 'list',
        ordered: false,
        items: [
          { text: 'a', order: 0 },
          { text: 'b', order: 0 },
          { text: 'c', order: 0 },
        ],
      },
    ]);
  });

  it('parses ordered list items with explicit numbers', () => {
    const result = parseMarkdown('1. a\n2. b\n10. c');
    expect(result.blocks).toEqual([
      {
        type: 'list',
        ordered: true,
        items: [
          { text: 'a', order: 1 },
          { text: 'b', order: 2 },
          { text: 'c', order: 10 },
        ],
      },
    ]);
  });

  it('splits adjacent lists of different types and around paragraphs', () => {
    const result = parseMarkdown('- a\n1. b\ntext\n2. c');
    expect(result.blocks).toEqual([
      { type: 'list', ordered: false, items: [{ text: 'a', order: 0 }] },
      { type: 'list', ordered: true, items: [{ text: 'b', order: 1 }] },
      { type: 'paragraph', text: 'text' },
      { type: 'list', ordered: true, items: [{ text: 'c', order: 2 }] },
    ]);
  });

  it('keeps raw html and other markdown as literal paragraph text', () => {
    const result = parseMarkdown('<b>bold</b> and **strong**');
    expect(result.blocks).toEqual([
      { type: 'paragraph', text: '<b>bold</b> and **strong**' },
    ]);
  });

  it('preserves empty lines as empty paragraphs', () => {
    const result = parseMarkdown('first\n\nsecond');
    expect(result.blocks).toEqual([
      { type: 'paragraph', text: 'first' },
      { type: 'paragraph', text: '' },
      { type: 'paragraph', text: 'second' },
    ]);
  });

  it('stops after the max line count with an ellipsis paragraph', () => {
    const text = Array.from({ length: 600 }, (_, i) => `line ${i}`).join('\n');
    const result = parseMarkdown(text);
    expect(result.success).toBe(true);
    expect(result.blocks).toHaveLength(501);
    expect(result.blocks[500]).toEqual({ type: 'paragraph', text: '…' });
  });
});
