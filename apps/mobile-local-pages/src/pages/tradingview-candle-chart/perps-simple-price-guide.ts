type PriceGuide = {
  priceY: number;
  labelX: number;
  labelY: number;
  /** Present only when the left title has been displaced from its price line. */
  title?: { right: number; bottom: number };
};

const leaderWidth = (offset: number) =>
  offset === 0 ? 0 : Math.min(32, Math.max(12, Math.abs(offset)));

/** Continue the existing subpath so the dash phase does not restart. */
function curveTo(x1: number, y1: number, x2: number, y2: number) {
  const middle = (x1 + x2) / 2;
  return y2 === y1
    ? `H ${x2}`
    : `C ${middle} ${y1} ${middle} ${y2} ${x2} ${y2}`;
}

export function simplePriceGuidePath({
  priceY,
  labelX,
  labelY,
  title,
}: PriceGuide) {
  const endX = Math.max(0, labelX);
  const startX = title ? Math.min(endX, Math.max(0, title.right)) : 0;
  if (startX === endX) return '';
  const startY = title?.bottom ?? priceY;
  const leftWidth = title ? leaderWidth(startY - priceY) : 0;
  const rightWidth = leaderWidth(labelY - priceY);
  // Share the remaining width on narrow plots; neither connector may reverse X
  // or cross the other. The middle segment always stays at the real price y.
  const scale = Math.min(1, (endX - startX) / (leftWidth + rightWidth || 1));
  const leftJoin = startX + leftWidth * scale;
  const rightJoin = Math.max(leftJoin, endX - rightWidth * scale);
  const commands = [`M ${startX} ${startY}`];
  if (title) commands.push(curveTo(startX, startY, leftJoin, priceY));
  commands.push(`H ${rightJoin}`);
  if (rightWidth) commands.push(curveTo(rightJoin, priceY, endX, labelY));
  return commands.join(' ');
}

/** One dashed path owns both connectors and the horizontal price guide. */
export function appendSimplePriceGuide(
  svg: SVGSVGElement,
  guide: PriceGuide,
  color: string,
  dash: '4 2' | '1 1',
) {
  const path = svg.ownerDocument.createElementNS(
    'http://www.w3.org/2000/svg',
    'path',
  );
  path.setAttribute('d', simplePriceGuidePath(guide));
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', color);
  path.setAttribute('stroke-width', '1');
  path.setAttribute('stroke-dasharray', dash);
  svg.appendChild(path);
  return path;
}
