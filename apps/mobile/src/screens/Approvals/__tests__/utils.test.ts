import {
  encodeApprovalKey,
  encodeApprovalSpenderKey,
  getAbiType,
  makeApprovalIndexURLBase,
  parseApprovalSpenderSelection,
  querySelectedAssetSpender,
  querySelectedContractSpender,
  toRevokeItem,
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

const parseKey = (key: string) => {
  const [path, query = ''] = key.split('?');
  return {
    path,
    query: Object.fromEntries(new URLSearchParams(query)),
  };
};

const tokenApproval = {
  type: 'token',
  chain: 'eth',
  id: 'usdc',
  list: [{ id: 'spender-a' }, { id: 'spender-b' }],
} as any;

const contractTokenApproval = {
  type: 'contract',
  chain: 'eth',
  id: 'root-spender',
  list: [],
} as any;

const erc721TokenSpender = {
  chain: 'eth',
  contract_id: '0xnft',
  inner_id: '42',
  is_erc721: true,
  is_erc1155: false,
  spender: { id: '0xspender' },
  $indexderSpender: {
    permit2_id: 'permit2-token',
  },
} as any;

const erc1155CollectionSpender = {
  chain: 'eth',
  contract_id: '0xcollection',
  contract_name: 'Rabby Collection',
  is_erc721: false,
  is_erc1155: true,
  spender: { id: '0xoperator' },
  $indexderSpender: {
    permit2_id: 'permit2-collection',
  },
} as any;

const nftTokenApproval = {
  type: 'nft',
  chain: 'eth',
  id: 'nft-token',
  nftToken: {
    contract_id: '0xnft',
    inner_id: '7',
    is_erc721: true,
    is_erc1155: false,
  },
  list: [{ id: '0xnft-spender' }],
} as any;

const nftCollectionApproval = {
  type: 'nft',
  chain: 'eth',
  id: 'nft-collection',
  nftContract: {
    contract_id: '0xcollection',
    is_erc721: false,
    is_erc1155: true,
  },
  list: [{ id: '0xcollection-spender' }],
} as any;

describe('Approvals utils', () => {
  it('encodes approval keys and index URLs by type, chain and id', () => {
    expect(encodeApprovalKey(tokenApproval)).toBe('token-eth-usdc');
    expect(makeApprovalIndexURLBase(tokenApproval)).toBe(
      'approval://token-eth-usdc',
    );
  });

  it('encodes token spender selection keys with token and spender identity', () => {
    const parsed = parseKey(
      encodeApprovalSpenderKey(tokenApproval, tokenApproval.list[0]),
    );

    expect(parsed.path).toBe('approval://token-eth-usdc/token/');
    expect(parsed.query).toEqual({
      spender: 'spender-a',
      chainServerId: 'eth',
      id: 'usdc',
    });
  });

  it('encodes contract NFT token spender keys with abi, token id and permit2 id', () => {
    const parsed = parseKey(
      encodeApprovalSpenderKey(contractTokenApproval, erc721TokenSpender, true),
    );

    expect(parsed.path).toBe(
      'approval://contract-eth-root-spender/contract-token/',
    );
    expect(parsed.query).toEqual({
      chainServerId: 'eth',
      contractId: '0xnft',
      permit2Id: 'permit2-token',
      spender: '0xspender',
      abi: 'ERC721',
      nftTokenId: '42',
      isApprovedForAll: 'false',
    });
  });

  it('encodes contract collection spender keys as approved-for-all', () => {
    const parsed = parseKey(
      encodeApprovalSpenderKey(
        contractTokenApproval,
        erc1155CollectionSpender,
        true,
      ),
    );

    expect(parsed.path).toBe('approval://contract-eth-root-spender/contract/');
    expect(parsed.query).toEqual({
      chainServerId: 'eth',
      contractId: '0xcollection',
      permit2Id: 'permit2-collection',
      spender: '0xoperator',
      abi: 'ERC1155',
      isApprovedForAll: 'true',
    });
  });

  it('encodes NFT token and collection spender keys with different approval scopes', () => {
    const tokenParsed = parseKey(
      encodeApprovalSpenderKey(nftTokenApproval, nftTokenApproval.list[0]),
    );
    const collectionParsed = parseKey(
      encodeApprovalSpenderKey(
        nftCollectionApproval,
        nftCollectionApproval.list[0],
      ),
    );

    expect(tokenParsed.query).toMatchObject({
      contractId: '0xnft',
      spender: '0xnft-spender',
      nftTokenId: '7',
      abi: 'ERC721',
      isApprovedForAll: 'false',
    });
    expect(collectionParsed.query).toMatchObject({
      contractId: '0xcollection',
      spender: '0xcollection-spender',
      nftTokenId: '',
      abi: 'ERC1155',
      isApprovedForAll: 'true',
    });
  });

  it('derives revoke payloads for token, NFT token and NFT collection approvals', () => {
    expect(toRevokeItem(tokenApproval, tokenApproval.list[0])).toEqual({
      approvalType: 'token',
      chainServerId: 'eth',
      tokenId: 'spender-a',
      id: 'usdc',
      spender: 'spender-a',
    });

    expect(toRevokeItem(nftTokenApproval, nftTokenApproval.list[0])).toEqual({
      approvalType: 'nft',
      chainServerId: 'eth',
      contractId: '0xnft',
      spender: '0xnft-spender',
      nftTokenId: '7',
      abi: 'ERC721',
      isApprovedForAll: false,
    });

    expect(
      toRevokeItem(nftCollectionApproval, nftCollectionApproval.list[0]),
    ).toEqual({
      approvalType: 'nft',
      chainServerId: 'eth',
      contractId: '0xcollection',
      spender: '0xcollection-spender',
      nftTokenId: null,
      abi: 'ERC1155',
      isApprovedForAll: true,
    });
  });

  it('derives contract revoke payloads for individual NFT tokens and collections', () => {
    expect(
      toRevokeItem(contractTokenApproval, erc721TokenSpender, true),
    ).toEqual({
      approvalType: 'contract',
      chainServerId: 'eth',
      contractId: '0xnft',
      permit2Id: 'permit2-token',
      spender: '0xspender',
      abi: 'ERC721',
      nftTokenId: '42',
      isApprovedForAll: false,
    });

    expect(
      toRevokeItem(contractTokenApproval, erc1155CollectionSpender, true),
    ).toEqual({
      approvalType: 'contract',
      chainServerId: 'eth',
      contractId: '0xcollection',
      permit2Id: 'permit2-collection',
      spender: '0xoperator',
      nftTokenId: null,
      nftContractName: 'Rabby Collection',
      abi: 'ERC1155',
      isApprovedForAll: true,
    });
  });

  it('parses selected spender maps and moves next-kept items into the post map', () => {
    const firstKey = encodeApprovalSpenderKey(
      tokenApproval,
      tokenApproval.list[0],
    );
    const secondKey = encodeApprovalSpenderKey(
      tokenApproval,
      tokenApproval.list[1],
    );
    const firstRevoke = toRevokeItem(tokenApproval, tokenApproval.list[0])!;
    const secondRevoke = toRevokeItem(tokenApproval, tokenApproval.list[1])!;

    const result = parseApprovalSpenderSelection(tokenApproval, 'contract', {
      curAllSelectedMap: {
        [firstKey]: firstRevoke,
      },
      nextKeepMap: {
        [secondKey]: secondRevoke,
      },
    });

    expect([...result.curSelectedSpenderKeys]).toEqual([firstKey]);
    expect(result.curSelectedMap).toEqual({ [firstKey]: firstRevoke });
    expect(result.isSelectedAll).toBe(false);
    expect(result.isSelectedPartial).toBe(true);
    expect(result.postSelectedMap).toEqual({ [secondKey]: secondRevoke });
  });

  it('queries selected contract and asset spender records by encoded spender key', () => {
    const contractRevoke = toRevokeItem(
      contractTokenApproval,
      erc721TokenSpender,
      true,
    )!;
    const contractKey = encodeApprovalSpenderKey(
      contractTokenApproval,
      erc721TokenSpender,
      true,
    );
    const assetSpender = {
      permit2_id: 'asset-permit2',
      $assetContract: contractTokenApproval,
      $assetToken: erc721TokenSpender,
    } as any;
    const assetRevoke = toRevokeItem(
      contractTokenApproval,
      erc721TokenSpender,
      assetSpender,
    )!;
    const assetKey = encodeApprovalSpenderKey(
      contractTokenApproval,
      erc721TokenSpender,
      assetSpender,
    );

    expect(
      querySelectedContractSpender(
        { [contractKey]: contractRevoke },
        contractTokenApproval,
        erc721TokenSpender,
      ),
    ).toEqual({ spenderKey: contractKey, spender: contractRevoke });
    expect(querySelectedContractSpender({}, contractTokenApproval, null)).toBe(
      null,
    );
    expect(
      querySelectedAssetSpender({ [assetKey]: assetRevoke }, assetSpender),
    ).toEqual({ spenderKey: assetKey, spender: assetRevoke });
    expect(
      querySelectedAssetSpender({}, { permit2_id: 'missing' } as any),
    ).toBe(null);
  });

  it('detects ERC approval ABI types from spender flags', () => {
    expect(getAbiType({ is_erc721: true } as any)).toBe('ERC721');
    expect(getAbiType({ is_erc1155: true } as any)).toBe('ERC1155');
    expect(getAbiType({} as any)).toBe('');
  });
});
