import type { Chain } from '@debank/common';
import type { ChainRaw } from '@debank/common/dist/chain-data';
import type { Dictionary } from 'lodash';
import { SupportedChain } from '@rabby-wallet/rabby-api/dist/types';

const intToHex = (n: number) => {
  if (n % 1 !== 0) {
    throw new Error(`${n} is not int`);
  }
  return `0x${n.toString(16)}`;
};

export function supportedChainToChain(
  item: SupportedChain,
  chainByServerId: Dictionary<ChainRaw> /* = keyBy(CHAINS_RAW_LIST, 'serverId') */,
): Chain {
  return {
    id: item.community_id,
    enum: chainByServerId[item.id]?.enum || item.id.toUpperCase(),
    name: item.name,
    serverId: item.id,
    hex: intToHex(item.community_id),
    network: item.community_id + '',
    nativeTokenSymbol: item.native_token?.symbol,
    nativeTokenLogo: item.native_token?.logo,
    nativeTokenDecimals: item.native_token?.decimals,
    nativeTokenAddress: item.native_token?.id,
    needEstimateGas: item.need_estimate_gas,
    scanLink: `${item.explorer_host}/${
      item.id === 'heco' ? 'transaction' : 'tx'
    }/_s_`,
    logo: item.logo_url,
    whiteLogo: item.white_logo_url,
    eip: {
      '1559': item.eip_1559,
    },
  };
}
