import { isAccountSupportDirectSign } from '@/utils/account';

export class UnsupportedMemeTradeAccountError extends Error {
  constructor() {
    super('MemeCoin trading supports only private key and mnemonic accounts');
    this.name = 'UnsupportedMemeTradeAccountError';
  }
}

export const assertMemeTradeAccount = (account: { type?: string }) => {
  if (!isAccountSupportDirectSign(account.type)) {
    throw new UnsupportedMemeTradeAccountError();
  }
};
