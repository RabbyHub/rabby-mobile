const MAX_MARKDOWN_LENGTH = 20_000;
const MAX_MARKDOWN_LINES = 500;

export const MARKDOWN_FALLBACK_TEXT =
  'Fixed some bugs and optimized user experience';

export type MarkdownParseResult = {
  html: string;
  success: boolean;
};

const FALLBACK_RESULT: MarkdownParseResult = {
  html: `<p>${MARKDOWN_FALLBACK_TEXT}</p>`,
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Only render headings and flat lists; all other content stays literal text. */
export function parseMarkdown(text: unknown): MarkdownParseResult {
  try {
    const safeText = getMarkdownText(text);
    if (!safeText.trim()) {
      return FALLBACK_RESULT;
    }
    return { html: renderMarkdown(safeText), success: true };
  } catch {
    return FALLBACK_RESULT;
  }
}

function renderMarkdown(text: string): string {
  const html: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };

  const lines = text.split(/\r\n|\r|\n/);
  for (const [index, line] of lines.entries()) {
    if (index >= MAX_MARKDOWN_LINES) {
      closeList();
      html.push('<p>…</p>');
      break;
    }
    const heading = line.match(/^ {0,3}(#{1,6})[\t ]+(.*)$/);
    const listItem = line.match(/^ {0,3}(?:([-+*])|(\d{1,9})[.)])[\t ]+(.*)$/);

    if (heading?.[1] && heading[2] !== undefined) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${escapeHtml(heading[2])}</h${level}>`);
    } else if (listItem && listItem[3] !== undefined) {
      const nextListType = listItem[1] ? 'ul' : 'ol';
      if (listType !== nextListType) {
        closeList();
        listType = nextListType;
        html.push(`<${listType}>`);
      }
      // The numeric marker comes only from the digits matched above.
      const value = listItem[2] ? ` value="${Number(listItem[2])}"` : '';
      html.push(`<li${value}>${escapeHtml(listItem[3])}</li>`);
    } else {
      closeList();
      html.push(`<p>${escapeHtml(line) || '<br>'}</p>`);
    }
  }

  closeList();
  return html.join('');
}
