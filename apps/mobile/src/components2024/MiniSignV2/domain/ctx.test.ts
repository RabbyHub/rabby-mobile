import type { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { buildFingerprint } from './ctx';

const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const transferTo = (receiver: string) =>
  `0xa9059cbb${receiver.slice(2).padStart(64, '0')}${(1e6)
    .toString(16)
    .padStart(64, '0')}`;

const tx = (patch: Partial<Tx> = {}) =>
  ({
    chainId: 1,
    from: '0x1111111111111111111111111111111111111111',
    to: USDC,
    value: '0x0',
    data: transferTo('0x2222222222222222222222222222222222222222'),
    ...patch,
  } as Tx);

describe('buildFingerprint', () => {
  it('differs for same-length transfers to different receivers', () => {
    const other = tx({
      data: transferTo('0x3333333333333333333333333333333333333333'),
    });
    expect(other.data.length).toBe(tx().data.length);
    expect(buildFingerprint([other])).not.toBe(buildFingerprint([tx()]));
  });

  it('differs when only from changes', () => {
    expect(
      buildFingerprint([
        tx({ from: '0x4444444444444444444444444444444444444444' }),
      ]),
    ).not.toBe(buildFingerprint([tx()]));
  });

  it('ignores address case', () => {
    expect(
      buildFingerprint([
        tx({
          from: '0x1111111111111111111111111111111111111111'.toUpperCase(),
          to: USDC.toUpperCase(),
        }),
      ]),
    ).toBe(buildFingerprint([tx()]));
  });
});
