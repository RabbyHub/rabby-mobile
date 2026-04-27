import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import RcConvertCC from '@/assets2024/icons/convertDust/convert-cc.svg';
import { AccountSwitcherModal } from '@/components/AccountSwitcher/Modal';
import { Button } from '@/components2024/Button';
import { toast } from '@/components2024/Toast';
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
  type DustFilter,
} from './constant';
import { useBatchSwapTask } from './hooks/useBatchSwapTask';
import {
  useConvertDustReceiveToken,
  useConvertDustTokenList,
} from './hooks/useConvertDustTokens';

export function ConvertDustScreen(): JSX.Element {
  const { styles } = useTheme2024({ getStyle });
  const { safeOffBottom } = useSafeSizes();
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const [chainEnum, setChainEnum] = useState(ETH_CHAIN);
  const chain = useFindChain({ enum: chainEnum });
  const [selectedFilter, setSelectedFilter] = useState<DustFilter>('<$10');
  const [activeSettingSheet, setActiveSettingSheet] = useState<
    'priceImpact' | 'gasLimit' | null
  >(null);

  const receiveToken = useConvertDustReceiveToken({
    address: currentAccount?.address,
    chainServerId: chain?.serverId,
    nativeTokenAddress: chain?.nativeTokenAddress,
  });
  const { tokens: dustTokens, isLoading: isTokenListLoading } =
    useConvertDustTokenList({
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

  const hasSelectedToken = useMemo(
    () => !!task.list.length,
    [task.list.length],
  );
  const selectedTokenIds = useMemo(
    () => new Set(task.list.map(token => token.id)),
    [task.list],
  );
  const isSupportedAccount =
    currentAccount?.type === KEYRING_CLASS.PRIVATE_KEY ||
    currentAccount?.type === KEYRING_CLASS.MNEMONIC;

  const getAccountDisabledTips = useCallback((account: Account) => {
    if (
      account.type === KEYRING_CLASS.PRIVATE_KEY ||
      account.type === KEYRING_CLASS.MNEMONIC
    ) {
      return undefined;
    }

    return '该类地址不支持此功能';
  }, []);

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

    if (hasSelectedToken) {
      task.init([]);
      return;
    }

    task.init(dustTokens as TokenItem[]);
  }, [dustTokens, hasSelectedToken, task]);

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

  const handleFilterChange = useCallback(
    (filter: DustFilter) => {
      if (task.disabled) {
        return;
      }
      setSelectedFilter(filter);
      task.clear();
    },
    [task],
  );

  const handleStartPress = useCallback(() => {
    if (!isSupportedAccount) {
      toast.info('该类地址不支持此功能');
      return;
    }

    if (task.status === 'idle') {
      task.start();
      return;
    }

    if (task.status === 'completed') {
      task.clear();
      return;
    }

    task.pause();
  }, [isSupportedAccount, task]);

  const receiveUsd =
    task.status === 'idle' ? task.expectReceive.usd : task.finalReceive.usd;
  const receiveAmount =
    task.status === 'idle'
      ? task.expectReceive.amount
      : task.finalReceive.amount;
  const ctaTitle =
    task.status === 'idle'
      ? 'Start convert'
      : task.status === 'completed'
      ? 'Done'
      : 'Stop';
  const displayedTokens =
    task.status === 'idle' ? dustTokens : (task.list as ITokenItem[]);

  return (
    <NormalScreenContainer2024
      type="bg2"
      overwriteStyle={styles.screen}
      noHeader={false}>
      <View style={[styles.content, { paddingBottom: safeOffBottom + 100 }]}>
        <ChainInfo2024
          chainEnum={chainEnum}
          onChange={handleChainChange}
          hideTestnetTab
          account={currentAccount!}
          style={styles.chainSelector}
        />

        <LowValueTokenSelector
          disabled={task.disabled}
          hasSelectedToken={hasSelectedToken}
          isLoading={isTokenListLoading}
          selectedFilter={selectedFilter}
          selectedTokenIds={selectedTokenIds}
          showStatus={task.status !== 'idle'}
          statusDict={task.statusDict}
          tokens={displayedTokens}
          onFilterChange={handleFilterChange}
          onToggleAll={toggleAll}
          onToggleToken={toggleToken}
        />

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

      <View
        pointerEvents="box-none"
        style={[styles.bottomBar, { paddingBottom: safeOffBottom + 17 }]}>
        <Button
          title={ctaTitle}
          height={52}
          disabled={
            task.status === 'idle' && (!hasSelectedToken || !isSupportedAccount)
          }
          icon={<RcConvertCC width={22} height={22} />}
          containerStyle={styles.ctaContainer}
          buttonStyle={styles.ctaButton}
          titleStyle={styles.ctaTitle}
          onPress={handleStartPress}
          noShadow
        />
      </View>

      <AccountSwitcherModal
        forScene="MakeTransactionAbout"
        getAccountDisabledTips={getAccountDisabledTips}
      />
      <ConvertDustPresetSheet
        visible={activeSettingSheet === 'priceImpact'}
        title="Price Impact"
        value={`${task.config.priceImpact}%`}
        options={PRICE_IMPACT_OPTIONS}
        onCancel={() => setActiveSettingSheet(null)}
        onConfirm={nextValue => {
          task.setConfig(prev => ({
            ...prev,
            priceImpact: nextValue.replace('%', ''),
          }));
          setActiveSettingSheet(null);
        }}
      />
      <ConvertDustPresetSheet
        visible={activeSettingSheet === 'gasLimit'}
        title="Single Transaction Gas Limit"
        value={`$${task.config.maxGasCost}`}
        options={GAS_LIMIT_OPTIONS}
        onCancel={() => setActiveSettingSheet(null)}
        onConfirm={nextValue => {
          task.setConfig(prev => ({
            ...prev,
            maxGasCost: nextValue.replace('$', ''),
          }));
          setActiveSettingSheet(null);
        }}
      />
      <ConvertDustStopSheet
        visible={task.status === 'paused'}
        onContinue={task.continue}
        onStop={task.stop}
      />
      <ConvertDustCompletedSheet
        chain={chain}
        receiveAmount={task.finalReceive.amount}
        receiveToken={receiveToken}
        receiveUsd={task.finalReceive.usd}
        visible={task.status === 'completed'}
        onDone={task.clear}
      />
    </NormalScreenContainer2024>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  screen: {
    backgroundColor: colors2024['neutral-bg-1'],
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  chainSelector: {
    height: 58,
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-2'],
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    paddingTop: 12,
    paddingHorizontal: 24,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  ctaContainer: {
    height: 52,
  },
  ctaButton: {
    height: 52,
    borderRadius: 12,
  },
  ctaTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
}));

export default ConvertDustScreen;
