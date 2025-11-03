import { CHAINS_ENUM } from '@debank/common';

const wrapperToken = {
  [CHAINS_ENUM.ETH]: {
    name: 'Wrapped Ether',
    symbol: 'WETH',
    address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  },
};

export default wrapperToken;
