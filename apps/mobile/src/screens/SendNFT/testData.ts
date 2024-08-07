import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';

export const RABBY_GENESIS_NFT_DATA = {
  nftToken: {
    id: '31b1f7f8f9e00492ccb1c63e099562a9',
    contract_id: '0x1645787ddcb380932130f0d8c22e6bf53a38e725',
    inner_id: '14',
    chain: 'eth',
    name: 'Rabby Desktop Genesis 14',
    description:
      'Rabby Desktop is a dedicated client designed for enhanced Dapp security. \n\nRabby Desktop Genesis is the first NFT collection for Rabby Desktop, in celebration of the beta launch. Mint Rabby Desktop Genesis and get your badge to join the community of early adopters and be among the first to witness the evolution.',
    content_type: 'image_url',
    content:
      'https://static.debank.com/image/eth_nft/local_url/3aeea1d379b9d210d5e827ab68c89b66/2c260762ea8c4532d689661472bf83e2.png',
    thumbnail_url:
      'https://static.debank.com/image/eth_nft/thumbnail_url/3aeea1d379b9d210d5e827ab68c89b66/2c260762ea8c4532d689661472bf83e2.png',
    total_supply: '1',
    detail_url:
      'https://opensea.io/assets/0x1645787ddcb380932130f0d8c22e6bf53a38e725/14',
    attributes: [
      {
        trait_type: 'number',
        value: 14,
      },
      {
        trait_type: 'name',
        value: 'Rabby Desktop Genesis',
      },
    ],
    collection_id: 'eth:0x1645787ddcb380932130f0d8c22e6bf53a38e725',
    contract_name: 'Rabby Desktop Genesis',
    is_erc721: true,
    amount: 1,
  } as Omit<NFTItem, 'token_id' | 'usd_price' | 'pay_token'>,
};

export const DBK_GENESIS_NFT_DATA = {
  nftToken: {
    amount: 1,
    attributes: [
      {
        trait_type: 'name',
        value: 'DBK Genesis',
      },
    ],
    chain: 'dbk',
    collection_id: 'dbk:0x633b7472e1641d59334886a7692107d6332b1ff0',
    content:
      'https://static.debank.com/image/dbk_nft/local_url/be413498b9b3e8addcb9f9374ceaa268/7e2cc5a50cd961d737cb714c435c7c8b.png',
    content_type: 'image_url',
    contract_id: '0x633b7472e1641d59334886a7692107d6332b1ff0',
    contract_name: 'DBKGenesis',
    description: 'DBK Genesis',
    detail_url: null,
    id: '9e49f010dda2a2f0d25942269ce5cd82',
    inner_id: '1036440',
    is_erc721: true,
    name: 'DBK Genesis',
    thumbnail_url:
      'https://static.debank.com/image/dbk_nft/thumbnail_url/be413498b9b3e8addcb9f9374ceaa268/7e2cc5a50cd961d737cb714c435c7c8b.png',
    total_supply: 1,
  },
};
