import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import RcBubleInBg from '@/assets/icons/gas-top-up/bulb-in-bg.svg';
import { CHAINS_ENUM } from '@debank/common';
import BigNumber from 'bignumber.js';
import { findChainByEnum } from '@/utils/chain';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import useAsync from 'react-use/lib/useAsync';
import { useCurrentAccount } from '@/hooks/account';
import { openapi } from '@/core/request';
import {
  GAS_TOP_UP_ADDRESS,
  GAS_TOP_UP_SUPPORT_TOKENS,
  MINIMUM_GAS_LIMIT,
} from '@/constant/gas';
import useAsyncRetry from 'react-use/lib/useAsyncRetry';
import { preferenceService } from '@/core/services';
import { toast } from '@/components/Toast';
import { stats } from '@/utils/stats';
import { gasTopUp } from './hooks';
import { useThemeColors } from '@/hooks/theme';
import { Button, FocusAwareStatusBar, Text } from '@/components';
import { GasBox } from './components/GasBox';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { createGetStyles } from '@/utils/styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ConfirmDrawer from './components/ConfirmDrawer';
import { ChainSelect } from './components/ChainSelect';

const GasList = [20, 50, 100];

const EthGasList = [100, 200, 500];

const ETHGasTokenChains = [CHAINS_ENUM.ETH, CHAINS_ENUM.RSK];

const GasTopUp = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  // const wallet = useWallet();
  const { t } = useTranslation();
  // const history = useHistory();

  const [visible, setVisible] = useState(false);

  const [token, setToken] = useState<TokenItem | undefined>();

  const [chain, setChain] = useState(CHAINS_ENUM.ETH);
  const chainItem = useMemo(() => findChainByEnum(chain)!, [chain]);

  const [index, setIndex] = useState(0);

  const { currentAccount } = useCurrentAccount();

  const {
    value: gasToken,
    loading: gasTokenLoading,
    error: gasTokenError,
  } = useAsync(async () => {
    if (!currentAccount?.address) {
      return;
    }
    const chainId = chainItem.serverId;
    const tokenId = chainItem.nativeTokenAddress;
    return openapi.getToken(currentAccount?.address, chainId, tokenId);
  }, [chainItem]);

  const {
    value: instantGas,
    loading: gasLoading,
    error: instantGasError,
  } = useAsync(async () => {
    const list = await openapi.gasMarket(chainItem.serverId);
    let instant = list[0];
    for (let i = 1; i < list.length; i++) {
      if (list[i].price > instant.price) {
        instant = list[i];
      }
    }
    return instant;
  }, [chainItem]);

  const {
    value: chainUsdBalance,
    loading: chainUsdBalanceLoading,
    error: chainUsdBalanceError,
  } = useAsync(async () => {
    const data = await openapi.getGasStationChainBalance(
      chainItem.serverId,
      GAS_TOP_UP_ADDRESS,
    );
    return data.usd_value;
  }, [chainItem]);

  const {
    value: tokenList = [],
    loading: tokenListLoading,
    error,
    retry,
  } = useAsyncRetry(async () => {
    if (!currentAccount?.address) {
      return;
    }
    const tokens = await openapi.listToken(currentAccount?.address);
    const sortedTokens = tokens.sort((a, b) =>
      new BigNumber(b.amount)
        .times(new BigNumber(b.price || 0))
        .minus(new BigNumber(a.amount).times(new BigNumber(a.price || 0)))
        .toNumber(),
    );
    return sortedTokens.filter(
      e =>
        !(
          e.chain === chainItem.serverId &&
          e.id === chainItem.nativeTokenAddress
        ),
    );
  }, [chainItem]);

  const {
    value: gasStationSupportedTokenMap = {},
    error: gasStationSupportedTokenMapError,
  } = useAsync(async () => {
    const list = await openapi.getGasStationTokenList();
    return list.reduce((pre, now) => {
      pre[now.chain.toLowerCase() + ':' + now.id.toLowerCase()] = true;
      return pre;
    }, {} as Record<string, true>);
  }, [chain]);

  const availableTokenList = useMemo(
    () =>
      tokenList.filter(
        item =>
          GAS_TOP_UP_SUPPORT_TOKENS[item.chain]?.includes(item.id) &&
          !!gasStationSupportedTokenMap[
            item.chain.toLowerCase() + ':' + item.id.toLowerCase()
          ],
      ),
    [tokenList, gasStationSupportedTokenMap],
  );

  const prices: [number, string][] = useMemo(() => {
    if (ETHGasTokenChains.includes(chain)) {
      return EthGasList.map(e => [
        e,
        new BigNumber(e).div(gasToken?.price || 1).toFixed(2),
      ]);
    }
    return GasList.map(e => [
      e,
      new BigNumber(e).div(gasToken?.price || 1).toFixed(2),
    ]);
  }, [gasToken, chain]);

  const instantGasValue = useMemo(() => {
    let gasValue = new BigNumber(0);
    if (instantGas && gasToken) {
      gasValue = new BigNumber(instantGas.price)
        .times(MINIMUM_GAS_LIMIT)
        .div(10 ** gasToken.decimals)
        .times(gasToken.price);
    }
    return gasValue;
  }, [instantGas, gasToken]);

  const btnDisabled = useMemo(
    () =>
      index >= prices.length ||
      new BigNumber(chainUsdBalance || 0).lt(prices[index][0]) ||
      gasLoading ||
      gasTokenLoading ||
      chainUsdBalanceLoading,
    [
      index,
      prices,
      chainUsdBalance,
      gasLoading,
      gasTokenLoading,
      chainUsdBalanceLoading,
    ],
  );

  const setLastSelectedGasTopUpChain = React.useCallback(async () => {
    if (!currentAccount?.address) {
      return;
    }
    preferenceService.setLastSelectedGasTopUpChain(
      currentAccount.address,
      chain,
    );
  }, [currentAccount, chain]);

  const isFirstRef = useRef(true);
  useEffect(() => {
    const getLastChain = async () => {
      if (!isFirstRef) {
        return;
      }
      isFirstRef.current = false;
      if (!currentAccount?.address) {
        return;
      }
      const lastChain = await preferenceService.getLastSelectedGasTopUpChain(
        currentAccount.address,
      );
      if (lastChain && findChainByEnum(lastChain)) {
        setChain(lastChain);
      }
    };
    getLastChain();
  }, [currentAccount?.address]);

  useEffect(() => {
    const isLoading = gasLoading || gasTokenLoading;
    if (!isLoading && instantGasValue && gasToken && index >= prices.length) {
      const i = prices.findIndex(e =>
        instantGasValue.lte(new BigNumber(e[0]).times(0.2).times(0.1)),
      );
      if (prices[i]) {
        setIndex(i);
      }
      return;
    }

    if (!isLoading && instantGasValue && prices[index] && gasToken) {
      if (
        instantGasValue.gt(
          new BigNumber(prices[index][0]).times(0.2).times(0.1),
        )
      ) {
        setIndex(index => index + 1);
      }
    }
  }, [gasLoading, gasTokenLoading, instantGasValue, index, prices, gasToken]);

  useEffect(() => {
    if (
      chainUsdBalanceError ||
      error ||
      gasTokenError ||
      instantGasError ||
      gasStationSupportedTokenMapError
    ) {
      toast.info(
        error?.message ||
          chainUsdBalanceError?.message ||
          gasTokenError?.message ||
          instantGasError?.message ||
          gasStationSupportedTokenMapError?.message ||
          '',
      );
    }
  }, [
    chainUsdBalanceError,
    error,
    gasTokenError,
    instantGasError,
    gasStationSupportedTokenMapError,
  ]);

  const handleGasTopUp = React.useCallback(async () => {
    if (!token || !gasToken || !prices[index]) {
      return;
    }
    const sendValue = new BigNumber(prices[index][0] || 0)
      .times(1.2)
      .div(token.price)
      .times(10 ** token.decimals)
      .toFixed(0);

    try {
      gasTopUp({
        $ctx: {
          ga: {
            category: 'GasTopUp',
            source: 'GasTopUp',
            trigger: '',
          },
          stats: {
            afterSign: [
              {
                name: 'gasTopUpClickSign',
                params: {
                  topUpChain: gasToken!.chain,
                  topUpAmount: prices[index][0],
                  topUpToken: gasToken!.symbol,
                  paymentChain: `${token.chain}:${token.symbol}`,
                },
              },
            ],
          },
        },
        gasTokenSymbol: gasToken.symbol,
        paymentTokenSymbol: token.symbol,
        fromUsdValue: prices[index][0],
        to: GAS_TOP_UP_ADDRESS,
        toChainId: chainItem.serverId,
        rawAmount: sendValue,
        chainServerId: token.chain,
        tokenId: token.id,
        fromTokenAmount: new BigNumber(prices[index][0])
          .times(1.2)
          .div(token.price)
          .toString(10),
        toTokenAmount: new BigNumber(prices[index][0])
          .div(gasToken.price)
          .toString(10),
      });
    } catch (error) {
      console.log('error', error);
    }
  }, [token, gasToken, prices, index, chainItem.serverId]);

  const retryFetchTokenList = () => {
    if (error) {
      retry();
    }
  };

  const handleContinue = React.useCallback(() => {
    setVisible(true);
    setLastSelectedGasTopUpChain();
    stats.report('gasTopUpContinue', {
      topUpChain: gasToken!.chain,
      topUpAmount: prices[index][0],
      topUpToken: gasToken!.symbol,
    });
  }, [setLastSelectedGasTopUpChain, gasToken, prices, index]);

  const { top, bottom } = useSafeAreaInsets();

  useEffect(() => {
    setToken(undefined);
  }, [chain]);

  return (
    <View style={{ flex: 1 }}>
      <FocusAwareStatusBar
        barStyle="light-content"
        backgroundColor={'transparent'}
        translucent
      />
      <View
        style={[
          styles.blueBg,
          {
            height: 287 + top,
            paddingTop: top,
            backgroundColor: colors['blue-default'],
          },
        ]}>
        <RcBubleInBg
          style={{ position: 'absolute', right: 25, top: top + 16 }}
        />
      </View>
      <NormalScreenContainer
        overwriteStyle={{
          backgroundColor: 'transparent',
          position: 'relative',
        }}>
        <View style={styles.wrapper}>
          <Text style={styles.descText}>{t('page.gasTopUp.description')}</Text>
          <View style={styles.centerBox}>
            <Text style={styles.label}>{t('page.gasTopUp.topUpChain')}</Text>
            <ChainSelect value={chain} onChange={setChain} />

            <Text style={styles.label}>{t('page.gasTopUp.Amount')}</Text>
            <View style={styles.gasBox}>
              {prices.map((e, i) => (
                <GasBox
                  key={i + chain}
                  chainUsdBalanceLoading={chainUsdBalanceLoading}
                  instantGasValue={instantGasValue}
                  item={e}
                  selectedIndex={index}
                  index={i}
                  onSelect={setIndex}
                  gasTokenLoading={gasTokenLoading}
                  gasToken={gasToken}
                  chainUsdBalance={chainUsdBalance}
                />
              ))}
            </View>
          </View>
        </View>

        <View
          style={[
            styles.buttonContainer,
            {
              paddingBottom: Math.max(bottom, 20),
            },
          ]}>
          <Button
            type="primary"
            onPress={handleContinue}
            disabled={btnDisabled}
            title={t('page.gasTopUp.Continue')}
          />
        </View>
      </NormalScreenContainer>
      <ConfirmDrawer
        visible={visible}
        onClose={() => setVisible(false)}
        cost={prices?.[index]?.[0] ? prices?.[index]?.[0] + '' : '0'}
        list={availableTokenList}
        token={token}
        onChange={setToken}
        onConfirm={handleGasTopUp}
        loading={tokenListLoading || gasTokenLoading}
        retry={retryFetchTokenList}
        // colors={colors}
      />
    </View>
  );
};

const getStyles = createGetStyles(colors => ({
  blueBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  wrapper: {
    padding: 24,
    paddingTop: 0,
    position: 'relative',
    backgroundColor: 'transparent',
  },
  descText: {
    fontSize: 13,
    color: colors['neutral-title-2'],
    paddingTop: 4,
    paddingBottom: 32,
  },

  centerBox: {
    backgroundColor: colors['neutral-bg-1'],
    borderRadius: 8,
    padding: 16,
    paddingTop: 0,
    paddingBottom: 32,
    shadowColor: 'rgba(0, 0, 0, 0.05)',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 5,
  },

  label: {
    paddingTop: 32,
    paddingBottom: 12,
    color: colors['neutral-title-1'],
    fontSize: 16,
    fontWeight: '500',
  },

  gasBox: {
    gap: 12,
  },
  buttonContainer: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    // right: 0,
    borderTopColor: colors['neutral-line'],
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    backgroundColor: colors['neutral-bg-1'],
    width: '100%',
    padding: 20,
  },
}));

export default GasTopUp;
