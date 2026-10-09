import { getTrustedSafeSvgUrl, isDebankMediaUrl } from './trustedMediaUrl';

describe('trusted media URLs', () => {
  it('accepts DeBank hosts without trusting lookalike hosts', () => {
    expect(isDebankMediaUrl('https://static.debank.com/image/nft.png')).toBe(
      true,
    );
    expect(isDebankMediaUrl('https://debank.com/image/nft.png')).toBe(true);
    expect(isDebankMediaUrl('https://debank.com.evil.example/nft.svg')).toBe(
      false,
    );
    expect(isDebankMediaUrl('https://debank.com@evil.example/nft.svg')).toBe(
      false,
    );
  });

  it('allows only HTTPS SVGs served through a DeBank media host', () => {
    const svgUrl =
      'https://static.debank.com/image/nft/example.svg?size=small#preview';

    expect(getTrustedSafeSvgUrl(svgUrl)).toBe(svgUrl);
    expect(
      getTrustedSafeSvgUrl('https://issuer.example/unique-wallet-nft.svg'),
    ).toBeUndefined();
    expect(
      getTrustedSafeSvgUrl('http://static.debank.com/image/nft/example.svg'),
    ).toBeUndefined();
    expect(
      getTrustedSafeSvgUrl('https://static.debank.com/image/nft/example.png'),
    ).toBeUndefined();
  });
});
