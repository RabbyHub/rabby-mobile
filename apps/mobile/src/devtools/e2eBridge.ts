import {
  APP_RUNTIME_ENV,
  BUILD_GIT_INFO,
  IS_HERMES_ENABLED,
} from '@/constant/env';
import { RootNames } from '@/constant/layout';
import { runDevIIFEFunc } from '@/core/utils/store';
import { jotaiStore } from '@/core/utils/reexports';
import { switchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { sceneAccountInfoStore } from '@/hooks/sceneAccountInfoAtom';
import { sendScreenParamsAtom } from '@/hooks/useSendRoutes';
import { isValidAddress } from '@ethereumjs/util';
import BigNumber from 'bignumber.js';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import {
  apiSendToken,
  getSendChainToken,
  getSendTokenFormValues,
  getSendTokenScreenState,
  requestSendTokenFormPatch,
} from '@/screens/Send/hooks/useSendToken';
import accountStore from '@/store/account';
import addressBalanceStore, { balanceAccountsStore } from '@/store/balance';
import { balance24hStore, scene24hBalanceStore } from '@/store/balance24h';
import { addressCurve24hStore, sceneCurve24hStore } from '@/store/curve24h';
import {
  computeCurveBalanceChange,
  formChartData,
  formatSmallUsdValue,
  makeDefaultSelectData,
} from '@/store/curveShared';
import { formatUsdValue } from '@/utils/number';
import { findChainByEnum, findChainByServerID } from '@/utils/chain';
import { getLatestNavigationName, naviPush } from '@/utils/navigation';
import { apisSingleHome } from '@/screens/Home/hooks/singleHome';
import { getIsFoldMultiChart } from '@/screens/Address/components/MultiAssets/RenderRow/CurveChart';
import { getRecentSendPendingTxData } from '@/screens/Send/hooks/useRecentSend';

type DevtoolsMethod = (...args: any[]) => unknown;

function normalizeAddresses(addresses?: string[]) {
  return Array.from(
    new Set(
      (addresses || []).filter(Boolean).map(address => address.toLowerCase()),
    ),
  );
}

function normalizeAddress(address?: string | null) {
  return String(address || '')
    .trim()
    .toLowerCase();
}

function resolveSceneAccount(
  scene: keyof ReturnType<typeof sceneAccountInfoStore.getState>,
) {
  const sceneAccount = sceneAccountInfoStore.getState()[scene]?.currentAccount;
  if (!sceneAccount) {
    return null;
  }

  return (
    accountStore.getState().accounts.find(account => {
      return (
        normalizeAddress(account.address) ===
          normalizeAddress(sceneAccount.address) &&
        account.type === sceneAccount.type &&
        account.brandName === sceneAccount.brandName
      );
    }) || sceneAccount
  );
}

function resolveSendFromAccount(input?: {
  address?: string;
  type?: string;
  brandName?: string;
}) {
  const address = normalizeAddress(input?.address);
  if (!address) {
    throw new Error(
      '[RabbyDevToolsBridge] Send fixture is missing from.address',
    );
  }

  const matchedAccounts = accountStore.getState().accounts.filter(account => {
    return normalizeAddress(account.address) === address;
  });

  if (!matchedAccounts.length) {
    throw new Error(
      `[RabbyDevToolsBridge] No local account found for send.from.address=${input?.address}`,
    );
  }

  return (
    matchedAccounts.find(account => {
      return (
        (!input?.type || account.type === input.type) &&
        (!input?.brandName || account.brandName === input.brandName)
      );
    }) ||
    matchedAccounts.find(account => account.type !== KEYRING_CLASS.WATCH) ||
    matchedAccounts[0]
  );
}

function resolveSendChain(input?: string) {
  const chain = String(input || '').trim();
  if (!chain) {
    throw new Error(
      '[RabbyDevToolsBridge] Send fixture is missing token.chain',
    );
  }

  const resolved = findChainByServerID(chain) || findChainByEnum(chain as any);

  if (!resolved) {
    throw new Error(
      `[RabbyDevToolsBridge] Unsupported send token chain: ${input}`,
    );
  }

  return resolved;
}

function buildSendScreenSnapshot() {
  const routeName = getLatestNavigationName() || null;
  const screenState = getSendTokenScreenState();
  const formValues = getSendTokenFormValues();
  const { chainEnum, chainItem, currentToken } = getSendChainToken();
  const currentAccount = resolveSceneAccount('MakeTransactionAbout');
  const latestTx = getRecentSendPendingTxData();
  const canSubmit =
    !!formValues.to &&
    isValidAddress(formValues.to) &&
    !screenState.balanceError &&
    new BigNumber(formValues.amount || 0).gt(0) &&
    !screenState.isLoading;

  return {
    routeName,
    currentAccount: currentAccount
      ? {
          address: currentAccount.address,
          brandName: currentAccount.brandName,
          type: currentAccount.type,
          aliasName:
            'aliasName' in currentAccount
              ? currentAccount.aliasName
              : undefined,
        }
      : null,
    chain: chainItem
      ? {
          enum: chainEnum,
          serverId: chainItem.serverId,
          id: chainItem.id,
          name: chainItem.name,
        }
      : null,
    currentToken: currentToken
      ? {
          id: currentToken.id,
          chain: currentToken.chain,
          symbol: currentToken.symbol,
          name: currentToken.name,
          decimals: currentToken.decimals,
          amount: currentToken.amount,
          rawAmountHex: currentToken.raw_amount_hex_str,
        }
      : null,
    formValues: {
      to: formValues.to,
      amount: formValues.amount,
      messageDataForSendToEoa: formValues.messageDataForSendToEoa,
      messageDataForContractCall: formValues.messageDataForContractCall,
    },
    screenState: {
      inited: screenState.inited,
      isLoading: screenState.isLoading,
      showBalanceLoading: screenState.showBalanceLoading,
      balanceError: screenState.balanceError,
      balanceWarn: screenState.balanceWarn,
      isEstimatingGas: screenState.isEstimatingGas,
      isSubmitLoading: screenState.isSubmitLoading,
      selectedGasLevel: screenState.selectedGasLevel
        ? {
            level: screenState.selectedGasLevel.level,
            price: screenState.selectedGasLevel.price,
          }
        : null,
    },
    latestTx: latestTx
      ? {
          hash: latestTx.hash,
          status: latestTx.status,
          amount: latestTx.amount,
          from: latestTx.from,
          to: latestTx.to,
          chainId: latestTx.chainId,
          createdAt: latestTx.createdAt,
          completedAt: latestTx.completedAt || null,
          token: latestTx.token
            ? {
                id: latestTx.token.id,
                chain: latestTx.token.chain,
                symbol: latestTx.token.symbol,
                decimals: latestTx.token.decimals,
              }
            : null,
        }
      : null,
    computed: {
      canSubmit,
      hasToAddress: !!formValues.to,
      hasAmount: !!formValues.amount,
    },
  };
}

function buildHomeDisplayAddressesState() {
  const balanceState = balanceAccountsStore.getState();
  const accountState = accountStore.getState();
  const scene24hState = scene24hBalanceStore.getState();
  const selectedAddresses = normalizeAddresses(balanceState.selectedAddresses);
  const sceneAddresses = normalizeAddresses(scene24hState.addresses.Home);
  const displayAddresses = selectedAddresses.length
    ? selectedAddresses
    : sceneAddresses;

  return {
    selectedAddresses,
    sceneAddresses,
    displayAddresses,
    displaySource: selectedAddresses.length
      ? 'selected'
      : sceneAddresses.length
      ? 'scene24h'
      : 'empty',
    hasResolvedSelection: balanceState.hasResolvedSelection,
    matteredAccountLength: balanceState.matteredAccountLength,
    hasFetchedAccounts: accountState.hasFetchedAccounts,
    isFetchingAccounts: accountState.isFetchingAccounts,
    isPendingDisplayAddresses:
      !balanceState.hasResolvedSelection &&
      displayAddresses.length === 0 &&
      (!accountState.hasFetchedAccounts || accountState.isFetchingAccounts),
  };
}

function buildBalanceSummary(addresses: string[]) {
  const normalizedAddresses = normalizeAddresses(addresses);
  const snapshots = normalizedAddresses.map(address => {
    const value = addressBalanceStore.getAddressValue(address);
    const flow = addressBalanceStore.getAddressFlowState(address);

    return {
      address,
      value: value
        ? {
            totalBalance: value.totalBalance,
            evmBalance: value.evmBalance,
            chainListLength: value.chainList.length,
            isCore: value.isCore,
          }
        : null,
      flow,
    };
  });

  const loadingAddresses = snapshots
    .filter(item => item.flow.isLoading)
    .map(item => item.address);
  const missingAddresses = snapshots
    .filter(item => !item.flow.hasValue)
    .map(item => item.address);

  return {
    snapshots,
    flow: {
      addresses: normalizedAddresses,
      loadingAddresses,
      missingAddresses,
      hasAnyValue: snapshots.some(item => item.flow.hasValue),
      isAnyLoading: loadingAddresses.length > 0,
      isAnyLoadingWithoutValue: snapshots.some(
        item => item.flow.isLoadingWithoutValue,
      ),
      hasAllValues:
        normalizedAddresses.length > 0 && missingAddresses.length === 0,
    },
    totalBalance: snapshots.reduce((acc, item) => {
      return acc + (item.value?.totalBalance || 0);
    }, 0),
  };
}

function build24hCombinedData(addresses: string[]) {
  const normalizedAddresses = normalizeAddresses(addresses);
  const balanceMap = addressBalanceStore.getAddressValueMap();
  const balance24hMap = balance24hStore.getAddress24hBalanceMap();
  const comparableAddresses = normalizedAddresses.filter(address => {
    const lowerAddress = address.toLowerCase();
    return !!balance24hMap[lowerAddress] && !!balanceMap[lowerAddress];
  });
  const availableCurrentAddresses = normalizedAddresses.filter(address => {
    return !!balanceMap[address.toLowerCase()];
  });
  const list = comparableAddresses.map(address => {
    return balance24hMap[address.toLowerCase()];
  });
  const totalCurrentBalance = availableCurrentAddresses.reduce(
    (result, address) => {
      return result + (balanceMap[address.toLowerCase()]?.totalBalance || 0);
    },
    0,
  );
  const totalComparableEvmBalance = comparableAddresses.reduce(
    (result, address) => {
      return result + (balanceMap[address.toLowerCase()]?.evmBalance || 0);
    },
    0,
  );
  const total24hBalance = list.reduce((result, item) => {
    return result + (item?.total_usd_value || 0);
  }, 0);
  const canShowCurrentBalance = availableCurrentAddresses.length > 0;
  const canShowChange = comparableAddresses.length > 0;
  const assetsChange = canShowChange
    ? totalComparableEvmBalance - total24hBalance
    : 0;

  return {
    comparableAddresses,
    rawNetWorth: canShowCurrentBalance ? totalCurrentBalance : 0,
    netWorth: formatSmallUsdValue(totalCurrentBalance || 0),
    rawChange: assetsChange,
    change: `${formatUsdValue(Math.abs(assetsChange))}`,
    changePercent: canShowChange
      ? total24hBalance !== 0
        ? `${Math.abs((assetsChange * 100) / total24hBalance).toFixed(2)}%`
        : `${totalComparableEvmBalance === 0 ? '0' : '100.00'}%`
      : '',
    isLoss: canShowChange ? assetsChange < 0 : false,
    isEmptyAssets:
      canShowCurrentBalance &&
      totalCurrentBalance === 0 &&
      (!canShowChange || total24hBalance === 0),
    listLength: list.length,
  };
}

function build24hFlowSummary(addresses: string[]) {
  const normalizedAddresses = normalizeAddresses(addresses);
  const states = normalizedAddresses.map(address => {
    const flow = balance24hStore.getAddress24hBalanceFlowState(address);

    return {
      address,
      hasValue: flow.hasValue,
      isHydrating: flow.isHydrating,
      isFetchingRemote: flow.isFetchingRemote,
      isResourceLoading: flow.isLoading,
      isComputing: false,
      isLoading: flow.isLoading,
      isLoadingWithoutValue: flow.isLoadingWithoutValue,
      persistStatus: flow.persistStatus,
      lastError: flow.lastError,
    };
  });

  const loadingAddresses = states
    .filter(item => item.isLoading)
    .map(item => item.address);
  const missingAddresses = states
    .filter(item => !item.hasValue)
    .map(item => item.address);

  return {
    addresses: normalizedAddresses,
    states,
    flow: {
      addresses: normalizedAddresses,
      loadingAddresses,
      missingAddresses,
      computingAddresses: [] as string[],
      hasAnyValue: states.some(item => item.hasValue),
      isAnyLoading: loadingAddresses.length > 0,
      isAnyLoadingWithoutValue: states.some(item => item.isLoadingWithoutValue),
      hasAllValues:
        normalizedAddresses.length > 0 && missingAddresses.length === 0,
    },
  };
}

function buildSingleHomeSnapshot() {
  const currentAddress =
    apisSingleHome.getCurrentAddress()?.toLowerCase() || null;
  const routeName = getLatestNavigationName() || null;

  if (!currentAddress) {
    return {
      routeName,
      currentAddress: null,
      hasCurrentAddress: false,
    };
  }

  const balanceValue = addressBalanceStore.getAddressValue(currentAddress);
  const balanceFlow = addressBalanceStore.getAddressFlowState(currentAddress);
  const balance24hValue = balance24hStore.getAddress24hBalance(currentAddress);
  const balance24hFlow =
    balance24hStore.getAddress24hBalanceFlowState(currentAddress);
  const curveList = addressCurve24hStore.getAddressCurve(currentAddress) || [];
  const curveFlow =
    addressCurve24hStore.getAddressCurveFlowState(currentAddress);
  const isFoldChart = apisSingleHome.getFoldChart();

  const initialSelectData = curveList.length
    ? formChartData(curveList, {
        realtimeNetWorth: balanceValue?.evmBalance ?? 0,
        realtimeTimestamp: Date.now(),
        staticBalance: balanceValue?.totalBalance ?? 0,
        baseUsdValue: balance24hValue?.total_usd_value,
      })
    : makeDefaultSelectData();

  const selectData =
    initialSelectData.changePercent ||
    typeof balanceValue?.evmBalance !== 'number' ||
    typeof balance24hValue?.total_usd_value !== 'number'
      ? initialSelectData
      : (() => {
          const { assetsChange, changePercent } = computeCurveBalanceChange(
            balanceValue.evmBalance,
            balance24hValue.total_usd_value,
          );

          return {
            ...initialSelectData,
            rawChange: assetsChange,
            change: '',
            changePercent,
            isLoss: assetsChange < 0,
          };
        })();

  const balanceLoadingWithoutLocal = balanceFlow.isLoadingWithoutValue;
  const isLoadingChartData = curveFlow.isLoading || balanceLoadingWithoutLocal;
  const changeLoading =
    !balanceLoadingWithoutLocal &&
    !selectData.changePercent &&
    balance24hFlow.isLoading;

  return {
    routeName,
    currentAddress,
    hasCurrentAddress: true,
    balanceValue: balanceValue
      ? {
          totalBalance: balanceValue.totalBalance,
          evmBalance: balanceValue.evmBalance,
          chainListLength: balanceValue.chainList.length,
          isCore: balanceValue.isCore,
        }
      : null,
    balance24hValue: balance24hValue
      ? {
          totalUsdValue: balance24hValue.total_usd_value,
          updateTime: balance24hValue.updateTime,
        }
      : null,
    balanceFlow,
    balance24hFlow,
    curveFlow,
    uiState: {
      balanceLoadingWithoutLocal,
      isLoadingChartData,
      changeLoading,
    },
    curveUiState: {
      isFolded: isFoldChart,
      hasCurveData: curveList.length > 0,
      curvePointCount: curveList.length,
      isCurveLoading: curveFlow.isLoading,
      changeLoading,
      balanceLoadingWithoutLocal,
    },
    selectData: {
      netWorth: selectData.netWorth,
      rawChange: selectData.rawChange,
      changePercent: selectData.changePercent,
      isLoss: selectData.isLoss,
      listLength: selectData.list.length,
    },
  };
}

const bridgeMethods = {
  ping() {
    return {
      ok: true,
      runtimeEnv: APP_RUNTIME_ENV,
      isHermesEnabled: IS_HERMES_ENABLED,
      buildGitHash: BUILD_GIT_INFO.BUILD_GIT_HASH,
      routeName: getLatestNavigationName() || null,
      timestamp: Date.now(),
    };
  },
  getHomePortfolioSnapshot() {
    const routeName = getLatestNavigationName() || null;
    const displayAddressesState = buildHomeDisplayAddressesState();
    const balanceSummary = buildBalanceSummary(
      displayAddressesState.displayAddresses,
    );
    const changeSummary = build24hFlowSummary(
      displayAddressesState.displayAddresses,
    );
    const combined24hData = build24hCombinedData(
      displayAddressesState.displayAddresses,
    );
    const scene24hState = scene24hBalanceStore.getState();
    const sceneCurveState = sceneCurve24hStore.getState();
    const showBalanceLoadingWithoutLocal =
      displayAddressesState.isPendingDisplayAddresses ||
      (displayAddressesState.displayAddresses.length > 0 &&
        !balanceSummary.flow.hasAnyValue);
    const showChangeLoadingWithoutLocal =
      !showBalanceLoadingWithoutLocal &&
      !combined24hData.changePercent &&
      changeSummary.flow.isAnyLoadingWithoutValue &&
      displayAddressesState.displayAddresses.length > 0;
    const isHomeCurveFolded = getIsFoldMultiChart();

    return {
      routeName,
      displayAddressesState,
      uiState: {
        showBalanceLoadingWithoutLocal,
        showChangeLoadingWithoutLocal,
      },
      curveUiState: {
        isFolded: isHomeCurveFolded,
        hasCurveData: sceneCurveState.combinedData.Home.list.length > 0,
        curvePointCount: sceneCurveState.combinedData.Home.list.length,
        isCurveLoading:
          sceneCurveState.sceneLoading.Home ||
          sceneCurveState.sceneComputing.Home,
        changeLoading: showChangeLoadingWithoutLocal,
        balanceLoadingWithoutLocal: showBalanceLoadingWithoutLocal,
      },
      balanceAccountsState: {
        selectedAddresses: balanceAccountsStore.getState().selectedAddresses,
        hasResolvedSelection:
          balanceAccountsStore.getState().hasResolvedSelection,
        matteredAccountLength:
          balanceAccountsStore.getState().matteredAccountLength,
      },
      balanceSummary,
      changeSummary: {
        ...changeSummary,
        combinedData: combined24hData,
        hasAnyComparableValue: combined24hData.comparableAddresses.length > 0,
      },
      scene24hState: {
        addresses: scene24hState.addresses.Home,
        sceneLoading: scene24hState.sceneLoading.Home,
        sceneComputing: scene24hState.sceneComputing.Home,
        combinedData: {
          rawNetWorth: scene24hState.combinedData.Home.rawNetWorth,
          rawChange: scene24hState.combinedData.Home.rawChange,
          changePercent: scene24hState.combinedData.Home.changePercent,
          isLoss: scene24hState.combinedData.Home.isLoss,
          listLength: scene24hState.combinedData.Home.list.length,
        },
      },
      sceneCurveState: {
        addresses: sceneCurveState.addresses.Home,
        sceneLoading: sceneCurveState.sceneLoading.Home,
        sceneComputing: sceneCurveState.sceneComputing.Home,
        combinedData: {
          netWorth: sceneCurveState.combinedData.Home.netWorth,
          rawChange: sceneCurveState.combinedData.Home.rawChange,
          changePercent: sceneCurveState.combinedData.Home.changePercent,
          isLoss: sceneCurveState.combinedData.Home.isLoss,
          listLength: sceneCurveState.combinedData.Home.list.length,
        },
      },
    };
  },
  getSingleHomeSnapshot() {
    return buildSingleHomeSnapshot();
  },
  openSendScreen(input?: {
    from?: {
      address?: string;
      type?: string;
      brandName?: string;
    };
    to?: {
      address?: string;
      brandName?: string;
    };
    token?: {
      chain?: string;
      tokenId?: string;
      symbol?: string;
    };
    amount?: string | number;
  }) {
    const fromAccount = resolveSendFromAccount(input?.from);
    const chain = resolveSendChain(input?.token?.chain);
    const tokenId = String(input?.token?.tokenId || '').trim();
    const toAddress = String(input?.to?.address || '').trim();

    if (!tokenId) {
      throw new Error(
        '[RabbyDevToolsBridge] Send fixture is missing token.tokenId',
      );
    }
    if (!toAddress) {
      throw new Error(
        '[RabbyDevToolsBridge] Send fixture is missing to.address',
      );
    }

    apiSendToken.resetScreenState();
    jotaiStore.set(sendScreenParamsAtom, {
      chainEnum: chain.enum,
      tokenId,
    });
    void switchSceneCurrentAccount('MakeTransactionAbout', fromAccount);
    naviPush(RootNames.StackTransaction, {
      screen: RootNames.Send,
      params: {
        chainEnum: chain.enum,
        tokenId,
        toAddress,
        addressBrandName: input?.to?.brandName,
      },
    });

    return {
      ok: true,
      routeNameBefore: getLatestNavigationName() || null,
      resolved: {
        from: {
          address: fromAccount.address,
          brandName: fromAccount.brandName,
          type: fromAccount.type,
        },
        to: {
          address: toAddress,
          brandName: input?.to?.brandName || null,
        },
        token: {
          chain: chain.serverId,
          chainEnum: chain.enum,
          tokenId,
          symbol: input?.token?.symbol || null,
        },
        amount: input?.amount == null ? null : String(input.amount),
      },
    };
  },
  getSendScreenSnapshot() {
    return buildSendScreenSnapshot();
  },
  setSendAmount(amount?: string | number) {
    const nextAmount = String(amount ?? '').trim();

    if (!nextAmount) {
      throw new Error('[RabbyDevToolsBridge] Send amount is required');
    }

    requestSendTokenFormPatch({ amount: nextAmount });

    return {
      ok: true,
      routeName: getLatestNavigationName() || null,
      amount: nextAmount,
    };
  },
} satisfies Record<string, DevtoolsMethod>;

runDevIIFEFunc(() => {
  const bridge: RabbyDevToolsBridge = {
    listMethods: () =>
      Object.keys(bridgeMethods).sort() as RabbyDevToolsBridgeMethodName[],
    hasMethod: (name: string) => typeof bridgeMethods[name] === 'function',
    invoke: async (name: string, ...args: unknown[]) => {
      const method = bridgeMethods[name];

      if (!method) {
        throw new Error(`[RabbyDevToolsBridge] Unknown method: ${name}`);
      }

      return await method(...args);
    },
    ping: () => bridgeMethods.ping(),
    getHomePortfolioSnapshot: () => bridgeMethods.getHomePortfolioSnapshot(),
    getSingleHomeSnapshot: () => bridgeMethods.getSingleHomeSnapshot(),
    openSendScreen: input => bridgeMethods.openSendScreen(input as never),
    getSendScreenSnapshot: () => bridgeMethods.getSendScreenSnapshot(),
    setSendAmount: amount => bridgeMethods.setSendAmount(amount as never),
  };

  globalThis.__RABBY_DEVTOOLS_BRIDGE__ = bridge;
});
