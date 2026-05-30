import {
  decodeRevokeItem,
  encodeRevokeItem,
  findIndexRevokeList,
  getFirstSpender,
  isSameRevokeItem,
} from '../utils';

jest.mock(
  '@rabby-wallet/biz-utils/dist/isomorphic/approval',
  () => ({
    RiskNumMap: {
      safe: 0,
      warning: 1,
      danger: 2,
    },
    compareContractApprovalItemByRiskLevel: jest.fn(() => 0),
  }),
  { virtual: true },
);

jest.mock(
  '@rabby-wallet/biz-utils',
  () => ({
    approvalUtils: {
      RiskNumMap: {
        safe: 0,
        warning: 1,
        danger: 2,
      },
    },
  }),
  { virtual: true },
);

jest.mock('@/core/utils/linking', () => ({
  openExternalUrl: jest.fn(),
}));

jest.mock('@/utils/address', () => ({
  getAddressScanLink: jest.fn(
    (scanLink: string, address: string) => `${scanLink}/address/${address}`,
  ),
}));

const tokenApproval = {
  type: 'token',
  chain: 'eth',
  id: 'usdc',
} as any;

const tokenSpender = {
  id: 'spender-a',
} as any;

const contractApproval = {
  type: 'contract',
  chain: 'eth',
  id: 'root-spender',
} as any;

const erc721TokenSpender = {
  chain: 'eth',
  contract_id: '0xnft',
  inner_id: '42',
  is_erc721: true,
  is_erc1155: false,
  spender: { id: '0xspender' },
} as any;

const erc1155CollectionSpender = {
  chain: 'eth',
  contract_id: '0xcollection',
  contract_name: 'Rabby Collection',
  is_erc721: false,
  is_erc1155: true,
  spender: { id: '0xoperator' },
} as any;

const tokenRevoke = {
  approvalType: 'token',
  chainServerId: 'eth',
  tokenId: 'usdc',
  id: 'usdc',
  spender: 'spender-a',
} as any;

const nftTokenRevoke = {
  approvalType: 'contract',
  chainServerId: 'eth',
  contractId: '0xnft',
  spender: '0xspender',
  permit2Id: undefined,
  abi: 'ERC721',
  nftTokenId: '42',
  tokenId: undefined,
  isApprovedForAll: false,
  nftContractName: undefined,
} as any;

describe('BatchRevoke utils', () => {
  it('returns the first direct spender or the first spender from a spenders list', () => {
    expect(
      getFirstSpender({ spender: { id: 'direct-spender' } } as any),
    ).toEqual({ id: 'direct-spender' });
    expect(
      getFirstSpender({
        spenders: [{ id: 'first-spender' }, { id: 'second-spender' }],
      } as any),
    ).toEqual({ id: 'first-spender' });
    expect(getFirstSpender({} as any)).toBeUndefined();
  });

  it('round-trips revoke item query encoding and restores primitive-like values', () => {
    const encoded = encodeRevokeItem({
      ...nftTokenRevoke,
      permit2Id: null,
      isApprovedForAll: false,
    });

    expect(encoded.startsWith('revoke-item://?')).toBe(true);
    expect(decodeRevokeItem(encoded)).toMatchObject({
      approvalType: 'contract',
      chainServerId: 'eth',
      contractId: '0xnft',
      spender: '0xspender',
      permit2Id: null,
      abi: 'ERC721',
      nftTokenId: '42',
      tokenId: undefined,
      isApprovedForAll: false,
    });
  });

  it('finds token revoke records by spender, token and chain', () => {
    expect(
      findIndexRevokeList([tokenRevoke], {
        item: tokenApproval,
        spenderHost: tokenSpender,
      }),
    ).toBe(0);

    expect(
      findIndexRevokeList([{ ...tokenRevoke, chainServerId: 'arb' }], {
        item: tokenApproval,
        spenderHost: tokenSpender,
      }),
    ).toBe(-1);
  });

  it('finds individual contract NFT revoke records by contract, token id, abi and chain', () => {
    expect(
      findIndexRevokeList([nftTokenRevoke], {
        item: contractApproval,
        spenderHost: erc721TokenSpender,
        itemIsContractApproval: true,
      }),
    ).toBe(0);

    expect(
      findIndexRevokeList([{ ...nftTokenRevoke, nftTokenId: '43' }], {
        item: contractApproval,
        spenderHost: erc721TokenSpender,
        itemIsContractApproval: true,
      }),
    ).toBe(-1);
  });

  it('finds contract collection revoke records by collection name and approved-for-all scope', () => {
    const collectionRevoke = {
      approvalType: 'contract',
      chainServerId: 'eth',
      contractId: '0xcollection',
      spender: '0xoperator',
      permit2Id: undefined,
      abi: 'ERC1155',
      nftContractName: 'Rabby Collection',
      nftTokenId: null,
      isApprovedForAll: true,
    } as any;

    expect(
      findIndexRevokeList([collectionRevoke], {
        item: contractApproval,
        spenderHost: erc1155CollectionSpender,
        itemIsContractApproval: true,
      }),
    ).toBe(0);
    expect(
      findIndexRevokeList(
        [{ ...collectionRevoke, nftContractName: 'Other Collection' }],
        {
          item: contractApproval,
          spenderHost: erc1155CollectionSpender,
          itemIsContractApproval: true,
        },
      ),
    ).toBe(-1);
  });

  it('compares token revoke items with chain included in identity', () => {
    expect(isSameRevokeItem(tokenRevoke, { ...tokenRevoke })).toBe(true);
    expect(
      isSameRevokeItem(tokenRevoke, { ...tokenRevoke, chainServerId: 'arb' }),
    ).toBe(false);
  });

  it('compares NFT revoke items with chain, approval scope and token metadata', () => {
    expect(isSameRevokeItem(nftTokenRevoke, { ...nftTokenRevoke })).toBe(true);
    expect(
      isSameRevokeItem(nftTokenRevoke, {
        ...nftTokenRevoke,
        chainServerId: 'arb',
      }),
    ).toBe(false);
    expect(
      isSameRevokeItem(nftTokenRevoke, {
        ...nftTokenRevoke,
        nftTokenId: '43',
      }),
    ).toBe(false);
  });
});
