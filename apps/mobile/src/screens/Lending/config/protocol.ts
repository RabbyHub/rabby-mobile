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
  [CustomMarket.proto_mainnet_v3]: 16_696_206_149,
  [CustomMarket.proto_plasma_v3]: 1_821_355_953,
  [CustomMarket.proto_megaeth_v3]: 1_020_486_081,
  [CustomMarket.proto_arbitrum_v3]: 668_203_617,
  [CustomMarket.proto_base_v3]: 641_514_772,
  [CustomMarket.proto_mantle_v3]: 554_384_274,
  [CustomMarket.proto_horizon_v3]: 438_759_845,
  [CustomMarket.proto_avalanche_v3]: 426_052_217,
  [CustomMarket.proto_lido_v3]: 228_763_153,
  [CustomMarket.proto_bnb_v3]: 207_575_532,
  [CustomMarket.proto_polygon_v3]: 154_980_088,
  [CustomMarket.proto_ink_v3]: 131_354_087,
  [CustomMarket.proto_xlayer_v3]: 57_983_835,
  [CustomMarket.proto_gnosis_v3]: 69_206_145,
  [CustomMarket.proto_optimism_v3]: 65_748_083,
  [CustomMarket.proto_linea_v3]: 17_756_751,
  [CustomMarket.proto_sonic_v3]: 8_297_397,
  [CustomMarket.proto_celo_v3]: 6_300_392,
  [CustomMarket.proto_scroll_v3]: 1_943_122,
  [CustomMarket.proto_zksync_v3]: 950_141,
  [CustomMarket.proto_metis_v3]: 301_953,
  [CustomMarket.proto_soneium_v3]: 161_023,
  [CustomMarket.proto_monad_v3]: 0,
};
