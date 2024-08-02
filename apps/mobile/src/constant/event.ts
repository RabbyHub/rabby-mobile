export enum BroadcastEvent {
  accountsChanged = 'rabby_accountsChanged',
  /**
   * @deprecated
   */
  unlockStateChanged = 'rabby_unlockStateChanged',
  chainChanged = 'rabby_chainChanged',
  unlock = 'unlock',
  lock = 'lock',
}
export const appIsProd = process.env.NODE_ENV === 'production';
export const appIsDev = !appIsProd;
