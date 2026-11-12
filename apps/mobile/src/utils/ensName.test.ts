import { isPossibleEnsName } from './ensName';

describe('isPossibleEnsName', () => {
  it.each([
    'vitalik.eth',
    'janbenes.zk.money',
    'rabby.io',
    ' Jan.ETH ',
    '🦊.eth',
    '0x12.eth',
  ])('accepts %p', input => {
    expect(isPossibleEnsName(input)).toBe(true);
  });

  it.each([
    '',
    'hongb',
    'eth',
    '0x1234',
    'jan.',
    '.eth',
    'jan..eth',
    'jan .eth',
    'jan eth',
  ])('rejects %p', input => {
    expect(isPossibleEnsName(input)).toBe(false);
  });
});
