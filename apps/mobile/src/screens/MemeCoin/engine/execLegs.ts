import { compareText, legKey } from './keys';
import type { ExecLeg, PlannedLeg, TokenRef } from './types';

export const toBuyExecLegs = (legs: PlannedLeg[]): ExecLeg[] =>
  legs.map(({ key, kind, pay, receive, amountUsd }) => ({
    key,
    kind,
    pay,
    receive,
    amountUsd,
    payAll: false,
  }));

export type SellHolding = {
  meme: TokenRef;
  valueUsd: number;
  nativeToken: TokenRef;
};

export const toSellExecLegs = (holdings: SellHolding[]): ExecLeg[] =>
  holdings
    .map(
      ({ meme, valueUsd, nativeToken }): ExecLeg => ({
        key: legKey(meme, nativeToken),
        kind: 'swap',
        pay: meme,
        receive: nativeToken,
        amountUsd: valueUsd,
        payAll: true,
      }),
    )
    .sort((a, b) => b.amountUsd - a.amountUsd || compareText(a.key, b.key));
