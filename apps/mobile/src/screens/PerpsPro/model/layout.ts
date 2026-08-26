const PERPS_PRO_HORIZONTAL_PADDING = 30;
const PERPS_PRO_DESIGN_CONTENT_WIDTH = 363;
const PERPS_PRO_DESIGN_ORDER_BOOK_WIDTH = 136;
const PERPS_PRO_DESIGN_COLUMN_GAP = 16;
const PERPS_PRO_MIN_ORDER_BOOK_WIDTH = 112;

export const PERPS_PRO_MAIN_COLUMN_HEIGHT = 416;

const PERPS_PRO_BOTTOM_SHEET_HANDLE_HEIGHT = 40;
const PERPS_PRO_PRECISION_CONTENT_TOP = 8;
const PERPS_PRO_PRECISION_OPTION_HEIGHT = 40;
const PERPS_PRO_PRECISION_OPTION_GAP = 8;
const PERPS_PRO_SHEET_MIN_BOTTOM_PADDING = 48;
const PERPS_PRO_PRECISION_MIN_HEIGHT = 150;
const PERPS_PRO_PRECISION_MAX_HEIGHT = 420;
const PERPS_PRO_SHEET_MIN_TOP_OFFSET = 24;
const PERPS_PRO_SHEET_TOP_SAFE_GAP = 16;
const PERPS_PRO_MARKET_SELECTOR_DESIGN_TOP = 120;
const PERPS_PRO_MARKET_SELECTOR_MIN_HEIGHT = 320;
const PERPS_PRO_POSITION_TPSL_LIST_DESIGN_TOP = 120;
const PERPS_PRO_POSITION_TPSL_FORM_DESIGN_TOP = 134;
const PERPS_PRO_POSITION_TPSL_MIN_HEIGHT = 320;
const PERPS_PRO_POSITION_TPSL_SUBPAGE_CHROME_HEIGHT = 170;
const PERPS_PRO_POSITION_TPSL_TAB_CHROME_HEIGHT = 192;
const PERPS_PRO_POSITION_TPSL_INLINE_EMPTY_CHROME_HEIGHT = 196;

export type PerpsProPositionTpSlFormPresentation =
  | 'inline-empty'
  | 'subpage'
  | 'tab';

export type PerpsProColumnLayout = {
  contentWidth: number;
  gap: number;
  orderBookWidth: number;
  tradeWidth: number;
};

export const getPerpsProColumnLayout = (
  windowWidth: number,
): PerpsProColumnLayout => {
  const safeWindowWidth =
    Number.isFinite(windowWidth) && windowWidth > 0 ? windowWidth : 0;
  const contentWidth = Math.max(
    0,
    safeWindowWidth - PERPS_PRO_HORIZONTAL_PADDING,
  );
  const scale = Math.min(1, contentWidth / PERPS_PRO_DESIGN_CONTENT_WIDTH);
  const orderBookWidth = Math.min(
    contentWidth,
    Math.max(
      PERPS_PRO_MIN_ORDER_BOOK_WIDTH,
      Math.round(PERPS_PRO_DESIGN_ORDER_BOOK_WIDTH * scale),
    ),
  );
  const gap = Math.min(
    Math.max(0, contentWidth - orderBookWidth),
    Math.round(PERPS_PRO_DESIGN_COLUMN_GAP * scale),
  );

  return {
    contentWidth,
    gap,
    orderBookWidth,
    tradeWidth: Math.max(0, contentWidth - orderBookWidth - gap),
  };
};

export type PerpsProPrecisionSheetLayout = {
  bottomPadding: number;
  contentHeight: number;
  scrollEnabled: boolean;
  snapPoint: number;
};

export const getPerpsProPrecisionSheetLayout = ({
  bottomInset,
  optionCount,
  topInset,
  windowHeight,
}: {
  bottomInset: number;
  optionCount: number;
  topInset: number;
  windowHeight: number;
}): PerpsProPrecisionSheetLayout => {
  const safeBottomInset =
    Number.isFinite(bottomInset) && bottomInset > 0 ? bottomInset : 0;
  const safeTopInset = Number.isFinite(topInset) && topInset > 0 ? topInset : 0;
  const safeOptionCount =
    Number.isFinite(optionCount) && optionCount > 0
      ? Math.floor(optionCount)
      : 0;
  const safeWindowHeight =
    Number.isFinite(windowHeight) && windowHeight > 0 ? windowHeight : 0;
  const bottomPadding = Math.max(
    PERPS_PRO_SHEET_MIN_BOTTOM_PADDING,
    safeBottomInset,
  );
  const contentHeight =
    PERPS_PRO_BOTTOM_SHEET_HANDLE_HEIGHT +
    PERPS_PRO_PRECISION_CONTENT_TOP +
    safeOptionCount * PERPS_PRO_PRECISION_OPTION_HEIGHT +
    Math.max(0, safeOptionCount - 1) * PERPS_PRO_PRECISION_OPTION_GAP +
    bottomPadding;
  const availableHeight = Math.max(
    0,
    safeWindowHeight -
      Math.max(
        PERPS_PRO_SHEET_MIN_TOP_OFFSET,
        safeTopInset + PERPS_PRO_SHEET_TOP_SAFE_GAP,
      ),
  );
  const maxHeight = Math.min(
    PERPS_PRO_PRECISION_MAX_HEIGHT,
    availableHeight || PERPS_PRO_PRECISION_MAX_HEIGHT,
  );
  const snapPoint = Math.min(
    Math.max(
      Math.min(PERPS_PRO_PRECISION_MIN_HEIGHT, maxHeight),
      contentHeight,
    ),
    maxHeight,
  );

  return {
    bottomPadding,
    contentHeight,
    scrollEnabled: contentHeight > snapPoint,
    snapPoint,
  };
};

export const getPerpsProMarketSelectorSnapPoint = ({
  topInset,
  windowHeight,
}: {
  topInset: number;
  windowHeight: number;
}) => {
  const safeTopInset = Number.isFinite(topInset) && topInset > 0 ? topInset : 0;
  const safeWindowHeight =
    Number.isFinite(windowHeight) && windowHeight > 0 ? windowHeight : 0;
  const topOffset = Math.max(
    PERPS_PRO_MARKET_SELECTOR_DESIGN_TOP,
    safeTopInset + PERPS_PRO_SHEET_TOP_SAFE_GAP,
  );

  return Math.min(
    safeWindowHeight,
    Math.max(
      Math.min(PERPS_PRO_MARKET_SELECTOR_MIN_HEIGHT, safeWindowHeight),
      safeWindowHeight - topOffset,
    ),
  );
};

export const getPerpsProPositionTpSlSnapPoint = ({
  page,
  topInset,
  windowHeight,
}: {
  page: 'form' | 'list';
  topInset: number;
  windowHeight: number;
}) => {
  const safeTopInset = Number.isFinite(topInset) && topInset > 0 ? topInset : 0;
  const safeWindowHeight =
    Number.isFinite(windowHeight) && windowHeight > 0 ? windowHeight : 0;
  const designTop =
    page === 'list'
      ? PERPS_PRO_POSITION_TPSL_LIST_DESIGN_TOP
      : PERPS_PRO_POSITION_TPSL_FORM_DESIGN_TOP;
  const topOffset = Math.max(
    designTop,
    safeTopInset + PERPS_PRO_SHEET_TOP_SAFE_GAP,
  );

  return Math.min(
    safeWindowHeight,
    Math.max(
      Math.min(PERPS_PRO_POSITION_TPSL_MIN_HEIGHT, safeWindowHeight),
      safeWindowHeight - topOffset,
    ),
  );
};

export const getPerpsProPositionTpSlFormMinimumHeight = ({
  presentation,
  snapPoint,
}: {
  presentation: PerpsProPositionTpSlFormPresentation;
  snapPoint: number;
}) => {
  const safeSnapPoint =
    Number.isFinite(snapPoint) && snapPoint > 0 ? snapPoint : 0;
  const chromeHeight =
    presentation === 'subpage'
      ? PERPS_PRO_POSITION_TPSL_SUBPAGE_CHROME_HEIGHT
      : presentation === 'inline-empty'
      ? PERPS_PRO_POSITION_TPSL_INLINE_EMPTY_CHROME_HEIGHT
      : PERPS_PRO_POSITION_TPSL_TAB_CHROME_HEIGHT;

  return Math.max(
    0,
    safeSnapPoint - PERPS_PRO_BOTTOM_SHEET_HANDLE_HEIGHT - chromeHeight,
  );
};
