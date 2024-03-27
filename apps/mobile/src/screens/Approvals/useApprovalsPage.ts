import React, {
  useState,
  useRef,
  useMemo,
  useEffect,
  useLayoutEffect,
} from 'react';

import useAsyncFn from 'react-use/lib/useAsyncFn';

import PQueue from 'p-queue/dist/index';

import { CHAINS_ENUM } from '@debank/common';
import {
  AssetApprovalItem,
  ContractApprovalItem as OriginalContractApprovalItem,
  NftApprovalItem as OriginalNftApprovalItem,
  TokenApprovalItem as OriginalTokenApprovalItem,
  getContractRiskEvaluation,
  makeComputedRiskAboutValues,
  markParentForAssetItemSpender,
} from '@rabby-wallet/biz-utils/dist/isomorphic/approval';

approvalUtils.setApprovalEnvsOnce({ appIsDev: __DEV__, appIsProd: !__DEV__ });

// TODO: maybe it's not necessary to patch the type, you can fallback to the Rc-version if field `logo_url` is not provided
export interface ContractApprovalItem extends OriginalContractApprovalItem {
  logo_url_rc?: React.FC<import('react-native-svg').SvgProps>;
}
export interface NftApprovalItem extends OriginalNftApprovalItem {
  logo_url_rc?: React.FC<import('react-native-svg').SvgProps>;
}
export interface TokenApprovalItem extends OriginalTokenApprovalItem {
  logo_url_rc?: React.FC<import('react-native-svg').SvgProps>;
}

import { groupBy, sortBy, flatten, debounce } from 'lodash';
import { default as RcIconUnknownNFT } from './icons/unknown-nft.svg';
import { default as RcIconUnknownToken } from './icons/token-default.svg';
import useDebounceValue from '@/hooks/common/useDebounceValue';

import { useCurrentAccount } from '@/hooks/account';
import { useAlias2 } from '@/hooks/alias';

import { openapi, testOpenapi } from '@/core/request';
import { preferenceService } from '@/core/services';
import { approvalUtils } from '@rabby-wallet/biz-utils';

const FILTER_TYPES = {
  contract: 'By Contracts',
  assets: 'By Assets',
} as const;

function sortTokenOrNFTApprovalsSpenderList(
  item: Record<string, TokenApprovalItem> | Record<string, NftApprovalItem>,
) {
  Object.keys(item).forEach(t => {
    item[t].list
      .sort((a, b) => b.value - a.value)
      .sort((a, b) => {
        const numMap: Record<string, number> = {
          safe: 1,
          warning: 10,
          danger: 100,
        };
        return numMap[b.risk_level] - numMap[a.risk_level];
      });
  });
}

export function useApprovalsPageOnTop(options?: { isTestnet?: boolean }) {
  const { currentAccount } = useCurrentAccount();
  const { currentAddr, chain } = useMemo(() => {
    const currentAddr = currentAccount?.address?.toLowerCase() || '';
    return {
      currentAddr,
      chain:
        preferenceService.getTokenApprovalChain(currentAddr) || CHAINS_ENUM.ETH,
    };
  }, [currentAccount?.address]);

  const [filterType, setFilterType] =
    useState<keyof typeof FILTER_TYPES>('contract');

  const [skContracts, setSKContracts] = useState('');
  const [skAssets, setSKAssets] = useState('');

  const setSearchKw = useMemo(
    () => (filterType === 'contract' ? setSKContracts : setSKAssets),
    [filterType],
  );
  const searchKw = useMemo(
    () => (filterType === 'contract' ? skContracts : skAssets),
    [filterType, skContracts, skAssets],
  );

  const debouncedSearchKw = useDebounceValue(searchKw, 250);

  useLayoutEffect(() => {
    // const vGridRef =
    //   filterType === 'contract' ? vGridRefContracts : vGridRefAsset;
    // if (vGridRef.current) {
    //   vGridRef.current?.scrollToItem({ columnIndex: 0 });
    //   vGridRef.current?.resetAfterRowIndex(0, true);
    // }
  }, [debouncedSearchKw, filterType]);

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

                if (
                  !nextApprovalsData.contractMap[`${chainName}:${contractId}`]
                ) {
                  const $riskAboutValues = makeComputedRiskAboutValues(
                    'nft-contract',
                    spender,
                  );
                  nextApprovalsData.contractMap[`${chainName}:${contractId}`] =
                    {
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
                nextApprovalsData.contractMap[
                  `${chainName}:${contractId}`
                ].list.push(contract);

                if (
                  !nextApprovalsData.nftMap[
                    `${chainName}:${contract.contract_id}`
                  ]
                ) {
                  nextApprovalsData.nftMap[
                    `${chainName}:${contract.contract_id}`
                  ] = {
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
                    logo_url:
                      (contract as any)?.collection?.logo_url ||
                      RcIconUnknownNFT,
                    amount: contract.amount,
                    chain: e.id,
                  };
                }
                nextApprovalsData.nftMap[
                  `${chainName}:${contract.contract_id}`
                ].list.push(
                  markParentForAssetItemSpender(
                    spender,
                    nextApprovalsData.nftMap[
                      `${chainName}:${contract.contract_id}`
                    ],
                    nextApprovalsData.contractMap[`${chainName}:${contractId}`],
                    contract,
                  ),
                );
              });

              data.tokens.forEach(token => {
                const chainName = token.chain;
                const contractId = token.spender.id;
                const spender = token.spender;

                if (
                  !nextApprovalsData.contractMap[`${token.chain}:${contractId}`]
                ) {
                  const $riskAboutValues = makeComputedRiskAboutValues(
                    'nft',
                    spender,
                  );
                  nextApprovalsData.contractMap[
                    `${token.chain}:${contractId}`
                  ] = {
                    list: [],
                    chain: e.id,
                    risk_level: spender.risk_level,
                    risk_alert: spender.risk_alert,
                    id: spender.id,
                    name: spender?.protocol?.name || 'Unknown',
                    logo_url: spender.protocol?.logo_url,
                    logo_url_rc: RcIconUnknownNFT,
                    type: 'contract',
                    contractFor: 'nft',
                    $riskAboutValues,
                    $contractRiskEvaluation: getContractRiskEvaluation(
                      spender.risk_level,
                      $riskAboutValues,
                    ),
                  };
                }
                nextApprovalsData.contractMap[
                  `${chainName}:${contractId}`
                ].list.push(token);

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
                    nextApprovalsData.contractMap[`${chainName}:${contractId}`],
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
                  if (
                    !nextApprovalsData.contractMap[`${chainName}:${contractId}`]
                  ) {
                    const $riskAboutValues = makeComputedRiskAboutValues(
                      'token',
                      spender,
                    );
                    nextApprovalsData.contractMap[
                      `${chainName}:${contractId}`
                    ] = {
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
                  nextApprovalsData.contractMap[
                    `${chainName}:${contractId}`
                  ].list.push(token);

                  const tokenId = token.id;

                  if (!nextApprovalsData.tokenMap[`${chainName}:${tokenId}`]) {
                    nextApprovalsData.tokenMap[`${chainName}:${tokenId}`] = {
                      list: [],
                      chain: e.id,
                      risk_level: 'safe',
                      id: token.id,
                      name: token.symbol,
                      logo_url: token.logo_url,
                      logo_url_rc: RcIconUnknownToken,
                      type: 'token',
                      $riskAboutValues: makeComputedRiskAboutValues(
                        'token',
                        spender,
                      ),
                      balance: token.balance,
                    };
                  }
                  nextApprovalsData.tokenMap[
                    `${chainName}:${tokenId}`
                  ].list.push(
                    markParentForAssetItemSpender(
                      spender,
                      nextApprovalsData.tokenMap[`${chainName}:${tokenId}`],
                      nextApprovalsData.contractMap[
                        `${chainName}:${contractId}`
                      ],
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

      sortTokenOrNFTApprovalsSpenderList(nextApprovalsData.tokenMap);
      sortTokenOrNFTApprovalsSpenderList(nextApprovalsData.nftMap);

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
    console.log('[useApprovalsPage] error', error);
  }

  const sortedContractList: ContractApprovalItem[] = useMemo(() => {
    if (approvalsData.contractMap) {
      const contractMapArr = Object.values(approvalsData.contractMap);
      const l = contractMapArr.length;
      const dangerList: ContractApprovalItem[] = [];
      const warnList: ContractApprovalItem[] = [];
      const safeList: ContractApprovalItem[] = [];
      const numMap: Record<string, string> = {
        safe: 'safe',
        warning: 'warning',
        danger: 'danger',
      };
      for (let i = 0; i < l; i++) {
        const item = contractMapArr[i];
        if (item.risk_level === numMap.warning) {
          warnList.push(item);
        } else if (item.risk_level === numMap.danger) {
          dangerList.push(item);
        } else {
          safeList.push(item);
        }
      }

      const groupedSafeList = groupBy(safeList, item => item.chain);
      const sorted = sortBy(Object.values(groupedSafeList), 'length');
      const sortedList = sorted.map(e =>
        sortBy(e, a => a.list.length).reverse(),
      );
      return [...dangerList, ...warnList, ...flatten(sortedList.reverse())];
    }
    return [];
  }, [approvalsData.contractMap]);

  useEffect(() => {
    // setTimeout(() => {
    //   resetTableRenderer(vGridRefContracts);
    // }, 200);
  }, [sortedContractList]);

  const sortedAssetstList = useMemo(() => {
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
    // return [...dangerList, ...warnList, ...flatten(sortedList.reverse())];
  }, [approvalsData.tokenMap, approvalsData.nftMap]);

  useEffect(() => {
    // setTimeout(() => {
    //   resetTableRenderer(vGridRefAsset);
    // }, 200);
  }, [sortedAssetstList]);

  const { displaySortedContractList, displaySortedAssetsList } = useMemo(() => {
    if (!debouncedSearchKw || debouncedSearchKw.trim() === '') {
      return {
        displaySortedContractList: sortedContractList,
        displaySortedAssetsList: sortedAssetstList,
      };
    }

    const keywords = debouncedSearchKw.toLowerCase();
    return {
      displaySortedContractList: sortedContractList.filter(e => {
        return [e.id, e.risk_alert || '', e.name, e.id, e.chain].some(i =>
          i.toLowerCase().includes(keywords),
        );
      }),
      displaySortedAssetsList: sortedAssetstList.filter(e => {
        return [
          e.id,
          e.risk_alert || '',
          e.$assetParent?.name,
          e.id,
          e.$assetParent?.chain,
        ].some(i => i?.toLowerCase().includes(keywords));
      }),
    };
  }, [sortedContractList, sortedAssetstList, debouncedSearchKw]);

  return {
    isLoading,
    loadApprovals,
    searchKw,
    debouncedSearchKw,
    setSearchKw,

    filterType,
    setFilterType,

    account: currentAccount,
    chain,
    displaySortedContractList,
    displaySortedAssetsList,
  };
}

export const ApprovalsPageContext = React.createContext<
  ReturnType<typeof useApprovalsPageOnTop>
>({
  isLoading: false,
  loadApprovals: async () => [],
  searchKw: '',
  debouncedSearchKw: '',
  setSearchKw: () => {},
  filterType: 'contract',
  setFilterType: () => {},
  account: null,
  chain: CHAINS_ENUM.ETH,
  displaySortedContractList: [],
  displaySortedAssetsList: [],
});

export function useApprovalsPage() {
  return React.useContext(ApprovalsPageContext);
}
