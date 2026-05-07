import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, BackHandler, Platform, View } from 'react-native';

import RcIconSwitchBtn from '@/assets2024/icons/bridge/IconSwitchBtn.svg';
import RcIconSwitchBtnDark from '@/assets2024/icons/bridge/IconSwitchBtnDark.svg';
import { AccountSwitcherModal } from '@/components/AccountSwitcher/Modal';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { CHAINS_ENUM } from '@/constant/chains';
import type { Account } from '@/core/services/preference';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { useFindChain } from '@/hooks/useFindChain';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import type { ITokenItem } from '@/store/tokens';
import { createGetStyles2024 } from '@/utils/styles';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { ChainInfo2024 } from '../Send/components/ChainInfo2024';
import { ConvertDustCompletedSheet } from './components/ConvertDustCompletedSheet';
import { ConvertDustBottomBar } from './components/ConvertDustBottomBar';
import { ConvertDustPresetSheet } from './components/ConvertDustPresetSheet';
import { ConvertDustStopSheet } from './components/ConvertDustStopSheet';
import { LowValueTokenSelector } from './components/LowValueTokenSelector';
import { ReceiveSummary } from './components/ReceiveSummary';
import {
  DEFAULT_ETH_MAX_GAS_COST,
  DEFAULT_MAX_GAS_COST,
  DEFAULT_PRICE_IMPACT,
  ETH_CHAIN,
  GAS_LIMIT_OPTIONS,
  PRICE_IMPACT_OPTIONS,
  thresholds,
  type DustFilter,
} from './constant';
import { useBatchSwapTask } from './hooks/useBatchSwapTask';
import {
  useConvertDustReceiveToken,
  useConvertDustTokenList,
} from './hooks/useConvertDustTokens';
import { SWAP_SUPPORT_CHAINS } from '@/constant/swap';
import {
  useNavigation,
  usePreventRemove,
  useRoute,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type {
  GetNestedScreenRouteProp,
  TransactionNavigatorParamList,
} from '@/navigation-type';
import { useDismissConvertDustBanner } from '../Home/hooks/useConvertDustBanner';
import { ConvertDustEntryGuideModal } from './components/ConvertDustEntryGuideModal';
import { useTranslation } from 'react-i18next';
import { useMount } from 'ahooks';
import { atomByMMKV } from '@/core/storage/mmkv';
import { useAtom } from 'jotai';

const activeFilterAtom = atomByMMKV<DustFilter>(
  '@convertDust.activeFilter',
  thresholds[2],
  {
    getOnInit: true,
  },
);

type ConvertDustNavigationProp = NativeStackNavigationProp<
  TransactionNavigatorParamList,
  'ConvertDust'
>;

function ConvertDustContent({
  currentAccount,
}: {
  currentAccount: Account | null;
}): JSX.Element {
  const { styles, isLight, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const navigation = useNavigation<ConvertDustNavigationProp>();
  const route =
    useRoute<
      GetNestedScreenRouteProp<'TransactionNavigatorParamList', 'ConvertDust'>
    >();
  const dismissConvertDustBanner = useDismissConvertDustBanner();
  const [entryGuideVisible, setEntryGuideVisible] = useState(false);
  const allowBackRef = useRef(false);
  const pendingBackActionRef = useRef<
    Parameters<typeof navigation.dispatch>[0] | null
  >(null);
  const pendingStopBackActionRef = useRef<
    Parameters<typeof navigation.dispatch>[0] | null
  >(null);
  const { safeOffBottom } = useSafeSizes();

  const [chainEnum, setChainEnum] = useState(ETH_CHAIN);
  const chain = useFindChain({ enum: chainEnum });
  const [selectedFilter, setSelectedFilter] = useAtom(activeFilterAtom);
  const [activeSettingSheet, setActiveSettingSheet] = useState<
    'priceImpact' | 'gasLimit' | null
  >(null);
  const [isCompletedSheetDismissed, setIsCompletedSheetDismissed] =
    useState(false);
  const completedSheetClearTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const receiveToken = useConvertDustReceiveToken({
    address: currentAccount?.address,
    chainServerId: chain?.serverId,
    nativeTokenAddress: chain?.nativeTokenAddress,
  });
  const {
    tokens: dustTokens,
    isLoading: isTokenListLoading,
    getTokenList,
  } = useConvertDustTokenList({
    address: currentAccount?.address,
    chainServerId: chain?.serverId,
    receiveTokenId: receiveToken?.id,
    selectedFilter,
  });
  const task = useBatchSwapTask({
    chain: chain || undefined,
    account: currentAccount || undefined,
    receiveToken: receiveToken || undefined,
  });
  const { status: taskStatus, pause: pauseTask } = task;

  useEffect(() => {
    if (task.status === 'completed') {
      setIsCompletedSheetDismissed(false);
    }
  }, [task.status]);

  useEffect(() => {
    return () => {
      if (completedSheetClearTimerRef.current) {
        clearTimeout(completedSheetClearTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    dismissConvertDustBanner();
  }, [dismissConvertDustBanner]);

  usePreventRemove(
    !allowBackRef.current &&
      (taskStatus === 'active' || !!route.params?.fromHomeConvertDustBanner),
    event => {
      if (taskStatus === 'active') {
        pendingStopBackActionRef.current = event.data.action;
        pauseTask();
        return;
      }

      pendingBackActionRef.current = event.data.action;
      setEntryGuideVisible(true);
    },
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (taskStatus !== 'active') {
        return;
      }

      if (nextAppState.match(/inactive|background/)) {
        pauseTask();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [pauseTask, taskStatus]);

  const handleEntryGuideGotIt = useCallback(() => {
    setEntryGuideVisible(false);
    allowBackRef.current = true;

    const pendingAction = pendingBackActionRef.current;
    pendingBackActionRef.current = null;

    if (pendingAction) {
      navigation.dispatch(pendingAction);
      return;
    }

    navigation.goBack();
  }, [navigation]);

  const handleStopContinue = useCallback(() => {
    pendingStopBackActionRef.current = null;
    task.continue();
  }, [task]);

  const handleStop = useCallback(() => {
    task.stop();
  }, [task]);

  useEffect(() => {
    navigation.setParams({
      disableAccountSwitch: task.disabled,
    });
  }, [navigation, task.disabled]);

  const hasSelectedToken = useMemo(
    () => !!task.list.length,
    [task.list.length],
  );
  const selectedTokenIds = useMemo(
    () => new Set(task.list.map(token => token.id)),
    [task.list],
  );
  const hasSelectedAllTokens = useMemo(
    () =>
      !!dustTokens.length &&
      dustTokens.every(token => selectedTokenIds.has(token.id)),
    [dustTokens, selectedTokenIds],
  );
  const isSupportedAccount =
    currentAccount?.type === KEYRING_CLASS.PRIVATE_KEY ||
    currentAccount?.type === KEYRING_CLASS.MNEMONIC;

  const toggleToken = useCallback(
    (token: ITokenItem) => {
      if (task.disabled) {
        return;
      }

      if (selectedTokenIds.has(token.id)) {
        task.init(
          task.list.filter(item => item.id !== token.id) as TokenItem[],
        );
        return;
      }

      task.init(
        dustTokens.filter(
          item => selectedTokenIds.has(item.id) || item.id === token.id,
        ) as TokenItem[],
      );
    },
    [dustTokens, selectedTokenIds, task],
  );

  const toggleAll = useCallback(() => {
    if (task.disabled) {
      return;
    }

    if (hasSelectedAllTokens) {
      task.init([]);
      return;
    }

    task.init(dustTokens as TokenItem[]);
  }, [dustTokens, hasSelectedAllTokens, task]);

  const handleChainChange = useCallback(
    (nextChainEnum: CHAINS_ENUM) => {
      if (task.disabled) {
        return;
      }

      task.setConfig({
        priceImpact: DEFAULT_PRICE_IMPACT,
        maxGasCost:
          nextChainEnum === CHAINS_ENUM.ETH
            ? DEFAULT_ETH_MAX_GAS_COST
            : DEFAULT_MAX_GAS_COST,
      });
      task.clear();
      setChainEnum(nextChainEnum);
    },
    [task],
  );

  useMount(() => {
    handleChainChange(chainEnum);
  });

  const handleFilterChange = useCallback(
    (filter: DustFilter) => {
      if (task.disabled) {
        return;
      }
      setSelectedFilter(filter);
      task.clear();
    },
    [setSelectedFilter, task],
  );

  const handleStartPress = useCallback(() => {
    if (!isSupportedAccount) {
      // toast.info('该类地址不支持此功能');
      return;
    }

    if (task.status === 'idle') {
      if (!hasSelectedToken) {
        return;
      }

      task.start();
      return;
    }

    if (task.status === 'completed') {
      task.clear();
      if (currentAccount?.address) {
        getTokenList(currentAccount!.address, true);
      }
      return;
    }

    task.pause();
  }, [
    currentAccount,
    getTokenList,
    hasSelectedToken,
    isSupportedAccount,
    task,
  ]);

  const handleCompletedDone = useCallback(() => {
    setIsCompletedSheetDismissed(true);
    const pendingStopBackAction = pendingStopBackActionRef.current;
    pendingStopBackActionRef.current = null;

    if (completedSheetClearTimerRef.current) {
      clearTimeout(completedSheetClearTimerRef.current);
      completedSheetClearTimerRef.current = null;
    }

    if (pendingStopBackAction) {
      task.clear();

      if (currentAccount?.address) {
        getTokenList(currentAccount.address, true);
      }

      allowBackRef.current = true;
      navigation.dispatch(pendingStopBackAction);
      return;
    }

    completedSheetClearTimerRef.current = setTimeout(() => {
      task.clear();

      if (currentAccount?.address) {
        getTokenList(currentAccount.address, true);
      }

      completedSheetClearTimerRef.current = null;
    }, 1000);
  }, [currentAccount?.address, getTokenList, navigation, task]);

  const receiveUsd =
    task.status === 'idle' ? task.expectReceive.usd : task.finalReceive.usd;
  const receiveAmount =
    task.status === 'idle'
      ? task.expectReceive.amount
      : task.finalReceive.amount;

  const displayedTokens =
    task.status === 'idle' ? dustTokens : (task.list as ITokenItem[]);

  // usePreventRemove(task.status === 'active', e => {
  //   Alert.alert(
  //     t('page.approvals.stopTheRevokeProcess'),
  //     t('page.approvals.leavingThisPageWillStopTheRevokeProcess'),
  //     [
  //       {
  //         text: t('global.Cancel'),
  //         style: 'cancel',
  //         onPress: () => {},
  //       },
  //       {
  //         text: t('page.signTx.yes'),
  //         style: 'destructive',
  //         onPress: () => {
  //           navigation.dispatch(e.data.action);
  //         },
  //       },
  //     ],
  //   );
  // });

  React.useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          navigation.goBack();
          return true;
        },
      );

      return () => backHandler.remove();
    }
  }, [navigation]);

  React.useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      task.pause();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.pause]);

  return (
    <NormalScreenContainer2024
      type="bg2"
      overwriteStyle={styles.screen}
      noHeader={false}>
      <View style={[styles.content]}>
        <ChainInfo2024
          chainEnum={chainEnum}
          onChange={handleChainChange}
          hideTestnetTab
          account={currentAccount!}
          supportChains={SWAP_SUPPORT_CHAINS}
          unsupportedChainMode="hidden"
          disabled={task.disabled}
        />

        <LowValueTokenSelector
          disabled={task.disabled}
          hasSelectedAllTokens={hasSelectedAllTokens}
          isLoading={isTokenListLoading}
          selectedFilter={selectedFilter}
          selectedTokenIds={selectedTokenIds}
          showStatus={task.status !== 'idle'}
          statusDict={task.statusDict}
          tokens={displayedTokens}
          currentTaskIndex={task.currentTaskIndex}
          onFilterChange={handleFilterChange}
          onToggleAll={toggleAll}
          onToggleToken={toggleToken}
        />

        <View pointerEvents="none" style={styles.switchBtnLayer}>
          <View style={styles.switchBtn}>
            {isLight ? (
              <RcIconSwitchBtn color={colors2024['neutral-bg-3']} />
            ) : (
              <RcIconSwitchBtnDark />
            )}
          </View>
        </View>

        <ReceiveSummary
          chain={chain}
          receiveAmount={receiveAmount}
          receiveToken={receiveToken}
          receiveUsd={receiveUsd}
          task={task}
          onOpenGasLimit={() => setActiveSettingSheet('gasLimit')}
          onOpenPriceImpact={() => setActiveSettingSheet('priceImpact')}
        />
      </View>

      <ConvertDustBottomBar
        safeOffBottom={safeOffBottom}
        disabled={
          task.status === 'idle' && (!hasSelectedToken || !isSupportedAccount)
        }
        isSupportedAccount={isSupportedAccount}
        status={task.status}
        onPress={handleStartPress}
      />

      <ConvertDustPresetSheet
        visible={activeSettingSheet === 'priceImpact'}
        title={t('page.convertDust.receiveSummary.priceImpact')}
        value={task.config.priceImpact}
        options={PRICE_IMPACT_OPTIONS}
        onCancel={() => setActiveSettingSheet(null)}
        onConfirm={nextValue => {
          task.setConfig(prev => ({
            ...prev,
            priceImpact: nextValue,
          }));
          setActiveSettingSheet(null);
        }}
      />
      <ConvertDustPresetSheet
        visible={activeSettingSheet === 'gasLimit'}
        title={t('page.convertDust.receiveSummary.gasLimit')}
        value={task.config.maxGasCost}
        options={GAS_LIMIT_OPTIONS}
        onCancel={() => setActiveSettingSheet(null)}
        onConfirm={nextValue => {
          task.setConfig(prev => ({
            ...prev,
            maxGasCost: nextValue,
          }));
          setActiveSettingSheet(null);
        }}
      />
      <ConvertDustStopSheet
        visible={task.status === 'paused'}
        onContinue={handleStopContinue}
        onStop={handleStop}
      />
      <ConvertDustCompletedSheet
        chain={chain}
        receiveAmount={task.finalReceive.amount}
        receiveToken={receiveToken}
        receiveUsd={task.finalReceive.usd}
        visible={task.status === 'completed' && !isCompletedSheetDismissed}
        onDone={handleCompletedDone}
        onCancel={handleCompletedDone}
        isSuccess={task.isSuccess}
        taskList={task.list}
        statusDict={task.statusDict}
      />
      <ConvertDustEntryGuideModal
        visible={entryGuideVisible}
        onGotIt={handleEntryGuideGotIt}
      />
    </NormalScreenContainer2024>
  );
}

export const ConvertDustScreen = () => {
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const { t } = useTranslation();
  const getAccountDisabledTips = useCallback(
    (account: Account) => {
      if (
        account.type === KEYRING_CLASS.PRIVATE_KEY ||
        account.type === KEYRING_CLASS.MNEMONIC
      ) {
        return undefined;
      }

      // return '该类地址不支持此功能';
      return t('page.convertDust.unsupportedAccountType');
    },
    [t],
  );
  return (
    <>
      <ConvertDustContent
        currentAccount={currentAccount}
        key={`${currentAccount?.type}-${currentAccount?.address}`}
      />
      <AccountSwitcherModal
        forScene="MakeTransactionAbout"
        getAccountDisabledTips={getAccountDisabledTips}
      />
    </>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  screen: {
    backgroundColor: colors2024['neutral-bg-1'],
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  switchBtnLayer: {
    height: 0,
    alignItems: 'center',
    zIndex: 20,
    elevation: 20,
  },
  switchBtn: {
    transform: [{ translateY: -23 + 4 }],
  },
}));
