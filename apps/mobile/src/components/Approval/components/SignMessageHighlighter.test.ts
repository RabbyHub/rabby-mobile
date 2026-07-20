import {
  tokenizeSignMessageText,
  tokenizeSignTypedDataMessage,
} from './signMessageTokenizer';
import {
  addSignMessageOriginFallback,
  hasSignMessageOriginMismatch,
} from './signMessageOrigin';

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

  it('finds an address inside a url without changing the displayed text', () => {
    const url = `https://etherscan.io/address/${address}`;
    const tokens = tokenizeSignMessageText(url);

    expect(tokens.map(token => token.value).join('')).toBe(url);
    expect(tokens).toEqual([
      { type: 'url', value: 'https://etherscan.io/address/' },
      { type: 'address', value: address },
    ]);
  });

  it('finds only values declared as nested typed-data addresses', () => {
    const withoutPrefix = 'de709f2102306220921060314715629080e2fb77';
    const recipient = '0x27b1fdb04752bbc536007a920d24acb045561c26';
    const typedData = {
      primaryType: 'Mail',
      types: {
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'recipients', type: 'address[]' },
          { name: 'note', type: 'string' },
        ],
        Person: [{ name: 'wallet', type: 'address' }],
      },
      message: {
        from: { wallet: withoutPrefix },
        recipients: [recipient],
        note: recipient,
      },
    };
    const message = JSON.stringify(typedData.message, null, 4);
    const tokens = tokenizeSignTypedDataMessage(typedData, message);

    expect(tokens.map(token => token.value).join('')).toBe(message);
    expect(tokens.filter(token => token.type === 'address')).toEqual([
      {
        type: 'address',
        value: withoutPrefix,
        address: `0x${withoutPrefix}`,
      },
      { type: 'address', value: recipient, address: recipient },
    ]);
  });
});

describe('sign message origin fallback', () => {
  it('detects a visible hostname that differs from the request hostname', () => {
    expect(
      hasSignMessageOriginMismatch(
        'URI: https://docs.example.org/address/0x1234',
        'http://127.0.0.1:8080',
      ),
    ).toBe(true);
  });

  it('adds verifyAddress only for unparsed external requests', () => {
    const ctx = { contractCall: {} } as any;

    expect(
      addSignMessageOriginFallback(ctx, {
        isUnparsedAction: true,
        isInternalOrigin: false,
        message: 'URI: https://docs.example.org',
        origin: 'http://127.0.0.1:8080',
      }),
    ).toEqual({
      contractCall: {},
      verifyAddress: {
        allowOrigins: [],
        origin: 'http://127.0.0.1:8080',
      },
    });

    expect(
      addSignMessageOriginFallback(ctx, {
        isUnparsedAction: false,
        isInternalOrigin: false,
        message: 'URI: https://docs.example.org',
        origin: 'http://127.0.0.1:8080',
      }),
    ).toBe(ctx);

    expect(
      addSignMessageOriginFallback(ctx, {
        isUnparsedAction: true,
        isInternalOrigin: false,
        message: 'URI: https://example.com/login',
        origin: 'https://EXAMPLE.com.:443',
      }),
    ).toBe(ctx);

    expect(
      addSignMessageOriginFallback(ctx, {
        isUnparsedAction: true,
        isInternalOrigin: true,
        message: 'URI: https://docs.example.org',
        origin: 'https://example.com',
      }),
    ).toBe(ctx);
  });
});
