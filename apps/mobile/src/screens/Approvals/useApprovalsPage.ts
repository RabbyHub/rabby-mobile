import React, { useState, useRef, useMemo, useEffect } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';

import PQueue from 'p-queue';

import {
  type AssetApprovalSpender,
  type AssetApprovalItem,
  type ContractApprovalItem,
  type NftApprovalItem,
  type TokenApprovalItem,
  type ApprovalSpenderItemToBeRevoked,
  getContractRiskEvaluation,
  markContractTokenSpender,
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

import { groupBy, sortBy, flatten } from 'lodash';
import { useDebouncedValue } from '@/hooks/common/delayLikeValue';

import { openapi, testOpenapi } from '@/core/request';
import { approvalUtils } from '@rabby-wallet/biz-utils';
import { atom, useAtom, useAtomValue } from 'jotai';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useSheetModals } from '@/hooks/useSheetModal';
import {
  type RevokeItemDict,
  type ApprovalProcessType,
  makeApprovalIndexURLBase,
  encodeApprovalSpenderKey,
  parseApprovalSpenderSelection,
  toRevokeItem,
  reEvaluateContractRisk,
  sortContractListAsTable,
} from './utils';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { ApprovalsLayouts } from './layout';
import { Account } from '@/core/services/preference';

export const FILTER_TYPES = {
  contract: 'contract',
  assets: 'assets',
  EIP7702: 'EIP7702',
} as const;

const SAFE_LEVEL: Record<string, string> = {
  safe: 'safe',
  warning: 'warning',
  danger: 'danger',
};
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

function sortContractApproval<T extends ContractApprovalItem>(
  contractApprovals: T[],
) {
  const l = contractApprovals.length;
  const lists = {
    danger2List: [] as ContractApprovalItem[],
    danger1List: [] as ContractApprovalItem[],
    warn2List: [] as ContractApprovalItem[],
    warn1List: [] as ContractApprovalItem[],
  };
  const safeList = [] as ContractApprovalItem[];
  for (let i = 0; i < l; i++) {
    const item = contractApprovals[i];
    const evals = reEvaluateContractRisk(item);
    if (evals.serverLevel === 'danger' && evals.clientLevel === 'danger') {
      lists.danger2List.push(item);
    } else if (
      evals.serverLevel === 'danger' &&
      evals.clientLevel === 'warning'
    ) {
      lists.danger1List.push(item);
    } else if (
      evals.serverLevel === 'danger' ||
      evals.clientLevel === 'danger'
    ) {
      lists.warn2List.push(item);
    } else if (
      evals.serverLevel === 'warning' ||
      evals.clientLevel === 'warning'
    ) {
      lists.warn1List.push(item);
    } else {
      safeList.push(item);
    }
  }

  const groupedSafeList = groupBy(safeList, item => item.chain);
  const sortedSafeList = sortBy(Object.values(groupedSafeList), 'length').map(
    e => sortBy(e, a => a.list.length).reverse(),
  );
  return [
    ...Object.values(lists).reduce(
      (acc, l) => acc.concat(l.sort(sortContractListAsTable)),
      [] as ContractApprovalItem[],
    ),
    ...flatten(sortedSafeList.reverse()).sort(sortContractListAsTable),
  ];
}

export function useApprovalsPageOnTop(options: {
  isTestnet?: boolean;
  account: Account | null;
}) {
  const { account: currentAccount } = options;
  const [filterType, setFilterType] = useState<keyof typeof FILTER_TYPES>(
    __DEV__ ? 'contract' : 'contract',
  );

  const [searchKw, setSearchKw] = useState('');

  const debouncedSkContract = useDebouncedValue(searchKw, 250);
  const debouncedSkAssets = useDebouncedValue(searchKw, 250);

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
                    nextApprovalsData.contractMap[contractNftKey],
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
              { restfulPrefix: 'v2' },
            );
            if (data.length) {
              data.forEach(token => {
                token.spenders.forEach(spender => {
                  const shapedToken = markContractTokenSpender(token, spender);
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
                    shapedToken,
                  );

                  const tokenId = shapedToken.id;
                  const tokenKey = `${chainName}:${tokenId}`;
                  if (!nextApprovalsData.tokenMap[tokenKey]) {
                    nextApprovalsData.tokenMap[tokenKey] = {
                      list: [],
                      chain: e.id,
                      risk_level: 'safe',
                      id: shapedToken.id,
                      name: shapedToken.symbol,
                      logo_url: shapedToken.logo_url,
                      type: 'token',
                      $riskAboutValues: makeComputedRiskAboutValues(
                        'token',
                        spender,
                      ),
                      balance: shapedToken.balance,
                    };
                  }
                  nextApprovalsData.tokenMap[tokenKey].list.push(
                    markParentForAssetItemSpender(
                      spender,
                      nextApprovalsData.tokenMap[tokenKey],
                      nextApprovalsData.contractMap[contractTokenKey],
                      shapedToken,
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

      return sortContractApproval(contractList);
    }
    return [];
  }, [approvalsData.contractMap]);

  const sortedAssetsList = useMemo(() => {
    const assetsList = [
      ...flatten(
        Object.values(approvalsData.tokenMap || {}).map(
          (item: TokenApprovalItem) => item.list,
        ),
      ),
      ...flatten(
        Object.values(approvalsData.nftMap || {}).map(item => item.list),
      ),
    ] as AssetApprovalItem['list'][number][];

    return assetsList;
  }, [approvalsData.tokenMap, approvalsData.nftMap]);

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

  const { resetRevokeMaps } = useRevokeApprovals();

  useEffect(() => {
    resetRevokeMaps();
  }, [currentAccount?.address, approvalsData, resetRevokeMaps]);

  const safeSizeInfo = useSafeAndroidBottomSizes({
    bottomAreaHeight: ApprovalsLayouts.bottomAreaHeight,
    bottomSheetConfirmAreaHeight: ApprovalsLayouts.bottomSheetConfirmAreaHeight,
  });

  return {
    isLoading,
    loadApprovals,
    contractEmptyStatus: useMemo(() => {
      if (!sortedContractList.length) return 'none' as const;

      if (!displaySortedContractList.length) return 'no-matched' as const;

      return false;
    }, [sortedContractList, displaySortedContractList]),
    assetEmptyStatus: useMemo(() => {
      if (!sortedTokenApprovals.length && !sortedNftApprovals.length)
        return 'none' as const;

      if (!displaySortedAssetApprovalList.length) return 'no-matched' as const;

      return false;
    }, [
      sortedTokenApprovals,
      sortedNftApprovals,
      displaySortedAssetApprovalList,
    ]),
    searchKw,
    setSearchKw,

    filterType,
    setFilterType,

    account: currentAccount,
    displaySortedContractList,
    displaySortedAssetApprovalList,
    safeSizeInfo,
    displaySortedAssetsList: sortedAssetsList,
  };
}

export const ApprovalsPageContext = React.createContext<
  ReturnType<typeof useApprovalsPageOnTop>
>({
  isLoading: false,
  loadApprovals: async () => [],
  contractEmptyStatus: false,
  assetEmptyStatus: false,
  searchKw: '',
  setSearchKw: () => {},
  filterType: 'contract',
  setFilterType: () => {},
  account: null,
  displaySortedContractList: [],
  displaySortedAssetApprovalList: [],
  safeSizeInfo: {
    androidBottomOffset: 0,
    safeSizes: {
      bottomAreaHeight: ApprovalsLayouts.bottomAreaHeight,
      bottomSheetConfirmAreaHeight:
        ApprovalsLayouts.bottomSheetConfirmAreaHeight,
    },
    cutOffSizes: {
      bottomAreaHeight: ApprovalsLayouts.bottomAreaHeight,
      bottomSheetConfirmAreaHeight:
        ApprovalsLayouts.bottomSheetConfirmAreaHeight,
    },
  },
  displaySortedAssetsList: [],
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

  const {
    contractFocusingRevokeMap,
    assetFocusingRevokeMap,
    startFocusApprovalRevokes,
    confirmSelectedRevoke,
  } = useRevokeApprovals();

  const toggleFocusedContractItem = React.useCallback(
    (
      options:
        | { contractItem: ContractApprovalItem }
        | {
            contractItemToBlur: ContractApprovalItem | null;
            isConfirmSelected?: boolean;
          },
    ) => {
      if ('contractItem' in options) {
        toggleShowSheetModal('approvalContractDetail', true);
        setFocusedApproval(prev => ({
          ...prev,
          contract: options.contractItem,
        }));
        startFocusApprovalRevokes('contract', options.contractItem);
      } else if (options.contractItemToBlur) {
        if (options.isConfirmSelected)
          confirmSelectedRevoke('contract', options.contractItemToBlur);
        setFocusedApproval(prev => ({ ...prev, contract: null }));
        toggleShowSheetModal('approvalContractDetail', 'destroy');
      }
    },
    [
      toggleShowSheetModal,
      setFocusedApproval,
      startFocusApprovalRevokes,
      confirmSelectedRevoke,
    ],
  );

  const toggleFocusedAssetItem = React.useCallback(
    (
      options:
        | { assetItem: AssetApprovalItem }
        | {
            assetItemToBlur: AssetApprovalItem | null;
            isConfirmSelected?: boolean;
          },
    ) => {
      if ('assetItem' in options) {
        toggleShowSheetModal('approvalAssetDetail', true);
        setFocusedApproval(prev => ({ ...prev, asset: options.assetItem }));
        startFocusApprovalRevokes('assets', options.assetItem);
      } else if (options.assetItemToBlur) {
        if (options.isConfirmSelected)
          confirmSelectedRevoke('assets', options.assetItemToBlur);
        setFocusedApproval(prev => ({ ...prev, asset: null }));
        toggleShowSheetModal('approvalAssetDetail', 'destroy');
      }
    },
    [
      toggleShowSheetModal,
      setFocusedApproval,
      startFocusApprovalRevokes,
      confirmSelectedRevoke,
    ],
  );

  return {
    ...sheetModalsOps,
    contractFocusingRevokeMap,
    focusedContractApproval: focusedApproval.contract,
    assetFocusingRevokeMap,
    focusedAssetApproval: focusedApproval.asset,
    toggleFocusedContractItem,
    toggleFocusedAssetItem,
  };
}

type RevokePickTarget = 'final' | 'focusing';
const DFLT_REVOKE = {
  contract: {},
  contractFocusing: {},
  assets: {},
  assetsFocusing: {},
};
const revokeAtom = atom<{
  contract: RevokeItemDict;
  contractFocusing: RevokeItemDict;
  assets: RevokeItemDict;
  assetsFocusing: RevokeItemDict;
}>({ ...DFLT_REVOKE });
export function useRevokeApprovals() {
  const [
    {
      contract: contractRevokeMap,
      contractFocusing: contractFocusingRevokeMap,
      assets: assetRevokeMap,
      assetsFocusing: assetFocusingRevokeMap,
    },
    setRevoke,
  ] = useAtom(revokeAtom);

  const resetRevokeMaps = React.useCallback(
    (type?: keyof typeof DFLT_REVOKE) => {
      switch (type) {
        case 'contract':
          setRevoke(prev => ({ ...prev, contract: {} }));
          break;
        case 'contractFocusing':
          setRevoke(prev => ({ ...prev, contractFocusing: {} }));
          break;
        case 'assets':
          setRevoke(prev => ({ ...prev, assets: {} }));
          break;
        case 'assetsFocusing':
          setRevoke(prev => ({ ...prev, assetsFocusing: {} }));
          break;
        default:
          setRevoke({ ...DFLT_REVOKE });
      }
    },
    [setRevoke],
  );

  const startFocusApprovalRevokes = React.useCallback(
    (
      type: ApprovalProcessType,
      approval: ContractApprovalItem | AssetApprovalItem,
    ) => {
      setRevoke(prev => {
        const result = parseApprovalSpenderSelection(
          approval,
          type,
          type === 'contract'
            ? {
                curAllSelectedMap: prev.contract,
              }
            : {
                curAllSelectedMap: prev.assets,
              },
        );

        return type === 'contract'
          ? {
              ...prev,
              contractFocusing: result.curSelectedMap,
            }
          : {
              ...prev,
              assetsFocusing: result.curSelectedMap,
            };
      });
    },
    [setRevoke],
  );
  const confirmSelectedRevoke = React.useCallback(
    (
      type: ApprovalProcessType,
      focusingApproval: ContractApprovalItem | AssetApprovalItem,
    ) => {
      setRevoke(prev => {
        const result = parseApprovalSpenderSelection(
          focusingApproval,
          type,
          type === 'contract'
            ? {
                curAllSelectedMap: prev.contract,
                nextKeepMap: prev.contractFocusing,
              }
            : {
                curAllSelectedMap: prev.assets,
                nextKeepMap: prev.assetsFocusing,
              },
        );

        return type === 'contract'
          ? {
              ...prev,
              contract: result.postSelectedMap,
              contractFocusing: {},
            }
          : {
              ...prev,
              assets: result.postSelectedMap,
              assetsFocusing: {},
            };
      });
    },
    [setRevoke],
  );

  return {
    contractRevokeMap,
    contractFocusingRevokeMap,

    assetRevokeMap,
    assetFocusingRevokeMap,

    startFocusApprovalRevokes,
    confirmSelectedRevoke,
    resetRevokeMaps,
  };
}
export function useRevokeContractSpenders() {
  const focusedApproval = useAtomValue(focusedApprovalAtom);
  const [revokes, setRevoke] = useAtom(revokeAtom);

  const toggleSelectContractSpender = React.useCallback(
    (
      ctx: {
        approval: ContractApprovalItem;
        contractApproval:
          | ContractApprovalItem['list'][number]
          | ContractApprovalItem['list'][number][]
          | null;
      },
      target: RevokePickTarget = 'final',
    ) => {
      const approval = ctx.approval;

      const revokeKey =
        target === 'final' ? 'contract' : ('contractFocusing' as const);

      if (!ctx.contractApproval) {
        const approvalIndexBase = makeApprovalIndexURLBase(approval);

        setRevoke(prev => {
          const contractRevokeMap = { ...prev[revokeKey] };

          Object.keys(contractRevokeMap).forEach(k => {
            if (k.startsWith(approvalIndexBase)) {
              delete contractRevokeMap[k];
            }
          });

          return { ...prev, [revokeKey]: contractRevokeMap };
        });
        return;
      }

      const contractList = Array.isArray(ctx.contractApproval)
        ? ctx.contractApproval
        : [ctx.contractApproval];
      const isToggledSingle = contractList.length === 1;

      setRevoke(prev => {
        const contractRevokeMap = { ...prev[revokeKey] };

        contractList.forEach(contract => {
          const contractRevokeKey = encodeApprovalSpenderKey(
            ctx.approval,
            contract,
            true,
          );
          if (!contractRevokeKey) {
            __DEV__ &&
              console.warn(
                '[toggleSelectContractSpender] contractRevokeKey is empty',
              );
            return;
          }
          if (isToggledSingle && contractRevokeMap[contractRevokeKey]) {
            delete contractRevokeMap[contractRevokeKey];
          } else {
            contractRevokeMap[contractRevokeKey] = toRevokeItem(
              approval,
              contract,
              true,
            )!;
          }
        });
        return { ...prev, [revokeKey]: contractRevokeMap };
      });
    },
    [setRevoke],
  );
  const { nextShouldPickAllFocusingContracts } = React.useMemo(() => {
    return {
      nextShouldPickAllFocusingContracts: !parseApprovalSpenderSelection(
        focusedApproval.contract,
        'contract',
        { curAllSelectedMap: revokes.contractFocusing },
      ).isSelectedAll,
    };
  }, [revokes.contractFocusing, focusedApproval.contract]);

  const onSelectAllContractApprovals = React.useCallback(
    (
      targetApproval: ContractApprovalItem,
      nextSelectAll: boolean,
      pickTarget: RevokePickTarget,
    ) => {
      if (!targetApproval) return;

      toggleSelectContractSpender(
        {
          approval: targetApproval,
          contractApproval: nextSelectAll ? targetApproval?.list || [] : null,
        },
        pickTarget,
      );
    },
    [toggleSelectContractSpender],
  );

  return {
    nextShouldPickAllFocusingContracts,
    contractRevokeMap: revokes.contract,
    toggleSelectContractSpender,
    onSelectAllContractApprovals,
  };
}

export type ToggleSelectApprovalSpenderCtx = {
  /** @description if only one spender provided, it will be treated as the one to be toggled selection */
  spender: null | AssetApprovalSpender | AssetApprovalSpender[];
  nextSelect?: boolean;
};
export function useRevokeAssetSpenders() {
  const focusedApproval = useAtomValue(focusedApprovalAtom);
  const [revokes, setRevoke] = useAtom(revokeAtom);

  const toggleSelectAssetSpender = React.useCallback(
    (
      ctx: ToggleSelectApprovalSpenderCtx & { approval: AssetApprovalItem },
      target: RevokePickTarget = 'final',
    ) => {
      const revokeKey =
        target === 'final' ? 'assets' : ('assetsFocusing' as const);

      const inputSpender = ctx.spender || [];
      let nextSelect = ctx.nextSelect;

      const spenders = (
        Array.isArray(inputSpender) ? inputSpender : [inputSpender]
      ).filter(Boolean) as AssetApprovalSpender[];
      const isToggledSingle = spenders.length === 1;

      setRevoke(prev => {
        const assetRevokeMap = { ...prev[revokeKey] };

        spenders.forEach(spender => {
          const revokeSpenderKey = encodeApprovalSpenderKey(
            spender.$assetContract!,
            spender.$assetToken!,
            spender,
          );

          if (isToggledSingle) nextSelect = !assetRevokeMap[revokeSpenderKey];

          if (!nextSelect) {
            delete assetRevokeMap[revokeSpenderKey];
          } else {
            assetRevokeMap[revokeSpenderKey] = toRevokeItem(
              spender.$assetContract!,
              spender.$assetToken!,
              spender,
            )!;
          }
        });

        return { ...prev, [revokeKey]: assetRevokeMap };
      });
    },
    [setRevoke],
  );
  const nextShouldPickAllFocusingAsset = React.useMemo(() => {
    const { isSelectedAll } = parseApprovalSpenderSelection(
      focusedApproval.asset,
      'assets',
      { curAllSelectedMap: revokes.assetsFocusing },
    );
    return !isSelectedAll;
  }, [revokes.assetsFocusing, focusedApproval.asset]);

  const onSelectAllAsset = React.useCallback(
    (
      targetApproval: AssetApprovalItem,
      nextSelectAll: boolean,
      pickTarget: RevokePickTarget,
    ) => {
      if (!targetApproval) return;

      toggleSelectAssetSpender(
        {
          approval: targetApproval,
          spender: targetApproval.list,
          nextSelect: nextSelectAll,
        },
        pickTarget,
      );
    },
    [toggleSelectAssetSpender],
  );

  return {
    assetRevokeMap: revokes.assets,
    toggleSelectAssetSpender,
    nextShouldPickAllFocusingAsset,
    onSelectAllAsset,
  };
}
