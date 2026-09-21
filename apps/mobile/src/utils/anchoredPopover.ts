type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Size = {
  width: number;
  height: number;
};

export const getAnchoredPopoverPosition = ({
  anchorRect,
  overlayRect,
  contentSize,
  gap = 8,
  padding = 12,
}: {
  anchorRect: Rect;
  overlayRect: Rect;
  contentSize: Size;
  gap?: number;
  padding?: number;
}) => {
  const anchorLeft = anchorRect.x - overlayRect.x;
  const anchorTop = anchorRect.y - overlayRect.y;

  let left = anchorLeft + anchorRect.width - contentSize.width;
  let top = anchorTop - contentSize.height - gap;

  if (top < padding) {
    top = anchorTop + anchorRect.height + gap;
  }

  const maxLeft = Math.max(
    padding,
    overlayRect.width - contentSize.width - padding,
  );
  const maxTop = Math.max(
    padding,
    overlayRect.height - contentSize.height - padding,
  );

  left = Math.max(padding, Math.min(left, maxLeft));
  top = Math.max(padding, Math.min(top, maxTop));

  return { left, top };
};
