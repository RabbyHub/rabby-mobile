const mockFindChain = jest.fn();
const mockFindChainByServerID = jest.fn();
const mockSendRequest = jest.fn();
const mockEncodeFunctionCall = jest.fn();
const mockEncodeParameter = jest.fn();
const mockTranslate = jest.fn((key: string) => `translated:${key}`);

jest.mock('@/utils/chain', () => ({
  findChain: (...args: unknown[]) => mockFindChain(...args),
  findChainByServerID: (...args: unknown[]) => mockFindChainByServerID(...args),
}));

jest.mock('./sendRequest', () => ({
  sendRequest: (...args: unknown[]) => mockSendRequest(...args),
  abiCoder: {
    encodeFunctionCall: (...args: unknown[]) => mockEncodeFunctionCall(...args),
    encodeParameter: (...args: unknown[]) => mockEncodeParameter(...args),
  },
}));

jest.mock('@/constant', () => ({
  INTERNAL_REQUEST_SESSION: 'internal-request-session',
}));

jest.mock('i18next', () => ({
  t: (...args: unknown[]) => mockTranslate(...args),
}));

jest.mock('@ethereumjs/util', () => ({
  toChecksumAddress: (address: string) => `checksum:${address}`,
}));

jest.mock('ethereumjs-util', () => ({
  addHexPrefix: (value: string) =>
    value.startsWith('0x') ? value : `0x${value}`,
  unpadHexString: (value: string) => value.replace(/^(0x)?0+/, '') || '0',
}));

import { sendToken, transferNFT } from './token';

const account = {
  address: '0xabc',
  type: 'SimpleKeyring',
  brandName: 'SimpleKeyring',
};

describe('core/apis/token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindChain.mockReturnValue({
      id: 1,
      serverId: 'eth',
    });
    mockFindChainByServerID.mockReturnValue({
      id: 1,
      serverId: 'eth',
      nativeTokenAddress: '0xeeee',
    });
    mockEncodeFunctionCall.mockReturnValue('0xencodedFunctionCall');
    mockEncodeParameter.mockReturnValue('0000000000000010');
    mockSendRequest.mockResolvedValue('sent');
  });

  it('rejects token sends without a current account', async () => {
    await expect(
      sendToken({
        to: '0xdef',
        chainServerId: 'eth',
        tokenId: '0xtoken',
        rawAmount: '1',
        account: null as never,
      }),
    ).rejects.toThrow('translated:background.error.noCurrentAccount');

    expect(mockTranslate).toHaveBeenCalledWith(
      'background.error.noCurrentAccount',
    );
    expect(mockSendRequest).not.toHaveBeenCalled();
  });

  it('rejects token sends for unknown chains', async () => {
    mockFindChainByServerID.mockReturnValue(undefined);

    await expect(
      sendToken({
        to: '0xdef',
        chainServerId: 'unknown',
        tokenId: '0xtoken',
        rawAmount: '1',
        account: account as never,
      }),
    ).rejects.toThrow('translated:background.error.invalidChainId');

    expect(mockSendRequest).not.toHaveBeenCalled();
  });

  it('builds ERC20 transfer transactions through sendRequest', async () => {
    const ctx = { source: 'unit-test' };

    await expect(
      sendToken({
        to: '0xdef',
        chainServerId: 'eth',
        tokenId: '0xtoken',
        rawAmount: '100',
        account: account as never,
        $ctx: ctx,
        isBuild: true,
      }),
    ).resolves.toBe('sent');

    expect(mockEncodeFunctionCall).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'transfer',
        type: 'function',
      }),
      ['checksum:0xdef', '100'],
    );
    expect(mockSendRequest).toHaveBeenCalledWith(
      {
        data: {
          method: 'eth_sendTransaction',
          params: [
            {
              chainId: 1,
              from: '0xabc',
              to: '0xtoken',
              value: '0x0',
              data: '0xencodedFunctionCall',
              isSend: true,
            },
          ],
          $ctx: ctx,
        },
        session: 'internal-request-session',
        account,
      },
      true,
    );
  });

  it('builds native token sends without calldata and with encoded value', async () => {
    await expect(
      sendToken({
        to: '0xdef',
        chainServerId: 'eth',
        tokenId: '0xeeee',
        rawAmount: '16',
        account: account as never,
      }),
    ).resolves.toBe('sent');

    expect(mockEncodeParameter).toHaveBeenCalledWith('uint256', '16');
    expect(mockSendRequest).toHaveBeenCalledWith(
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
    expect(mockSendRequest.mock.calls[0][0].data.params[0]).toMatchObject({
      to: '0xdef',
      value: '0x10',
      isSend: true,
    });
  });

  it('builds ERC721 NFT safeTransferFrom calls and carries build metadata', async () => {
    const ctx = { source: 'nft-test' };

    await expect(
      transferNFT(
        {
          to: '0xdef',
          chainServerId: 'eth',
          contractId: '0xnft',
          abi: 'ERC721',
          tokenId: '7',
          account: account as never,
        },
        {
          $ctx: ctx,
          isBuild: true,
        },
      ),
    ).resolves.toBe('sent');

    expect(mockEncodeFunctionCall).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'safeTransferFrom',
      }),
      ['checksum:0xabc', 'checksum:0xdef', '7'],
    );
    expect(mockSendRequest).toHaveBeenCalledWith(
      {
        data: {
          $ctx: ctx,
          method: 'eth_sendTransaction',
          chainId: 1,
          from: '0xabc',
          to: '0xnft',
          params: [
            {
              from: '0xabc',
              to: '0xnft',
              chainId: 1,
              data: '0xencodedFunctionCall',
            },
          ],
        },
        session: 'internal-request-session',
        account,
      },
      true,
    );
  });

  it('builds ERC1155 NFT safeTransferFrom calls with amount and empty data', async () => {
    await expect(
      transferNFT(
        {
          to: '0xdef',
          chainServerId: 'eth',
          contractId: '0xnft',
          abi: 'ERC1155',
          tokenId: '7',
          amount: 3,
          account: account as never,
        },
        {},
      ),
    ).resolves.toBe('sent');

    expect(mockEncodeFunctionCall).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'safeTransferFrom',
      }),
      ['checksum:0xabc', 'checksum:0xdef', '7', 3, []],
    );
  });

  it('rejects unknown NFT ABI variants', async () => {
    await expect(
      transferNFT(
        {
          to: '0xdef',
          chainServerId: 'eth',
          contractId: '0xnft',
          abi: 'ERC999' as never,
          tokenId: '7',
          account: account as never,
        },
        {},
      ),
    ).rejects.toThrow('translated:background.error.unknownAbi');

    expect(mockSendRequest).not.toHaveBeenCalled();
  });
});
