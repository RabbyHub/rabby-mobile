import { tokenizeSignMessageText } from './signMessageTokenizer';

const address = '0xde709f2102306220921060314715629080e2fb77';

describe('sign message highlighter', () => {
  it('finds valid urls and addresses without swallowing punctuation', () => {
    expect(
      tokenizeSignMessageText(
        `Visit [https://example.com/path], send to ${address}.`,
      ),
    ).toEqual([
      { type: 'text', value: 'Visit [' },
      { type: 'url', value: 'https://example.com/path' },
      { type: 'text', value: '], send to ' },
      { type: 'address', value: address },
      { type: 'text', value: '.' },
    ]);
  });

  it('does not mark transaction hashes or bad checksum addresses', () => {
    const txHash = `0x${'1'.repeat(64)}`;
    const badChecksum = '0xDE709F2102306220921060314715629080e2fb77';

    expect(tokenizeSignMessageText(`${txHash} ${badChecksum}`)).toEqual([
      { type: 'text', value: `${txHash} ${badChecksum}` },
    ]);
  });

  it('prefers the url when an address appears inside it', () => {
    const url = `https://etherscan.io/address/${address}`;

    expect(tokenizeSignMessageText(url)).toEqual([{ type: 'url', value: url }]);
  });
});
