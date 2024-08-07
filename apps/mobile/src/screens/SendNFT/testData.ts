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
