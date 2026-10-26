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
  [CustomMarket.proto_mainnet_v3]: 20_377_821_409,
  [CustomMarket.proto_plasma_v3]: 1_576_774_811,
  [CustomMarket.proto_base_v3]: 719_212_136,
  [CustomMarket.proto_arbitrum_v3]: 713_244_959,
  [CustomMarket.proto_monad_v3]: 652_313_708,
  [CustomMarket.proto_horizon_v3]: 368_363_585,
  [CustomMarket.proto_avalanche_v3]: 360_788_716,
  [CustomMarket.proto_mantle_v3]: 272_775_107,
  [CustomMarket.proto_lido_v3]: 253_424_566,
  [CustomMarket.proto_bnb_v3]: 228_327_159,
  [CustomMarket.proto_polygon_v3]: 168_686_509,
  [CustomMarket.proto_xlayer_v3]: 113_168_768,
  [CustomMarket.proto_ink_v3]: 106_260_218,
  [CustomMarket.proto_gnosis_v3]: 70_733_162,
  [CustomMarket.proto_optimism_v3]: 69_919_506,
  [CustomMarket.proto_megaeth_v3]: 34_731_789,
  [CustomMarket.proto_linea_v3]: 17_161_503,
  [CustomMarket.proto_sonic_v3]: 7_049_045,
  [CustomMarket.proto_celo_v3]: 4_235_815,
  [CustomMarket.proto_scroll_v3]: 2_105_713,
  [CustomMarket.proto_zksync_v3]: 806_105,
  [CustomMarket.proto_metis_v3]: 280_120,
  [CustomMarket.proto_soneium_v3]: 129_978,
};
