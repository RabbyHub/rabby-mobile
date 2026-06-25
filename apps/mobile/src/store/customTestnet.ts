import { useMemo } from 'react';

import { zCreate } from '@/core/utils/reexports';
import type {
  CustomTestnetAssetSectionData,
  CustomTestnetAssetSectionToken,
} from '@/types/customTestnetAssets';
import type {
  CustomTestnetTokenBase,
  TestnetChain,
} from '@/types/customTestnet';

type CustomTestnetSnapshot = {
  customTestnet: Record<string, TestnetChain>;
  customTokenList: CustomTestnetTokenBase[];
};

type CustomTestnetState = CustomTestnetSnapshot & {
  revision: number;
  setSnapshot(snapshot: CustomTestnetSnapshot): void;
};

const EMPTY_CUSTOM_TESTNET: Record<string, TestnetChain> = {};
const EMPTY_CUSTOM_TOKEN_LIST: CustomTestnetTokenBase[] = [];
const EMPTY_OWNER_ADDRESSES: string[] = [];

export const useCustomTestnetStore = zCreate<CustomTestnetState>(set => ({
  customTestnet: EMPTY_CUSTOM_TESTNET,
  customTokenList: EMPTY_CUSTOM_TOKEN_LIST,
  revision: 0,
  setSnapshot(snapshot) {
    set(state => ({
      customTestnet: snapshot.customTestnet,
      customTokenList: snapshot.customTokenList,
      revision: state.revision + 1,
    }));
  },
}));

export const syncCustomTestnetStore = (snapshot: CustomTestnetSnapshot) => {
  useCustomTestnetStore.getState().setSnapshot(snapshot);
};

export const buildCustomTestnetAssetSections = ({
  customTestnet,
  customTokenList,
  ownerAddresses = EMPTY_OWNER_ADDRESSES,
}: CustomTestnetSnapshot & {
  ownerAddresses?: string[];
}): CustomTestnetAssetSectionData[] => {
  return Object.values(customTestnet)
    .map(chain => {
      const tokens: CustomTestnetAssetSectionToken[] = customTokenList
        .filter(token => token.chainId === chain.id)
        .map(token => ({
          id: token.id,
          chainId: token.chainId,
          symbol: token.symbol,
          decimals: token.decimals,
        }));

      return {
        chain,
        ownerAddresses,
        tokens: [
          {
            id: chain.nativeTokenAddress,
            chainId: chain.id,
            symbol: chain.nativeTokenSymbol,
            decimals: chain.nativeTokenDecimals,
            isNative: true,
          },
          ...tokens,
        ],
      };
    })
    .filter(section => section.tokens.length > 0);
};

export const getCustomTestnetAssetSections = (
  ownerAddresses = EMPTY_OWNER_ADDRESSES,
) => {
  const { customTestnet, customTokenList } = useCustomTestnetStore.getState();

  return buildCustomTestnetAssetSections({
    customTestnet,
    customTokenList,
    ownerAddresses,
  });
};

export const useCustomTestnetAssetSectionsData = (
  ownerAddresses = EMPTY_OWNER_ADDRESSES,
) => {
  const customTestnet = useCustomTestnetStore(state => state.customTestnet);
  const customTokenList = useCustomTestnetStore(state => state.customTokenList);

  return useMemo(
    () =>
      buildCustomTestnetAssetSections({
        customTestnet,
        customTokenList,
        ownerAddresses,
      }),
    [customTestnet, customTokenList, ownerAddresses],
  );
};
