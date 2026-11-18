export const OPEN_ORDER_CATEGORIES = ['basic', 'conditional', 'twap'] as const;
export type OpenOrderCategory = (typeof OPEN_ORDER_CATEGORIES)[number];

export const isOpenOrderCategory = (
  key: string | undefined,
): key is OpenOrderCategory =>
  OPEN_ORDER_CATEGORIES.some(category => category === key);
