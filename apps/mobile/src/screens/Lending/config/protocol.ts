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
  [CustomMarket.proto_mainnet_v3]: 9_525_303_942,
  [CustomMarket.proto_lido_v3]: 1_900_000_000,
  [CustomMarket.proto_plasma_v3]: 572_639_431,
  [CustomMarket.proto_arbitrum_v3]: 406_352_197,
  [CustomMarket.proto_base_v3]: 369_293_020,
  [CustomMarket.proto_horizon_v3]: 300_152_906,
  [CustomMarket.proto_avalanche_v3]: 254_201_580,
  [CustomMarket.proto_bnb_v3]: 154_643_937,
  [CustomMarket.proto_polygon_v3]: 108_943_371,
  [CustomMarket.proto_megaeth_v3]: 94_676_556,
  [CustomMarket.proto_mantle_v3]: 89_981_485,
  [CustomMarket.proto_xlayer_v3]: 57_983_835,
  [CustomMarket.proto_gnosis_v3]: 50_372_846,
  [CustomMarket.proto_optimism_v3]: 41_224_132,
  [CustomMarket.proto_linea_v3]: 11_153_659,
  [CustomMarket.proto_sonic_v3]: 7_731_824,
  [CustomMarket.proto_celo_v3]: 4_226_084,
  [CustomMarket.proto_scroll_v3]: 1_676_472,
  [CustomMarket.proto_zksync_v3]: 948_811,
  [CustomMarket.proto_metis_v3]: 289_046,
  [CustomMarket.proto_soneium_v3]: 155_290,
  [CustomMarket.proto_ink_v3]: 0,
};
