import {
  avoidSimpleLabelOverlap,
  layoutSimplePriceLabels,
} from './perps-simple-logic.ts';
import { appendSimplePriceGuide } from './perps-simple-price-guide.ts';

export type PerpsPriceTag = {
  id: string;
  price: number;
  color: string;
  background: string;
  text: string;
  /** Left title drawn on the price line; titled tags hide outside the plot. */
  title?: string;
  outline?: boolean;
  labelText?: string;
};

type PlacedTag = PerpsPriceTag & { y: number };

/**
 * Shared Simple/Pro price tags: right badges keep price order around the
 * latest badge, left titles avoid each other, and one dashed path connects
 * a displaced title, the real price and its badge.
 */
export function renderPerpsPriceTags(
  overlay: HTMLElement,
  {
    tags,
    paneHeight,
    top = 0,
    priceToCoordinate,
    priceText,
    titleOutline,
    isSelected = () => false,
    selectionColors,
    skipGuide = () => false,
  }: {
    tags: readonly PerpsPriceTag[];
    paneHeight: number;
    /** Plot area hidden by an opaque band at the top of the pane. */
    top?: number;
    priceToCoordinate: (price: number) => number | null;
    priceText: (price: number) => string;
    titleOutline: string;
    /** Selected badges float at their raw price without moving the layout. */
    isSelected?: (tag: PerpsPriceTag) => boolean;
    selectionColors?: { background?: string; text?: string };
    skipGuide?: (tag: PlacedTag) => boolean;
  },
) {
  const doc = overlay.ownerDocument;
  const visibleTags = tags
    .map(tag => ({ ...tag, y: priceToCoordinate(tag.price) }))
    .filter(
      (tag): tag is PlacedTag =>
        tag.y !== null &&
        (tag.title === undefined || (tag.y >= top && tag.y <= paneHeight)),
    );
  const layoutHeight = paneHeight - top;
  const layoutTags = visibleTags.filter(tag => tag.id !== 'selection');
  const latestIndex = layoutTags.findIndex(tag => tag.id === 'latest');
  const layoutY = layoutSimplePriceLabels(
    layoutTags.map(tag => tag.y - top),
    layoutHeight,
    latestIndex,
  );
  const tagY = visibleTags.map(tag =>
    isSelected(tag) ? tag.y : layoutY[layoutTags.indexOf(tag)] + top,
  );
  const titledTags = visibleTags.filter(tag => tag.title !== undefined);
  const titleY = avoidSimpleLabelOverlap(
    // 16px title sits 1px above its undisplaced reference line.
    titledTags.map(tag => tag.y - 9 - top),
    layoutHeight,
    18, // 16px text box plus 1px outside glyph stroke on each side.
  ).map(y => y + top);
  // Append all labels, read their actual bounds together, then draw lines.
  // No opaque full-axis row: only the 14px label covers chart content.
  const labels = visibleTags.map((tag, i) => {
    const selected = isSelected(tag);
    const label = doc.createElement('span');
    label.textContent = tag.labelText ?? priceText(tag.price);
    label.dataset.simplePriceLabel = '';
    label.dataset.priceKind = tag.id;
    Object.assign(label.style, {
      position: 'absolute',
      right: '12px',
      top: `${tagY[i] - 7}px`,
      height: '14px',
      padding: '0 3px',
      borderRadius: '4px',
      fontSize: '10px',
      lineHeight: '14px',
      fontVariantNumeric: 'tabular-nums',
      textAlign: 'right',
      color: selected ? selectionColors?.text ?? tag.text : tag.text,
      background: selected
        ? selectionColors?.background ?? tag.background
        : tag.background,
      boxShadow: tag.outline ? `inset 0 0 0 1px ${tag.color}` : 'none',
      boxSizing: 'border-box',
      whiteSpace: 'nowrap',
      zIndex: selected ? '4' : '2',
    });
    overlay.appendChild(label);
    return label;
  });
  const titles = titledTags.map((tag, i) => {
    const title = doc.createElement('span');
    // Separate stroke/fill layers preserve the glyph fill on older WebViews
    // without depending on CSS paint-order support for text.
    const outline = doc.createElement('span');
    outline.textContent = tag.title!;
    outline.setAttribute('aria-hidden', 'true');
    Object.assign(outline.style, {
      position: 'absolute',
      inset: '0',
    });
    outline.style.setProperty('-webkit-text-stroke', `2px ${titleOutline}`);
    const fill = doc.createElement('span');
    fill.textContent = tag.title!;
    fill.style.position = 'relative';
    title.append(outline, fill);
    title.dataset.simplePriceTitle = tag.id;
    Object.assign(title.style, {
      position: 'absolute',
      left: '1px', // Keep the outside stroke within the clipped plot overlay.
      top: `${titleY[i] - 8}px`,
      height: '16px',
      color: tag.color,
      fontSize: '10px',
      lineHeight: '16px',
      whiteSpace: 'nowrap',
      zIndex: '2',
    });
    overlay.appendChild(title);
    return title;
  });
  // Batch layout reads before writes. Tabular digits alone do not equalize
  // values with different digit counts (for example 99.90 and 100.10).
  const overlayWidth = overlay.getBoundingClientRect().width;
  const labelWidth = Math.max(
    0,
    ...labels.map(label => label.getBoundingClientRect().width),
  );
  const titleWidths = titles.map(title => title.getBoundingClientRect().width);
  labels.forEach(label => {
    label.style.width = `${labelWidth}px`;
  });
  const labelLeft = Math.max(0, overlayWidth - 12 - labelWidth);
  visibleTags.forEach((tag, i) => {
    const y = tag.y;
    if (y < top || y > paneHeight || skipGuide(tag)) return;
    const titleIndex = titledTags.indexOf(tag);
    const displacedTitle =
      titleIndex >= 0 && Math.abs(titleY[titleIndex] + 9 - y) > 0.5
        ? {
            right: titleWidths[titleIndex] + 2,
            bottom: titleY[titleIndex] + 9,
          }
        : undefined;
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.dataset.simplePriceLine = '';
    svg.dataset.priceKind = tag.id;
    Object.assign(svg.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: `${paneHeight}px`,
      overflow: 'hidden',
    });
    appendSimplePriceGuide(
      svg,
      {
        priceY: y,
        labelX: labelLeft,
        // Edge clamping affects the badge rectangle, never the market line.
        labelY: tag.id === 'latest' ? y : tagY[i],
        title: displacedTitle,
      },
      tag.color,
      '4 2',
    );
    overlay.appendChild(svg);
  });
  return { labelLeft };
}
