export const BALANCE_HIDE_TYPE = {
  HIDE: 'HIDE',
  SHOW: 'SHOW',
} as const;

export type BALANCE_HIDE_TYPE =
  (typeof BALANCE_HIDE_TYPE)[keyof typeof BALANCE_HIDE_TYPE];
