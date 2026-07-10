import { CHAINS_ENUM } from '@debank/common';
import { intToHex } from 'ethereumjs-util';
import type {
  TestnetChain,
  TestnetChainBase,
} from '@/types/customTestnet';

export const createTestnetChain = (
  chain: TestnetChainBase,
): TestnetChain => {
  return {
    ...chain,
    id: +chain.id,
    hex: intToHex(+chain.id),
    network: `${chain.id}`,
    enum: `CUSTOM_${chain.id}` as CHAINS_ENUM,
    serverId: `custom_${chain.id}`,
    nativeTokenAddress: `custom_${chain.id}`,
    nativeTokenDecimals: 18,
    nativeTokenLogo: '',
    scanLink: chain.scanLink || '',
    logo: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='16' fill='%236A7587'></circle><text x='16' y='17' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='12' font-weight='400'>${encodeURIComponent(
      chain.name.substring(0, 3),
    )}</text></svg>`,
    eip: {
      1559: false,
    },
    isTestnet: true,
    severity: 0,
  };
};
