import { resolvePerpsProFittedFontSize } from '../common/perpsProFitFontSize';

export const TPSL_TAB_FONT_SIZE = 14;
export const TPSL_TAB_MIN_FONT_SIZE = 11;
export const TPSL_ACTION_FONT_SIZE = 12;
export const TPSL_ACTION_MIN_FONT_SIZE = 10;
const FONT_SIZE_STEP = 0.5;

export type PerpsProPositionTpSlTabRowWidths = {
  /** Natural width of both tab labels at the tab font size (bold). */
  tabText: number;
  /** Natural width of both action labels at the action font size. */
  actionText: number;
};

export type PerpsProPositionTpSlTabRowFit = {
  tabFontSize: number;
  actionFontSize: number;
  /** The row cannot fit even at the minimum sizes: actions take a new line. */
  wrapped: boolean;
};

const FULL_SIZE: PerpsProPositionTpSlTabRowFit = {
  tabFontSize: TPSL_TAB_FONT_SIZE,
  actionFontSize: TPSL_ACTION_FONT_SIZE,
  wrapped: false,
};

/**
 * Long translations push the actions past the sheet edge. Tabs and actions
 * shrink by one ratio so the row keeps its layout and every label stays whole.
 * `chromeWidth` is everything in the row that is not label text.
 */
export const resolvePerpsProPositionTpSlTabRowFit = ({
  chromeWidth,
  rowWidth,
  widths,
}: {
  chromeWidth: number;
  rowWidth: number;
  widths: PerpsProPositionTpSlTabRowWidths | null;
}): PerpsProPositionTpSlTabRowFit => {
  if (!widths || !(rowWidth > 0)) {
    return FULL_SIZE;
  }
  // Express both labels at the tab size so one ratio drives both sizes.
  const naturalWidth =
    widths.tabText +
    (widths.actionText * TPSL_TAB_FONT_SIZE) / TPSL_ACTION_FONT_SIZE;
  const availableWidth = rowWidth - chromeWidth;
  const tabFontSize = resolvePerpsProFittedFontSize({
    availableWidth,
    baseFontSize: TPSL_TAB_FONT_SIZE,
    minFontSize: TPSL_TAB_MIN_FONT_SIZE,
    naturalWidth,
  });
  if (tabFontSize === TPSL_TAB_FONT_SIZE) {
    return FULL_SIZE;
  }
  const ratio = tabFontSize / TPSL_TAB_FONT_SIZE;
  const actionFontSize = Math.max(
    TPSL_ACTION_MIN_FONT_SIZE,
    Math.floor((TPSL_ACTION_FONT_SIZE * ratio) / FONT_SIZE_STEP) *
      FONT_SIZE_STEP,
  );
  const fittedWidth =
    (widths.tabText * tabFontSize) / TPSL_TAB_FONT_SIZE +
    (widths.actionText * actionFontSize) / TPSL_ACTION_FONT_SIZE;
  if (fittedWidth > availableWidth) {
    // Even the minimum sizes overflow: keep the design sizes on two lines.
    return { ...FULL_SIZE, wrapped: true };
  }
  return { tabFontSize, actionFontSize, wrapped: false };
};
