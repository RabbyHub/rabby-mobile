function loadTokenModule() {
  jest.resetModules();

  const mockAddHexPrefix = jest.fn((value: string) => `hex:${value}`);
  const mockEncodeFunctionCall = jest.fn();
  const mockEncodeParameter = jest.fn();
  const mockFindChain = jest.fn();
  const mockFindChainByServerID = jest.fn();
  const mockSendRequest = jest.fn();
  const mockToChecksumAddress = jest.fn(
    (address: string) => `checksum:${address}`,
  );
  const mockUnpadHexString = jest.fn((value: string) => `unpad:${value}`);

  jest.doMock('i18next', () => ({
    t: (key: string) => key,
  }));
  jest.doMock('@/constant', () => ({
    INTERNAL_REQUEST_SESSION: {
      icon: 'rabby-icon',
      name: 'Rabby',
      origin: 'internal://rabby',
    },
  }));
  jest.doMock('@/utils/chain', () => ({
    findChain: (...args: unknown[]) => mockFindChain(...args),
    findChainByServerID: (...args: unknown[]) =>
      mockFindChainByServerID(...args),
  }));
  jest.doMock('@ethereumjs/util', () => ({
    toChecksumAddress: (...args: unknown[]) => mockToChecksumAddress(...args),
  }));
  jest.doMock('ethereumjs-util', () => ({
    addHexPrefix: (...args: unknown[]) => mockAddHexPrefix(...args),
    unpadHexString: (...args: unknown[]) => mockUnpadHexString(...args),
  }));
  jest.doMock('./sendRequest', () => ({
    abiCoder: {
      encodeFunctionCall: (...args: unknown[]) =>
        mockEncodeFunctionCall(...args),
      encodeParameter: (...args: unknown[]) => mockEncodeParameter(...args),
    },
    sendRequest: (...args: unknown[]) => mockSendRequest(...args),
  }));

  mockSendRequest.mockResolvedValue({
    hash: '0xtx',
  });

  const tokenModule = require('./token') as typeof import('./token');

  return {
    ...tokenModule,
    mocks: {
      mockAddHexPrefix,
      mockEncodeFunctionCall,
      mockEncodeParameter,
      mockFindChain,
      mockFindChainByServerID,
      mockSendRequest,
      mockToChecksumAddress,
      mockUnpadHexString,
    },
  };
}

describe('core/apis/token', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('rejects sendToken without an account or supported chain', async () => {
    const { sendToken, mocks } = loadTokenModule();

    await expect(
      sendToken({
        account: null as never,
        chainServerId: 'eth',
        rawAmount: '1',
        to: '0xto',
        tokenId: '0xtoken',
      }),
    ).rejects.toThrow('background.error.noCurrentAccount');

    mocks.mockFindChainByServerID.mockReturnValue(null);
    await expect(
      sendToken({
        account: {
          address: '0xsender',
        } as never,
        chainServerId: 'unknown',
        rawAmount: '1',
        to: '0xto',
        tokenId: '0xtoken',
      }),
    ).rejects.toThrow('background.error.invalidChainId');
    expect(mocks.mockSendRequest).not.toHaveBeenCalled();
  });

  it('builds an ERC20 transfer transaction through sendRequest', async () => {
    const { sendToken, mocks } = loadTokenModule();
    const account = {
      address: '0xsender',
    };
    mocks.mockFindChainByServerID.mockReturnValue({
      id: 1,
      nativeTokenAddress: '0xeeee',
    });
    mocks.mockEncodeFunctionCall.mockReturnValue('0xtransferdata');

    await expect(
      sendToken({
        $ctx: {
          source: 'send-token',
        },
        account: account as never,
        chainServerId: 'eth',
        isBuild: true,
        rawAmount: '123',
        to: '0xrecipient',
        tokenId: '0xtoken',
      }),
    ).resolves.toEqual({
      hash: '0xtx',
    });

    expect(mocks.mockEncodeFunctionCall).toHaveBeenCalledWith(
      {
        inputs: [
          {
            name: 'to',
            type: 'address',
          },
          {
            name: 'value',
            type: 'uint256',
          },
        ],
        name: 'transfer',
        type: 'function',
      },
      ['checksum:0xrecipient', '123'],
    );
    expect(mocks.mockSendRequest).toHaveBeenCalledWith(
      {
        account,
        data: {
          $ctx: {
            source: 'send-token',
          },
          method: 'eth_sendTransaction',
          params: [
            {
              chainId: 1,
              data: '0xtransferdata',
              from: '0xsender',
              isSend: true,
              to: '0xtoken',
              value: '0x0',
            },
          ],
        },
        session: {
          icon: 'rabby-icon',
          name: 'Rabby',
          origin: 'internal://rabby',
        },
      },
      true,
    );
  });

  it('builds a native token transfer by converting raw amount into transaction value', async () => {
    const { sendToken, mocks } = loadTokenModule();
    const account = {
      address: '0xsender',
    };
    mocks.mockFindChainByServerID.mockReturnValue({
      id: 1,
      nativeTokenAddress: '0xeeee',
    });
    mocks.mockEncodeFunctionCall.mockReturnValue('unused-erc20-data');
    mocks.mockEncodeParameter.mockReturnValue('000f');

    await sendToken({
      account: account as never,
      chainServerId: 'eth',
      rawAmount: '15',
      to: '0xrecipient',
      tokenId: '0xeeee',
    });

    expect(mocks.mockEncodeParameter).toHaveBeenCalledWith('uint256', '15');
    expect(mocks.mockUnpadHexString).toHaveBeenCalledWith('000f');
    expect(mocks.mockAddHexPrefix).toHaveBeenCalledWith('unpad:000f');
    expect(mocks.mockSendRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          params: [
            expect.not.objectContaining({
              data: expect.anything(),
            }),
          ],
        }),
      }),
      undefined,
    );
    expect(mocks.mockSendRequest.mock.calls[0][0].data.params[0]).toEqual({
      chainId: 1,
      from: '0xsender',
      isSend: true,
      to: '0xrecipient',
      value: 'hex:unpad:000f',
    });
  });

  it('builds an ERC721 safeTransferFrom transaction with build metadata', async () => {
    const { transferNFT, mocks } = loadTokenModule();
    const account = {
      address: '0xsender',
    };
    mocks.mockFindChain.mockReturnValue({
      id: 1,
    });
    mocks.mockEncodeFunctionCall.mockReturnValue('0xerc721data');

    await transferNFT(
      {
        abi: 'ERC721',
        account: account as never,
        chainServerId: 'eth',
        contractId: '0xnft',
        to: '0xrecipient',
        tokenId: '42',
      },
      {
        $ctx: {
          source: 'nft',
        },
        isBuild: true,
      },
    );

    expect(mocks.mockEncodeFunctionCall).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'safeTransferFrom',
      }),
      ['checksum:0xsender', 'checksum:0xrecipient', '42'],
    );
    expect(mocks.mockSendRequest).toHaveBeenCalledWith(
      {
        account,
        data: {
          $ctx: {
            source: 'nft',
          },
          chainId: 1,
          from: '0xsender',
          method: 'eth_sendTransaction',
          params: [
            {
              chainId: 1,
              data: '0xerc721data',
              from: '0xsender',
              to: '0xnft',
            },
          ],
          to: '0xnft',
        },
        session: {
          icon: 'rabby-icon',
          name: 'Rabby',
          origin: 'internal://rabby',
        },
      },
      true,
    );
  });

  it('builds an ERC1155 transfer with amount and rejects unknown NFT ABI', async () => {
    const { transferNFT, mocks } = loadTokenModule();
    const account = {
      address: '0xsender',
    };
    mocks.mockFindChain.mockReturnValue({
      id: 1,
    });
    mocks.mockEncodeFunctionCall.mockReturnValue('0xerc1155data');

    await transferNFT(
      {
        abi: 'ERC1155',
        account: account as never,
        amount: 3,
        chainServerId: 'eth',
        contractId: '0xnft',
        to: '0xrecipient',
        tokenId: '42',
      },
      {},
    );

    expect(mocks.mockEncodeFunctionCall).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'safeTransferFrom',
      }),
      ['checksum:0xsender', 'checksum:0xrecipient', '42', 3, []],
    );
    expect(mocks.mockSendRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          params: [
            {
              chainId: 1,
              data: '0xerc1155data',
              from: '0xsender',
              to: '0xnft',
            },
          ],
        }),
      }),
      false,
    );

    await expect(
      transferNFT(
        {
          abi: 'ERC777' as never,
          account: account as never,
          chainServerId: 'eth',
          contractId: '0xnft',
          to: '0xrecipient',
          tokenId: '42',
        },
        {},
      ),
    ).rejects.toThrow('background.error.unknownAbi');
  });
});
