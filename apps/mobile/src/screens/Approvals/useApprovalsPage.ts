import React, { useState, useRef, useMemo } from 'react';

import useAsyncFn from 'react-use/lib/useAsyncFn';

import PQueue from 'p-queue/dist/index';

import { CHAINS_ENUM } from '@debank/common';
import {
  type AssetApprovalSpender,
  type AssetApprovalItem,
  type ContractApprovalItem,
  type NftApprovalItem,
  type TokenApprovalItem,
  type ApprovalSpenderItemToBeRevoked,
  getContractRiskEvaluation,
  makeComputedRiskAboutValues,
  markParentForAssetItemSpender,
  ApprovalItem,
} from '@rabby-wallet/biz-utils/dist/isomorphic/approval';

approvalUtils.setApprovalEnvsOnce({ appIsDev: __DEV__, appIsProd: !__DEV__ });

export {
  type AssetApprovalSpender,
  type AssetApprovalItem,
  type ContractApprovalItem,
  type NftApprovalItem,
  type TokenApprovalItem,
  type ApprovalSpenderItemToBeRevoked,
};

export type ApprovalAssetsItem =
  | approvalUtils.SpenderInNFTApproval
  | approvalUtils.SpenderInTokenApproval;

import { groupBy, sortBy, flatten, debounce } from 'lodash';
import useDebounceValue from '@/hooks/common/useDebounceValue';

import { useCurrentAccount } from '@/hooks/account';

import { openapi, testOpenapi } from '@/core/request';
import { approvalUtils } from '@rabby-wallet/biz-utils';
import { atom, useAtom, useAtomValue } from 'jotai';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useSheetModals } from '@/hooks/useSheetModal';
import {
  encodeApprovalKey,
  encodeApprovalSpenderKey,
  findIndexRevokeList,
  toRevokeItem,
} from './utils';

export const FILTER_TYPES = {
  contract: 'contract',
  assets: 'assets',
} as const;

const SAFE_LEVEL_MAP: Record<string, number> = {
  safe: 1,
  warning: 10,
  danger: 100,
};
function sortTokenOrNFTApprovalsSpenderList(
  approval: TokenApprovalItem | NftApprovalItem,
) {
  type Tmp =
    | TokenApprovalItem['list'][number]
    | NftApprovalItem['list'][number];
  approval.list = approval.list.sort((a: Tmp, b: Tmp) => {
    const risk_comparison =
      SAFE_LEVEL_MAP[b.risk_level] - SAFE_LEVEL_MAP[a.risk_level];
    if (risk_comparison !== 0) return risk_comparison;

    return (
      b.value - a.value ||
      // @ts-expect-error
      b.id - a.id ||
      // @ts-expect-error
      (b.protocol?.name ?? '') - (a.protocol?.name ?? '')
    );
  });
}

function sortAssetApproval<T extends ApprovalItem>(approvals: T[]) {
  const l = approvals.length;
  const dangerList: T[] = [];
  const warnList: T[] = [];
  const safeListProto: T[] = [];
  for (let i = 0; i < l; i++) {
    const item = approvals[i];
    if (item.risk_level === SAFE_LEVEL.warning) {
      warnList.push(item);
    } else if (item.risk_level === SAFE_LEVEL.danger) {
      dangerList.push(item);
    } else {
      safeListProto.push(item);
    }
  }

  const groupedSafeList = groupBy(safeListProto, item => item.chain);
  const sortedSafeList = sortBy(Object.values(groupedSafeList), 'length').map(
    e => sortBy(e, a => a.list.length).reverse(),
  );

  const safeList = flatten(sortedSafeList.reverse());
  const finalList = [...dangerList, ...warnList, ...safeList];

  return {
    dangerList,
    warnList,
    safeList,
    finalList,
  };
}

const SAFE_LEVEL: Record<string, string> = {
  safe: 'safe',
  warning: 'warning',
  danger: 'danger',
};

export function useApprovalsPageOnTop(options?: { isTestnet?: boolean }) {
  const { currentAccount } = useCurrentAccount();

  const [filterType, setFilterType] = useState<keyof typeof FILTER_TYPES>(
    __DEV__ ? 'contract' : 'contract',
  );

  const [skContract, setSKContract] = useState('');
  const [skAssets, setSKAssets] = useState('');

  const setSearchKw = React.useCallback(
    (nextVal: string) => {
      if (filterType === 'contract') {
        setSKContract(nextVal);
      } else {
        setSKAssets(nextVal);
      }
    },
    [filterType],
  );

  const debouncedSkContract = useDebounceValue(skContract, 250);
  const debouncedSkAssets = useDebounceValue(skAssets, 250);

  const queueRef = useRef(new PQueue({ concurrency: 40 }));

  const [isLoadingOnAsyncFn, setIsLoadingOnAsyncFn] = useState(false);
  const [approvalsData, setApprovalsData] = useState<{
    contractMap: Record<string, ContractApprovalItem>;
    tokenMap: Record<string, TokenApprovalItem>;
    nftMap: Record<string, NftApprovalItem>;
  }>({
    contractMap: {},
    tokenMap: {},
    nftMap: {},
  });
  const [{ loading: loadingMaybeWrong, error }, loadApprovals] =
    useAsyncFn(async () => {
      setIsLoadingOnAsyncFn(true);

      const openapiClient = options?.isTestnet ? testOpenapi : openapi;

      const userAddress = currentAccount!.address;
      const usedChainList = await openapiClient.usedChainList(userAddress);
      // const apiLevel = await getAPIConfig([], 'ApiLevel', false);
      const apiLevel = 0;
      const nextApprovalsData = {
        contractMap: {},
        tokenMap: {},
        nftMap: {},
      } as typeof approvalsData;

      await queueRef.current.clear();

      if (apiLevel < 1) {
        const nftAuthorizedQueryList = usedChainList.map(e => async () => {
          try {
            const data = await openapiClient.userNFTAuthorizedList(
              userAddress,
              e.id,
            );
            if (data.total) {
              data.contracts.forEach(contract => {
                const chainName = contract.chain;
                const contractId = contract.spender.id;
                const spender = contract.spender;

                const keyForNftFromContract = `${chainName}:${contractId}`;
                if (!nextApprovalsData.contractMap[keyForNftFromContract]) {
                  const $riskAboutValues = makeComputedRiskAboutValues(
                    'nft-contract',
                    spender,
                  );
                  nextApprovalsData.contractMap[keyForNftFromContract] = {
                    list: [],
                    chain: e.id,
                    type: 'contract',
                    contractFor: 'nft-contract',
                    $riskAboutValues,
                    $contractRiskEvaluation: getContractRiskEvaluation(
                      spender.risk_level,
                      $riskAboutValues,
                    ),
                    risk_level: spender.risk_level,
                    risk_alert: spender.risk_alert,
                    id: spender.id,
                    name: spender?.protocol?.name || 'Unknown',
                    logo_url: spender.protocol?.logo_url,
                  };
                }
                nextApprovalsData.contractMap[keyForNftFromContract].list.push(
                  contract,
                );

                const nftKey = `${chainName}:${contract.contract_id}`;
                if (!nextApprovalsData.nftMap[nftKey]) {
                  nextApprovalsData.nftMap[nftKey] = {
                    nftContract: contract,
                    list: [],
                    type: 'nft',
                    $riskAboutValues: makeComputedRiskAboutValues(
                      'nft-contract',
                      spender,
                    ),
                    risk_level: 'safe',
                    id: contract.contract_id,
                    name: contract.contract_name,
                    logo_url: (contract as any)?.collection?.logo_url,
                    amount: contract.amount,
                    chain: e.id,
                  };
                }
                nextApprovalsData.nftMap[nftKey].list.push(
                  markParentForAssetItemSpender(
                    spender,
                    nextApprovalsData.nftMap[nftKey],
                    nextApprovalsData.contractMap[keyForNftFromContract],
                    contract,
                  ),
                );
              });

              data.tokens.forEach(token => {
                const chainName = token.chain;
                const contractId = token.spender.id;
                const spender = token.spender;

                const contractNftKey = `${chainName}:${contractId}`;
                if (!nextApprovalsData.contractMap[contractNftKey]) {
                  const $riskAboutValues = makeComputedRiskAboutValues(
                    'nft',
                    spender,
                  );
                  nextApprovalsData.contractMap[contractNftKey] = {
                    list: [],
                    chain: e.id,
                    risk_level: spender.risk_level,
                    risk_alert: spender.risk_alert,
                    id: spender.id,
                    name: spender?.protocol?.name || 'Unknown',
                    logo_url: spender.protocol?.logo_url,
                    type: 'contract',
                    contractFor: 'nft',
                    $riskAboutValues,
                    $contractRiskEvaluation: getContractRiskEvaluation(
                      spender.risk_level,
                      $riskAboutValues,
                    ),
                  };
                }
                nextApprovalsData.contractMap[contractNftKey].list.push(token);

                const nftTokenKey = `${chainName}:${token.contract_id}:${token.inner_id}`;
                if (!nextApprovalsData.nftMap[nftTokenKey]) {
                  nextApprovalsData.nftMap[nftTokenKey] = {
                    nftToken: token,
                    list: [],
                    chain: e.id,
                    risk_level: 'safe',
                    id: token.contract_id,
                    name: token.contract_name,
                    logo_url:
                      token?.content || (token as any).collection?.logo_url,
                    type: 'nft',
                    $riskAboutValues: makeComputedRiskAboutValues(
                      'nft',
                      spender,
                    ),
                    amount: token.amount,
                  };
                }
                nextApprovalsData.nftMap[nftTokenKey].list.push(
                  markParentForAssetItemSpender(
                    spender,
                    nextApprovalsData.nftMap[nftTokenKey],
                    nextApprovalsData.contractMap[nftTokenKey],
                    token,
                  ),
                );
              });
            }
          } catch (error) {
            console.error('fetch userNFTAuthorizedList error', error);
          }
        });

        const tokenAuthorizedQueryList = usedChainList.map(e => async () => {
          try {
            const data = await openapiClient.tokenAuthorizedList(
              userAddress,
              e.id,
            );
            if (data.length) {
              data.forEach(token => {
                token.spenders.forEach(spender => {
                  const chainName = token.chain;
                  const contractId = spender.id;

                  const contractTokenKey = `${chainName}:${contractId}`;
                  if (!nextApprovalsData.contractMap[contractTokenKey]) {
                    const $riskAboutValues = makeComputedRiskAboutValues(
                      'token',
                      spender,
                    );
                    nextApprovalsData.contractMap[contractTokenKey] = {
                      list: [],
                      chain: token.chain,
                      risk_level: spender.risk_level,
                      risk_alert: spender.risk_alert,
                      id: spender.id,
                      name: spender?.protocol?.name || 'Unknown',
                      logo_url: spender.protocol?.logo_url,
                      type: 'contract',
                      contractFor: 'token',
                      $riskAboutValues,
                      $contractRiskEvaluation: getContractRiskEvaluation(
                        spender.risk_level,
                        $riskAboutValues,
                      ),
                    };
                  }
                  nextApprovalsData.contractMap[contractTokenKey].list.push(
                    token,
                  );

                  const tokenId = token.id;
                  const tokenKey = `${chainName}:${tokenId}`;
                  if (!nextApprovalsData.tokenMap[tokenKey]) {
                    nextApprovalsData.tokenMap[tokenKey] = {
                      list: [],
                      chain: e.id,
                      risk_level: 'safe',
                      id: token.id,
                      name: token.symbol,
                      logo_url: token.logo_url,
                      type: 'token',
                      $riskAboutValues: makeComputedRiskAboutValues(
                        'token',
                        spender,
                      ),
                      balance: token.balance,
                    };
                  }
                  nextApprovalsData.tokenMap[tokenKey].list.push(
                    markParentForAssetItemSpender(
                      spender,
                      nextApprovalsData.tokenMap[tokenKey],
                      nextApprovalsData.contractMap[contractTokenKey],
                      token,
                    ),
                  );
                });
              });
            }
          } catch (error) {
            console.error('fetch tokenAuthorizedList error:', error);
          }
        });
        await queueRef.current.addAll([
          ...nftAuthorizedQueryList,
          ...tokenAuthorizedQueryList,
        ]);
      }

      Object.values(nextApprovalsData.tokenMap).forEach(v =>
        sortTokenOrNFTApprovalsSpenderList(v),
      );
      Object.values(nextApprovalsData.nftMap).forEach(v =>
        sortTokenOrNFTApprovalsSpenderList(v),
      );

      setIsLoadingOnAsyncFn(false);

      setApprovalsData(nextApprovalsData);

      return [
        nextApprovalsData.contractMap,
        nextApprovalsData.tokenMap,
        nextApprovalsData.nftMap,
      ];
    }, [currentAccount?.address, options?.isTestnet]);

  const isLoading = isLoadingOnAsyncFn && loadingMaybeWrong;

  if (error) {
    console.debug('[useApprovalsPage] error', error);
  }

  const sortedContractList: ContractApprovalItem[] = useMemo(() => {
    if (approvalsData.contractMap) {
      const contractList = Object.values(approvalsData.contractMap);
      const l = contractList.length;
      const dangerList: ContractApprovalItem[] = [];
      const warnList: ContractApprovalItem[] = [];
      const safeList: ContractApprovalItem[] = [];
      for (let i = 0; i < l; i++) {
        const item = contractList[i];
        if (item.risk_level === SAFE_LEVEL.warning) {
          warnList.push(item);
        } else if (item.risk_level === SAFE_LEVEL.danger) {
          dangerList.push(item);
        } else {
          safeList.push(item);
        }
      }

      const groupedSafeList = groupBy(safeList, item => item.chain);
      const sortedSafeList = sortBy(
        Object.values(groupedSafeList),
        'length',
      ).map(e => sortBy(e, a => a.list.length).reverse());
      return [...dangerList, ...warnList, ...flatten(sortedSafeList.reverse())];
    }
    return [];
  }, [approvalsData.contractMap]);

  const {
    // sortedFlattenedAssetstList,
    sortedTokenApprovals,
    sortedNftApprovals,
  } = useMemo(() => {
    const tokenAssets = Object.values(approvalsData.tokenMap || {});
    const nftAssets = Object.values(approvalsData.nftMap || {});

    // const assetsList = [
    //   ...flatten(tokenAssets.map(item => item.list)),
    //   ...flatten(nftAssets.map(item => item.list)),
    // ] as AssetApprovalItem['list'][number][];

    return {
      // descending order by approved amounts
      sortedTokenApprovals: sortAssetApproval(tokenAssets).finalList,
      // descending order by approved amounts
      sortedNftApprovals: sortAssetApproval(nftAssets).finalList,
      // sortedFlattenedAssetstList: assetsList,
    };
    // return [...dangerList, ...warnList, ...flatten(sortedList.reverse())];
  }, [approvalsData.tokenMap, approvalsData.nftMap]);

  const {
    displaySortedContractList,
    displaySortedAssetApprovalList,
    // displaySortedFlattenedAssetsList,
  } = useMemo(() => {
    const result = {
      displaySortedContractList: sortedContractList,
      displaySortedAssetApprovalList: [] as (
        | TokenApprovalItem
        | NftApprovalItem
      )[],
      // displaySortedFlattenedAssetsList: sortedFlattenedAssetstList,
    };
    const trimmedSkContract = debouncedSkContract?.trim()?.toLowerCase();
    if (trimmedSkContract) {
      result.displaySortedContractList = sortedContractList.filter(e => {
        return [e.id, e.risk_alert || '', e.name, e.id, e.chain].some(i =>
          i.toLowerCase().includes(trimmedSkContract),
        );
      });
    }

    const trimmedSkAssets = debouncedSkAssets?.trim()?.toLowerCase();
    if (trimmedSkAssets) {
      result.displaySortedAssetApprovalList = [
        ...sortedTokenApprovals.filter(e => {
          return [e.id, e.risk_alert || '', e.name, e.id, e.chain].some(i =>
            i.toLowerCase().includes(trimmedSkAssets),
          );
        }),
        ...sortedNftApprovals.filter(e => {
          return [e.id, e.risk_alert || '', e.name, e.id, e.chain].some(i =>
            i.toLowerCase().includes(trimmedSkAssets),
          );
        }),
      ];
      // result.displaySortedFlattenedAssetsList =
      //   sortedFlattenedAssetstList.filter(e => {
      //     return [
      //       e.id,
      //       e.risk_alert || '',
      //       e.$assetParent?.name,
      //       e.id,
      //       e.$assetParent?.chain,
      //     ].some(i => i?.toLowerCase().includes(trimmedSkAssets));
      //   });
    } else {
      result.displaySortedAssetApprovalList = [
        ...sortedTokenApprovals,
        ...sortedNftApprovals,
      ];
    }

    return result;
  }, [
    sortedContractList,
    sortedTokenApprovals,
    sortedNftApprovals,
    debouncedSkContract,
    debouncedSkAssets,
  ]);

  return {
    isLoading,
    loadApprovals,
    skContract,
    skAssets,
    searchKw: filterType === 'contract' ? skContract : skAssets,
    setSearchKw,

    filterType,
    setFilterType,

    account: currentAccount,
    displaySortedContractList,
    displaySortedAssetApprovalList,
  };
}

export const ApprovalsPageContext = React.createContext<
  ReturnType<typeof useApprovalsPageOnTop>
>({
  isLoading: false,
  loadApprovals: async () => [],
  skContract: '',
  skAssets: '',
  searchKw: '',
  setSearchKw: () => {},
  filterType: 'contract',
  setFilterType: () => {},
  account: null,
  displaySortedContractList: [],
  displaySortedAssetApprovalList: [],
});

export function useApprovalsPage() {
  return React.useContext(ApprovalsPageContext);
}

const focusedApprovalAtom = atom<{
  contract: ContractApprovalItem | null;
  asset: AssetApprovalItem | null;
}>({
  contract: null,
  asset: null,
});

const sheetModalRefAtom = atom({
  approvalContractDetail: React.createRef<BottomSheetModal>(),
  approvalAssetDetail: React.createRef<BottomSheetModal>(),
});

export function useFocusedApprovalOnApprovals() {
  const [focusedApproval, setFocusedApproval] = useAtom(focusedApprovalAtom);
  const sheetModals = useAtomValue(sheetModalRefAtom);

  const sheetModalsOps = useSheetModals(sheetModals);
  const { toggleShowSheetModal } = sheetModalsOps;

  const toggleFocusedContractItem = React.useCallback(
    (contractItem?: ContractApprovalItem | null) => {
      if (contractItem) {
        toggleShowSheetModal('approvalContractDetail', true);
        setFocusedApproval(prev => ({ ...prev, contract: contractItem }));
      } else {
        toggleShowSheetModal('approvalContractDetail', 'destroy');
        setFocusedApproval(prev => ({ ...prev, contract: null }));
      }
    },
    [toggleShowSheetModal, setFocusedApproval],
  );

  const toggleFocusedAssetItem = React.useCallback(
    (assetItem?: AssetApprovalItem | null) => {
      if (assetItem) {
        toggleShowSheetModal('approvalAssetDetail', true);
        setFocusedApproval(prev => ({ ...prev, asset: assetItem }));
      } else {
        toggleShowSheetModal('approvalAssetDetail', 'destroy');
        setFocusedApproval(prev => ({ ...prev, asset: null }));
      }
    },
    [toggleShowSheetModal, setFocusedApproval],
  );

  return {
    ...sheetModalsOps,
    focusedApprovalContract: focusedApproval.contract,
    focusedApprovalAsset: focusedApproval.asset,
    toggleFocusedContractItem,
    toggleFocusedAssetItem,
  };
}

export type ToggleSelectApprovalSpenderCtx = {
  spender: AssetApprovalItem['list'][number];
};
const revokeAtom = atom<{
  contractSelection: Record<string, number>;
  contract: Record<string, ApprovalSpenderItemToBeRevoked>;
  assetsSelection: Record<string, number>;
  assets: Record<string, ApprovalSpenderItemToBeRevoked>;
}>({
  contractSelection: {},
  contract: {},
  assetsSelection: {},
  assets: {},
});
export function useRevokeValues() {
  const {
    contract: contractRevokeMap,
    contractSelection,
    assets: assetRevokeMap,
    assetsSelection,
  } = useAtomValue(revokeAtom);

  return {
    contractRevokeMap,
    contractSelection,
    assetRevokeMap,
    assetsSelection,
  };
}
export function useRevokeSpenders() {
  const [
    {
      contract: contractRevokeMap,
      contractSelection,
      assets: assetRevokeMap,
      assetsSelection,
    },
    setRevoke,
  ] = useAtom(revokeAtom);
  const toggleSelectContractSpender = React.useCallback(
    (
      ctx: ToggleSelectApprovalSpenderCtx & { approval: ContractApprovalItem },
    ) => {
      const spender = ctx.spender;
      const approval = ctx.approval;

      const approvalSpenderKey = encodeApprovalSpenderKey(
        spender.$assetContract!,
        spender.$assetToken!,
      );
      if (approvalSpenderKey) {
        setRevoke(prev => {
          const contract = { ...prev.contract };
          const contractSelection = { ...prev.contractSelection };
          const approvalItemKey = encodeApprovalKey(approval);

          contractSelection[approvalItemKey] =
            contractSelection[approvalItemKey] || 0;
          if (contract[approvalSpenderKey]) {
            contractSelection[approvalItemKey] -= Math.max(0, 1);
            delete contract[approvalSpenderKey];
          } else {
            contract[approvalSpenderKey] = toRevokeItem(
              spender.$assetContract!,
              spender.$assetToken!,
            )!;
            contractSelection[approvalItemKey] += 1;
          }
          return { ...prev, contractSelection, contract };
        });
      } else if (__DEV__) {
        console.warn(
          '[toggleSelectContractSpender] approvalSpenderKey is empty',
        );
      }
    },
    [setRevoke],
  );

  const toggleSelectAssetSpender = React.useCallback(
    (ctx: ToggleSelectApprovalSpenderCtx & { approval: AssetApprovalItem }) => {
      const spender = ctx.spender;
      const approval = ctx.approval;

      const approvalSpenderKey = encodeApprovalSpenderKey(
        spender.$assetContract!,
        spender.$assetToken!,
      );
      if (approvalSpenderKey) {
        setRevoke(prev => {
          const assets = { ...prev.assets };
          const assetsSelection = { ...prev.assetsSelection };
          const approvalItemKey = encodeApprovalKey(approval);

          assetsSelection[approvalItemKey] =
            assetsSelection[approvalItemKey] || 0;
          if (assets[approvalSpenderKey]) {
            assetsSelection[approvalItemKey] -= Math.max(0, 1);
            delete assets[approvalSpenderKey];
          } else {
            assets[approvalSpenderKey] = toRevokeItem(
              spender.$assetContract!,
              spender.$assetToken!,
            )!;
            assetsSelection[approvalItemKey] += 1;
          }
          return { ...prev, assetsSelection, assets };
        });
      } else if (__DEV__) {
        console.warn('[toggleSelectAssetSpender] approvalSpenderKey is empty');
      }
    },
    [setRevoke],
  );

  return {
    contractSelection,
    contractRevokeMap,
    toggleSelectContractSpender,
    assetsSelection,
    assetRevokeMap,
    toggleSelectAssetSpender,
  };
}
