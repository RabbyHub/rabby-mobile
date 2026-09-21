import { UserAbstractionResp } from '@rabby-wallet/hyperliquid-sdk';

import { isPerpsStandardTransferAbstraction } from './transferEligibility';

describe('isPerpsStandardTransferAbstraction', () => {
  it.each([
    [UserAbstractionResp.default, true],
    [UserAbstractionResp.disabled, true],
    [UserAbstractionResp.unifiedAccount, false],
    [UserAbstractionResp.portfolioMargin, false],
    [UserAbstractionResp.dexAbstraction, false],
    [undefined, false],
    ['unknown', false],
  ])('classifies %s as %s', (value, expected) => {
    expect(isPerpsStandardTransferAbstraction(value)).toBe(expected);
  });
});
