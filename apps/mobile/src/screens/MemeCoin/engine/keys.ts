import type { TokenRef } from './types';

type TokenIdentity = Pick<TokenRef, 'chain' | 'id'>;

export const tokenKey = (token: TokenIdentity) =>
  `${token.chain}:${token.id.toLowerCase()}`;

export const legKey = (pay: TokenIdentity, receive: TokenIdentity) =>
  `${tokenKey(pay)}->${tokenKey(receive)}`;

export const compareText = (a: string, b: string) =>
  a < b ? -1 : a > b ? 1 : 0;
