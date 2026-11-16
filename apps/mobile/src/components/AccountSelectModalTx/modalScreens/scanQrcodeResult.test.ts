import { resolveGalleryQrCodePayloads } from './scanQrcodeResult';

const ADDRESS = '0x341a1fBD51825E5a107DB54cCb3166DeBA145479';

describe('resolveGalleryQrCodePayloads', () => {
  it('accepts a single address or ENS name', () => {
    expect(resolveGalleryQrCodePayloads([` ${ADDRESS}\n`])).toEqual({
      status: 'success',
      value: ADDRESS,
    });
    expect(resolveGalleryQrCodePayloads(['vitalik.eth'])).toEqual({
      status: 'success',
      value: 'vitalik.eth',
    });
  });

  it('treats duplicated payloads as one QR code', () => {
    expect(resolveGalleryQrCodePayloads([ADDRESS, ADDRESS])).toEqual({
      status: 'success',
      value: ADDRESS,
    });
  });

  it('rejects empty or multiple QR codes', () => {
    expect(resolveGalleryQrCodePayloads([])).toEqual({ status: 'not-found' });
    expect(resolveGalleryQrCodePayloads([' '])).toEqual({
      status: 'not-found',
    });
    expect(resolveGalleryQrCodePayloads([ADDRESS, 'vitalik.eth'])).toEqual({
      status: 'multiple',
    });
  });

  it('rejects sensitive or non-recipient payloads', () => {
    [
      `0x${'a'.repeat(64)}`,
      'a'.repeat(64),
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      'ur:crypto-hdkey/abc',
      `ethereum:${ADDRESS}@1`,
      'https://rabby.io',
    ].forEach(payload => {
      expect(resolveGalleryQrCodePayloads([payload])).toEqual({
        status: 'invalid',
      });
    });
  });
});
