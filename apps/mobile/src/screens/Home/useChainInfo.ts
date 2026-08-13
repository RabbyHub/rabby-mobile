import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { assetsMapStore, computeAssetsApis } from './hooks/store';
import tokenStore from '@/store/tokens';
import { debounce } from 'lodash';
import { useCreationWithShallowCompare } from '@/hooks/common/useMemozied';
import { ChainListItem } from '@/components2024/SelectChainWithDistribute';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useProtocolListStore from '@/store/protocols';
import {
  balanceAccountsStore,
  getSelectedBalanceAddressesSnapshot,
} from '@/store/balance';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import {
  applyAddressChainDomainUpdates,
  computeChainDistribution,
  computeNftChainAssets,
  computePortfolioChainAssets,
  computeTokenChainAssets,
  getChangedAddressKeys,
  makeSingleAddressChainInfo,
  recomputeSingleAddressChainInfo,
  type AddressChainDomainUpdate,
  type SingleAddressChainInfo,
} from './singleAddressChainDistribution';
import {
  nowForSingleAddressChainProjection,
  recordSingleAddressChainProjection,
  type SingleAddressChainProjectionSource,
} from './singleAddressChainDiagnostics';

type FinalInfo = SingleAddressChainInfo;
const chainStaticsStore = zCreate<FinalInfo>(() => ({
  token: {},
  portfolio: {},
  nft: {},

  computedResult: {
    chainAssets: [],
    chainLength: 0,
    top3Chains: [],
  },
}));

function setFinalInfo(valOrFunc: UpdaterOrPartials<FinalInfo>) {
  chainStaticsStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    return newVal;
  });
}

const debounceComputeChainList = debounce(() => {
  setFinalInfo(computeChainsListV2(getSelectedBalanceAddressesSnapshot()));
}, 100);

export function getComputedChainInfo() {
  const baseInfo = chainStaticsStore.getState();
  return baseInfo.computedResult;
}

export function useTop3Chains() {
  const top3Chains = useActivityStore(
    chainStaticsStore,
    state => state.computedResult.top3Chains,
    Object.is,
    { storeLabel: 'home-chain-stats' },
  );

  return useCreationWithShallowCompare(() => top3Chains, [top3Chains]);
}

export const otherStore = zCreate(() => {
  return {
    selectedChainItem: undefined as ChainListItem | undefined,
  };
});

export function getSelectChainItem() {
  return otherStore.getState().selectedChainItem;
}

export function useSelectedChainItem() {
  return useActivityStore(
    otherStore,
    state => state.selectedChainItem,
    Object.is,
    { storeLabel: 'home-selected-chain' },
  );
}

export function setSelectChainItem(
  valOrFunc: UpdaterOrPartials<ChainListItem | undefined>,
) {
  otherStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.selectedChainItem, valOrFunc);

    return {
      ...prev,
      selectedChainItem: newVal,
    };
  });
}

const addrChainStaticsStore = zCreate<Record<string, FinalInfo>>(() => ({}));
function setAddressChainInfo(
  valOrFunc: UpdaterOrPartials<Record<string, FinalInfo>>,
) {
  addrChainStaticsStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    return newVal;
  });
}

export function useAddrChainLength(address?: string) {
  const addr = address?.toLowerCase();
  const chainLength =
    useActivityStore(
      addrChainStaticsStore,
      useShallow(s => (!addr ? 0 : s[addr]?.computedResult.chainLength || 0)),
      Object.is,
      { storeLabel: 'single-address-chain-stats' },
    ) || 0;
  return { chainLength };
}

export function useAddrTop3Chains(address?: string) {
  const addr = address?.toLowerCase();
  const defaultValue = useMemo(() => [], []);
  const top3Chains =
    useActivityStore(
      addrChainStaticsStore,
      s => (!addr ? defaultValue : s[addr]?.computedResult.top3Chains),
      Object.is,
      { storeLabel: 'single-address-chain-stats' },
    ) || defaultValue;
  return { top3Chains };
}

export function getAddrChainInfo(address: string) {
  const addr = address.toLowerCase();
  return (
    addrChainStaticsStore.getState()[addr] ||
    apisAddrChainStatics.makeFinalInfo()
  );
}

function updateAddressChainDomains(updates: AddressChainDomainUpdate[]) {
  if (!updates.length) {
    return false;
  }
  let changed = false;
  setAddressChainInfo(previousState => {
    const nextState = applyAddressChainDomainUpdates(previousState, updates);
    changed = nextState !== previousState;
    return nextState;
  });
  return changed;
}

function projectAddressChainDomains(options: {
  source: SingleAddressChainProjectionSource;
  addresses: string[];
  inputCount: number;
  makeUpdates: () => AddressChainDomainUpdate[];
}) {
  const startedAt = nowForSingleAddressChainProjection();
  const updates = options.makeUpdates();
  const projectedAt = nowForSingleAddressChainProjection();
  const changed = updateAddressChainDomains(updates);
  const publishedAt = nowForSingleAddressChainProjection();

  recordSingleAddressChainProjection({
    source: options.source,
    addressCount: options.addresses.length,
    inputCount: options.inputCount,
    changed,
    projectionMs: projectedAt - startedAt,
    publishMs: publishedAt - projectedAt,
    totalMs: publishedAt - startedAt,
  });

  return changed;
}

export const apisAddrChainStatics = {
  makeFinalInfo: makeSingleAddressChainInfo,
  computeChainAssetsToken: computeTokenChainAssets,
  computeChainAssetsPortfolio: computePortfolioChainAssets,
  computeChainAssetsNft: computeNftChainAssets,
  getComputedResultFromChainAssets: computeChainDistribution,
  recomputeFinalInfoFromChainUnits: recomputeSingleAddressChainInfo,
  updateToken: (
    address: string,
    tokens: Parameters<typeof computeTokenChainAssets>[0],
  ) => {
    updateAddressChainDomains([
      {
        address,
        domain: 'token',
        chainUnit: computeTokenChainAssets(tokens),
      },
    ]);
  },
  updatePortfolio: (
    address: string,
    portfolios: Parameters<typeof computePortfolioChainAssets>[0],
  ) => {
    updateAddressChainDomains([
      {
        address,
        domain: 'portfolio',
        chainUnit: computePortfolioChainAssets(portfolios),
      },
    ]);
  },
  updateNft: (
    address: string,
    nftList: Parameters<typeof computeNftChainAssets>[0],
  ) => {
    updateAddressChainDomains([
      {
        address,
        domain: 'nft',
        chainUnit: computeNftChainAssets(nftList),
      },
    ]);
  },
  syncAddress: (address: string) => {
    const normalizedAddress = address.toLowerCase();
    const tokens = tokenStore.getState().tokenListMap[normalizedAddress] || [];
    const portfolios =
      useProtocolListStore.getState().protocolMap[normalizedAddress] || [];
    const nfts = assetsMapStore.getState().nftsMap[normalizedAddress] || [];
    projectAddressChainDomains({
      source: 'sync-address',
      addresses: [normalizedAddress],
      inputCount: tokens.length + portfolios.length + nfts.length,
      makeUpdates: () => [
        {
          address: normalizedAddress,
          domain: 'token',
          chainUnit: computeTokenChainAssets(tokens),
        },
        {
          address: normalizedAddress,
          domain: 'portfolio',
          chainUnit: computePortfolioChainAssets(portfolios),
        },
        {
          address: normalizedAddress,
          domain: 'nft',
          chainUnit: computeNftChainAssets(nfts),
        },
      ],
    });
  },
};

/* computation section :start */
function computeChainsListV2(caredAddresses: string[]) {
  const caredAddressSet = new Set(
    caredAddresses.map(address => address.toLowerCase()),
  );
  const tokenListMap = tokenStore.getState().tokenListMap;
  const protocolList = useProtocolListStore.getState().protocolMap;
  const nftListMap = assetsMapStore.getState().nftsMap;
  const tokens = Object.entries(tokenListMap)
    .filter(([address]) => caredAddressSet.has(address.toLowerCase()))
    .flatMap(([, list]) => list || [])
    .filter(token => token.is_core);
  const portfolios = Object.entries(protocolList)
    .filter(([address]) => caredAddressSet.has(address.toLowerCase()))
    .flatMap(([, list]) => list || []);
  const nfts = computeAssetsApis.memoNfts(caredAddresses, nftListMap);
  const finalInfo = {
    token: computeTokenChainAssets(tokens),
    portfolio: computePortfolioChainAssets(portfolios),
    nft: computeNftChainAssets(nfts),
    computedResult: makeSingleAddressChainInfo().computedResult,
  };

  return {
    ...finalInfo,
    computedResult: recomputeSingleAddressChainInfo(finalInfo),
  };
}

let previousTokenListMap = tokenStore.getState().tokenListMap;
let previousProtocolMap = useProtocolListStore.getState().protocolMap;
let previousNftsMap = assetsMapStore.getState().nftsMap;

tokenStore.subscribe(state => {
  const nextTokenListMap = state.tokenListMap;
  if (nextTokenListMap === previousTokenListMap) {
    return;
  }
  const changedAddresses = getChangedAddressKeys(
    previousTokenListMap,
    nextTokenListMap,
  );
  previousTokenListMap = nextTokenListMap;
  projectAddressChainDomains({
    source: 'token-store',
    addresses: changedAddresses,
    inputCount: changedAddresses.reduce(
      (total, address) => total + (nextTokenListMap[address]?.length || 0),
      0,
    ),
    makeUpdates: () =>
      changedAddresses.map(address => ({
        address,
        domain: 'token',
        chainUnit: computeTokenChainAssets(nextTokenListMap[address] || []),
      })),
  });
  debounceComputeChainList();
});

useProtocolListStore.subscribe(state => {
  const nextProtocolMap = state.protocolMap;
  if (nextProtocolMap === previousProtocolMap) {
    return;
  }
  const changedAddresses = getChangedAddressKeys(
    previousProtocolMap,
    nextProtocolMap,
  );
  previousProtocolMap = nextProtocolMap;
  projectAddressChainDomains({
    source: 'protocol-store',
    addresses: changedAddresses,
    inputCount: changedAddresses.reduce(
      (total, address) => total + (nextProtocolMap[address]?.length || 0),
      0,
    ),
    makeUpdates: () =>
      changedAddresses.map(address => ({
        address,
        domain: 'portfolio',
        chainUnit: computePortfolioChainAssets(nextProtocolMap[address] || []),
      })),
  });
  debounceComputeChainList();
});

assetsMapStore.subscribe(state => {
  const nextNftsMap = state.nftsMap;
  if (nextNftsMap === previousNftsMap) {
    return;
  }
  const changedAddresses = getChangedAddressKeys(previousNftsMap, nextNftsMap);
  previousNftsMap = nextNftsMap;
  projectAddressChainDomains({
    source: 'nft-store',
    addresses: changedAddresses,
    inputCount: changedAddresses.reduce(
      (total, address) => total + (nextNftsMap[address]?.length || 0),
      0,
    ),
    makeUpdates: () =>
      changedAddresses.map(address => ({
        address,
        domain: 'nft',
        chainUnit: computeNftChainAssets(nextNftsMap[address] || []),
      })),
  });
  debounceComputeChainList();
});

balanceAccountsStore.subscribe(debounceComputeChainList);
