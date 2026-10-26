const MAX_MARKDOWN_LENGTH = 20_000;
const MAX_MARKDOWN_LINES = 500;

export const MARKDOWN_FALLBACK_TEXT =
  'Fixed some bugs and optimized user experience';

export type MarkdownListItem = {
  text: string;
  /** 1-based number shown before the item in ordered lists. */
  order: number;
};

export type MarkdownBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: MarkdownListItem[] };

export type MarkdownParseResult = {
  blocks: MarkdownBlock[];
  success: boolean;
};

const FALLBACK_RESULT: MarkdownParseResult = {
  blocks: [{ type: 'paragraph', text: MARKDOWN_FALLBACK_TEXT }],
  success: false,
};

export function getMarkdownText(text: unknown): string {
  if (typeof text !== 'string') {
    return '';
  }
  return text.length > MAX_MARKDOWN_LENGTH
    ? `${text.slice(0, MAX_MARKDOWN_LENGTH - 2)}\n…`
    : text;
}

/** Only render headings and flat lists; all other content stays literal text. */
export function parseMarkdown(text: unknown): MarkdownParseResult {
  try {
    const safeText = getMarkdownText(text);
    if (!safeText.trim()) {
      return FALLBACK_RESULT;
    }
    return { blocks: renderMarkdown(safeText), success: true };
  } catch {
    return FALLBACK_RESULT;
  }
}

function renderMarkdown(text: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let list: Extract<MarkdownBlock, { type: 'list' }> | null = null;

  const closeList = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };

  const lines = text.split(/\r\n|\r|\n/);
  for (const [index, line] of lines.entries()) {
    if (index >= MAX_MARKDOWN_LINES) {
      closeList();
      blocks.push({ type: 'paragraph', text: '…' });
      break;
    }
    const heading = line.match(/^ {0,3}(#{1,6})[\t ]+(.*)$/);
    const listItem = line.match(/^ {0,3}(?:([-+*])|(\d{1,9})[.)])[\t ]+(.*)$/);

    if (heading?.[1] && heading[2] !== undefined) {
      closeList();
      blocks.push({
        type: 'heading',
        level: heading[1].length,
        text: heading[2],
      });
    } else if (listItem && listItem[3] !== undefined) {
      const ordered = !listItem[1];
      if (!list || list.ordered !== ordered) {
        closeList();
        list = { type: 'list', ordered, items: [] };
      }
      // The numeric marker comes only from the digits matched above.
      list.items.push({
        text: listItem[3],
        order: listItem[2] ? Number(listItem[2]) : 0,
      });
    } else {
      closeList();
      blocks.push({ type: 'paragraph', text: line });
    }
  }

  closeList();
  return blocks;
}
