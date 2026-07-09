import { CustomMarket } from './market';

export const keyToMarketKey: Record<string, CustomMarket> = {
  aave3: CustomMarket.proto_mainnet_v3,
  op_aave3: CustomMarket.proto_optimism_v3,
  avax_aave3: CustomMarket.proto_avalanche_v3,
  matic_aave3: CustomMarket.proto_polygon_v3,
  arb_aave3: CustomMarket.proto_arbitrum_v3,
  base_aave3: CustomMarket.proto_base_v3,
  bsc_aave3: CustomMarket.proto_bnb_v3,
  scrl_aave3: CustomMarket.proto_scroll_v3,
  plasma_aave3: CustomMarket.proto_plasma_v3,
  ink_aave3: CustomMarket.proto_ink_v3,
  era_aave3: CustomMarket.proto_zksync_v3,
  linea_aave3: CustomMarket.proto_linea_v3,
  sonic_aave3: CustomMarket.proto_sonic_v3,
  celo_aave3: CustomMarket.proto_celo_v3,
  xdai_aave3: CustomMarket.proto_gnosis_v3,
  megaeth_aave3: CustomMarket.proto_megaeth_v3,
  mnt_aave3: CustomMarket.proto_mantle_v3,
  xlayer_aave3: CustomMarket.proto_xlayer_v3,
  monad_aave3: CustomMarket.proto_monad_v3,
};

export const protocolIdToMarketKey = (protocolId?: string) => {
  if (!protocolId) {
    return undefined;
  }
  return keyToMarketKey[protocolId.toLowerCase()];
};

export const isAave3Portfolio = (project_id?: string) => {
  return !!protocolIdToMarketKey(project_id);
};

export const marketKeyToProtocolId = (marketKey?: CustomMarket) => {
  return Object.keys(keyToMarketKey).find(
    key => keyToMarketKey[key] === marketKey,
  );
};

// Snapshot used only as the first-pass selector order before user positions load.
export const marketTotalMarketSizeMap: Partial<Record<CustomMarket, number>> = {
  [CustomMarket.proto_mainnet_v3]: 17_706_262_953,
  [CustomMarket.proto_plasma_v3]: 1_708_674_933,
  [CustomMarket.proto_megaeth_v3]: 846_479_176,
  [CustomMarket.proto_arbitrum_v3]: 706_328_903,
  [CustomMarket.proto_base_v3]: 686_926_890,
  [CustomMarket.proto_mantle_v3]: 484_796_887,
  [CustomMarket.proto_avalanche_v3]: 432_495_323,
  [CustomMarket.proto_horizon_v3]: 368_413_815,
  [CustomMarket.proto_lido_v3]: 241_784_529,
  [CustomMarket.proto_bnb_v3]: 216_715_408,
  [CustomMarket.proto_monad_v3]: 208_345_434,
  [CustomMarket.proto_polygon_v3]: 164_399_878,
  [CustomMarket.proto_ink_v3]: 117_556_610,
  [CustomMarket.proto_xlayer_v3]: 85_257_616,
  [CustomMarket.proto_gnosis_v3]: 73_000_170,
  [CustomMarket.proto_optimism_v3]: 69_791_896,
  [CustomMarket.proto_linea_v3]: 19_375_993,
  [CustomMarket.proto_sonic_v3]: 8_131_523,
  [CustomMarket.proto_celo_v3]: 5_820_300,
  [CustomMarket.proto_scroll_v3]: 2_096_302,
  [CustomMarket.proto_zksync_v3]: 1_007_555,
  [CustomMarket.proto_metis_v3]: 299_891,
  [CustomMarket.proto_soneium_v3]: 170_041,
};
