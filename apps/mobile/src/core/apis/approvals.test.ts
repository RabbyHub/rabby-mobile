const mockFindChain = jest.fn();
const mockSendRequest = jest.fn();
const mockEncodeFunctionCall = jest.fn();
const mockTranslate = jest.fn((key: string) => `translated:${key}`);
const mockRequestETHRpc = jest.fn();
const mockDecodeAbiParameters = jest.fn();
const mockToChecksumAddress = jest.fn(
  (address: string) => `checksum:${address}`,
);

jest.mock('i18next', () => ({
  t: (...args: unknown[]) => mockTranslate(...args),
}));

jest.mock('@/constant', () => ({
  INTERNAL_REQUEST_SESSION: 'internal-request-session',
}));

jest.mock('./sendRequest', () => ({
  sendRequest: (...args: unknown[]) => mockSendRequest(...args),
  abiCoder: {
    encodeFunctionCall: (...args: unknown[]) => mockEncodeFunctionCall(...args),
  },
}));

jest.mock('../services', () => ({
  preferenceService: {},
}));

jest.mock('@/utils/chain', () => ({
  findChain: (...args: unknown[]) => mockFindChain(...args),
}));

jest.mock('./provider', () => ({
  requestETHRpc: (...args: unknown[]) => mockRequestETHRpc(...args),
}));

jest.mock('@ethereumjs/util', () => ({
  isZeroAddress: jest.fn(),
  toChecksumAddress: (...args: unknown[]) => mockToChecksumAddress(...args),
}));

jest.mock('viem', () => ({
  decodeAbiParameters: (...args: unknown[]) => mockDecodeAbiParameters(...args),
}));

jest.mock('@rabby-wallet/biz-utils', () => ({
  approvalUtils: {
    summarizeRevoke: jest.fn(),
  },
  permit2Utils: {
    decodePermit2GroupKey: jest.fn(),
  },
}));

import {
  approveToken,
  getErc721Approved,
  getNFTApprovedForAll,
  lockdownPermit2,
  revokeNFTApprove,
} from './approvals';

const account = {
  address: '0xabc',
  type: 'SimpleKeyring',
  brandName: 'SimpleKeyring',
};

describe('core/apis/approvals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindChain.mockReturnValue({
      id: 1,
      serverId: 'eth',
    });
    mockEncodeFunctionCall.mockReturnValue('0xencodedCall');
    mockSendRequest.mockResolvedValue('0xtx');
    mockRequestETHRpc.mockResolvedValue('0xrpc');
    mockDecodeAbiParameters.mockReturnValue([true]);
  });

  it('rejects approveToken without account or known chain', async () => {
    await expect(
      approveToken({
        chainServerId: 'eth',
        id: '0xtoken',
        spender: '0xspender',
        amount: 1,
        account: null as never,
      }),
    ).rejects.toThrow('translated:background.error.noCurrentAccount');

    mockFindChain.mockReturnValue(undefined);
    await expect(
      approveToken({
        chainServerId: 'unknown',
        id: '0xtoken',
        spender: '0xspender',
        amount: 1,
        account: account as never,
      }),
    ).rejects.toThrow('translated:background.error.invalidChainId');

    expect(mockSendRequest).not.toHaveBeenCalled();
  });

  it('builds token approve transactions with gas price and extra metadata', async () => {
    const ctx = { ga: { source: 'test' } };

    await expect(
      approveToken({
        chainServerId: 'eth',
        id: '0xtoken',
        spender: '0xspender',
        amount: '100',
        gasPrice: 123,
        extra: {
          isSwap: true,
          swapPreferMEVGuarded: true,
        },
        $ctx: ctx,
        isBuild: true,
        account: account as never,
      }),
    ).resolves.toBe('0xtx');

    expect(mockEncodeFunctionCall).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'approve',
      }),
      ['checksum:0xspender', '100'],
    );
    expect(mockSendRequest).toHaveBeenCalledWith(
      {
        data: {
          $ctx: ctx,
          method: 'eth_sendTransaction',
          params: [
            {
              from: '0xabc',
              to: '0xtoken',
              chainId: 1,
              data: '0xencodedCall',
              gasPrice: 123,
              isSwap: true,
              swapPreferMEVGuarded: true,
            },
          ],
        },
        session: 'internal-request-session',
        account,
      },
      true,
    );
  });

  it('reads NFT approval-for-all and ERC721 approved operator through eth_call', async () => {
    await expect(
      getNFTApprovedForAll({
        chainServerId: 'eth',
        contractAddress: '0xnft',
        address: '0xowner',
        spender: '0xspender',
        account: account as never,
      }),
    ).resolves.toBe(true);

    expect(mockEncodeFunctionCall).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'isApprovedForAll',
      }),
      ['checksum:0xowner', 'checksum:0xspender'],
    );
    expect(mockRequestETHRpc).toHaveBeenCalledWith(
      {
        method: 'eth_call',
        params: [{ to: '0xnft', data: '0xencodedCall' }, 'latest'],
      },
      'eth',
      account,
    );

    mockDecodeAbiParameters.mockReturnValue(['0xapproved']);
    await expect(
      getErc721Approved({
        chainServerId: 'eth',
        contractAddress: '0xnft',
        nftTokenId: '7',
        account: account as never,
      }),
    ).resolves.toBe('0xapproved');
    expect(mockEncodeFunctionCall).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'getApproved',
      }),
      ['7'],
    );
  });

  it('builds ERC721 revoke transactions for approved-for-all and token-specific approvals', async () => {
    await revokeNFTApprove(
      {
        chainServerId: 'eth',
        contractId: '0xnft',
        spender: '0xspender',
        abi: 'ERC721',
        nftTokenId: '7',
        isApprovedForAll: true,
        account: account as never,
      },
      { ga: { source: 'nft-all' } },
      true,
    );

    expect(mockEncodeFunctionCall).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'setApprovalForAll',
      }),
      ['checksum:0xspender', false],
    );
    expect(mockSendRequest).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          params: [
            expect.objectContaining({
              from: '0xabc',
              to: '0xnft',
              chainId: 1,
              data: '0xencodedCall',
            }),
          ],
        }),
      }),
      true,
    );

    await revokeNFTApprove(
      {
        chainServerId: 'eth',
        contractId: '0xnft',
        spender: '0xspender',
        abi: 'ERC721',
        nftTokenId: '7',
        isApprovedForAll: false,
        account: account as never,
      },
      undefined,
      false,
    );

    expect(mockEncodeFunctionCall).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'approve',
      }),
      ['0x0000000000000000000000000000000000000000', '7'],
    );
  });

  it('builds ERC1155 revoke transactions and rejects unknown NFT ABI variants', async () => {
    await expect(
      revokeNFTApprove({
        chainServerId: 'eth',
        contractId: '0xnft',
        spender: '0xspender',
        abi: 'ERC1155',
        isApprovedForAll: true,
        account: account as never,
      }),
    ).resolves.toBe('0xtx');

    expect(mockEncodeFunctionCall).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'setApprovalForAll',
      }),
      ['checksum:0xspender', false],
    );

    await expect(
      revokeNFTApprove({
        chainServerId: 'eth',
        contractId: '0xnft',
        spender: '0xspender',
        abi: '',
        isApprovedForAll: true,
        account: account as never,
      }),
    ).rejects.toThrow('translated:background.error.unknownAbi');
  });

  it('normalizes Permit2 token spender pairs before lockdown transaction construction', async () => {
    const tokenSpenders = [
      {
        token: '0xtoken',
        spender: '0xspender',
      },
    ];

    await expect(
      lockdownPermit2(
        {
          id: '0xpermit2',
          chainServerId: 'eth',
          tokenSpenders,
          gasPrice: 456,
          $ctx: { ga: { source: 'permit2' } },
          account: account as never,
        },
        true,
      ),
    ).resolves.toBe('0xtx');

    expect(tokenSpenders).toEqual([
      {
        token: '0xtoken',
        spender: '0xspender',
      },
    ]);
    expect(mockEncodeFunctionCall).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'lockdown',
      }),
      [
        [
          {
            token: 'checksum:0xtoken',
            spender: 'checksum:0xspender',
          },
        ],
      ],
    );
    expect(mockSendRequest).toHaveBeenCalledWith(
      {
        data: {
          $ctx: { ga: { source: 'permit2' } },
          method: 'eth_sendTransaction',
          params: [
            {
              from: '0xabc',
              to: '0xpermit2',
              chainId: 1,
              data: '0xencodedCall',
              gasPrice: 456,
            },
          ],
        },
        session: 'internal-request-session',
        account,
      },
      true,
    );
  });
});
