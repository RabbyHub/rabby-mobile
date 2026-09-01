import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  Animated,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { getTokenSymbol } from '@/utils/token';
import {
  GasAccountCheckResult,
  TokenItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { BridgeSlippage } from './BridgeSlippage';
import { tokenPriceImpact } from '../hooks/token';
import { AppSwitch, AssetAvatar } from '@/components';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import RcIconBluePolygon from '@/assets2024/icons/bridge/IconBluePolygon.svg';
import { formatGasHeaderUsdValue, formatTokenAmount } from '@/utils/number';
import { CustomSkeleton } from '@/components2024/CustomSkeleton';
import { findChain, findChainByServerID } from '@/utils/chain';
import { noop } from 'lodash';
import { WarningText } from './WarningText';
import { useSignatureInstance } from '@/components2024/MiniSignV2/state/SignatureInstanceContext';
import { useSignatureStore } from '@/components2024/MiniSignV2/state/useSignatureStore';
import { useGasAccountSign } from '@/screens/GasAccount/hooks/atom';
import { GasLessActivityToSign } from '@/components/Approval/components/FooterBar/GasLessComponents/GasLessActivityToSign';
import { GasLessNotEnough } from '@/components/Approval/components/FooterBar/GasLessComponents/GasLessNotEnough';
import {
  shouldAutoSwitchToGasAccountFromGasless,
  shouldShowGasLessNotEnough,
} from '@/components/Approval/components/FooterBar/gasLessDecision';
import { GasAccountTips } from '@/components/Approval/components/FooterBar/GasLessComponents/GasAccountTips';
import { useMemoizedFn } from 'ahooks';
import IconBestQuoteTag from '@/assets2024/icons/bridge/IconBestQuoteTag.svg';
import { Text } from '@/components/Typography';
import { SignMainnetHeaderContent } from '@/components/Approval/components/TxComponents/GasSelector/SignMainnetGasSelectorHeader';
import type { ApprovalGasMethod } from '@/components/Approval/components/TxComponents/GasSelector/approvalGasDisplay';
import { useMiniSignFixedMode } from '@/hooks/miniSignGasStore';
import BigNumber from 'bignumber.js';
import { normalizeTxParams } from '@/components/Approval/components/SignTx/util';
import { explainGas } from '@/components/Approval/components/SignTx/calc';
import { checkGasAndNonce } from '@/utils/transaction';
import { intToHex } from '@/utils/number';
import _ from 'lodash';
import { openapi } from '@/core/request';
import {
  buildTopUpResumedTxs,
  GasAccountTopUpResult,
} from '@/screens/GasAccount/components/topUpContinuation';
import {
  calcTempoMaxGasCostRawAmountIn18,
  isTempoBatchSupportedAccountType,
  isTempoChain,
  listTempoFeeTokenOptionsFromCache,
  loadTempoFeeTokenOptionsState,
  TempoFeeTokenOption,
  TxWithTempoExtras,
} from '@/utils/tempo';
import tokenListStore from '@/store/tokens';
import RcIconSwapFree from '@/assets2024/icons/swap/free.svg';

const RABBY_FEE = '0.25%';
const RABBY_HALF_FEE = '0.12%';

const BridgeShowMore = ({
  openQuotesList,
  sourceName,
  sourceLogo,
  slippage,
  displaySlippage,
  onSlippageChange,
  fromToken,
  toToken,
  amount,
  toAmount,
  quoteLoading,
  slippageError,
  autoSlippage,
  isCustomSlippage,
  setAutoSlippage,
  setIsCustomSlippage,
  type,
  isWrapToken,
  isBestQuote,
  showMEVGuardedSwitch,
  originPreferMEVGuarded,
  switchPreferMEV,
  recommendValue,
  openFeePopup,
  supportDirectSign,
  autoSuggestSlippage,
  duration,
  isRabbyFeeFree = false,
  isRabbyFeeHalf = false,
  insufficient,
  onDepositPopupVisibleChange,
  onSlippageOptionsOpenChange,
  onGasSettingsOpenChange,
  renderSwapQuotes,
  onRefreshSwapQuotes,
  swapQuotesLoading,
}: {
  openQuotesList: () => void;
  sourceName: string;
  sourceLogo: string;
  slippage: string;
  displaySlippage: string;
  onSlippageChange: (n: string) => void;
  fromToken?: TokenItem;
  toToken?: TokenItem;
  amount?: string | number;
  toAmount?: string | number;
  quoteLoading?: boolean;
  slippageError?: boolean;
  autoSlippage: boolean;
  isCustomSlippage: boolean;
  insufficient?: boolean;
  setAutoSlippage: (boolean: boolean) => void;
  setIsCustomSlippage: (boolean: boolean) => void;
  type: 'swap' | 'bridge';
  openFeePopup: () => void;
  duration?: number;
  /**
   * for swap props
   */
  isWrapToken?: boolean;
  isBestQuote: boolean;
  showMEVGuardedSwitch?: boolean;
  originPreferMEVGuarded?: boolean;
  switchPreferMEV?: (b: boolean) => void;
  recommendValue?: number;
  supportDirectSign: boolean;
  autoSuggestSlippage?: string;
  isRabbyFeeFree?: boolean;
  isRabbyFeeHalf?: boolean;
  textColor?: string;
  onDepositPopupVisibleChange?: (visible: boolean) => void;
  onSlippageOptionsOpenChange?: (open: boolean) => void;
  onGasSettingsOpenChange?: (open: boolean) => void;
  renderSwapQuotes?: (onSelect: () => void) => React.ReactNode;
  onRefreshSwapQuotes?: () => void;
  swapQuotesLoading?: boolean;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [lossImpactOpen, setLossImpactOpen] = useState(false);
  const [swapGasQuoteVisible, setSwapGasQuoteVisible] = useState(false);

  const data = useMemo(() => {
    if (quoteLoading || (!sourceLogo && !sourceName)) {
      return {
        showLoss: false,
        diff: '',
        fromUsd: '',
        toUsd: '',
        lossUsd: '',
      };
    }
    return tokenPriceImpact(fromToken, toToken, amount, toAmount);
  }, [
    fromToken,
    toToken,
    amount,
    toAmount,
    quoteLoading,
    sourceLogo,
    sourceName,
  ]);

  const showLossInfo = useMemo(
    () => !quoteLoading && data?.showLoss,
    [data?.showLoss, quoteLoading],
  );

  const showSourceFallback = !!insufficient || !fromToken || !supportDirectSign;

  const durationColor = useMemo(() => {
    const mins = Math.ceil((duration || 0) / 60);
    if (mins > 10) {
      return colors2024['red-default'];
    }
    if (mins > 3) {
      return colors2024['orange-default'];
    }
    return colors2024['brand-default'];
  }, [duration, colors2024]);

  const QuoteContent = useMemo(
    () => (
      <>
        {sourceLogo && (
          <Image
            source={
              typeof sourceLogo === 'string' ? { uri: sourceLogo } : sourceLogo
            }
            style={styles.sourceLogo}
          />
        )}
        {sourceName && (
          <Text
            style={
              isBestQuote
                ? [
                    styles.sourceName,
                    {
                      fontSize: 12,
                      fontWeight: 900,
                      lineHeight: 16,
                    },
                  ]
                : styles.sourceName
            }>
            {sourceName}
          </Text>
        )}
      </>
    ),
    [isBestQuote, sourceLogo, sourceName, styles.sourceLogo, styles.sourceName],
  );

  const BestQuoteContent = useMemo(
    () => (
      <View style={[styles.bestQuoteWrapper, { height: 24 }]}>
        <View>
          <IconBestQuoteTag height={24} style={styles.bestQuoteTag} />
          <View style={styles.bestTagWrapper}>
            <Text style={styles.bestText}>{t('page.swap.best')}</Text>
          </View>
        </View>

        <View style={styles.bestRightWrapper}>{QuoteContent}</View>
      </View>
    ),
    [QuoteContent, styles, t],
  );

  const sourceSelectorRender = useMemoizedFn(
    (
      options:
        | boolean
        | {
            clickable?: boolean;
            showArrow?: boolean;
          } = true,
    ) => {
      const { clickable, showArrow } =
        typeof options === 'boolean'
          ? { clickable: options, showArrow: options }
          : {
              clickable: options.clickable ?? true,
              showArrow: options.showArrow ?? true,
            };

      if (quoteLoading) {
        return (
          <CustomSkeleton
            style={{
              width: 60,
              height: 24,
              borderRadius: 12,
            }}
          />
        );
      }

      const content = (
        <>
          {isBestQuote ? BestQuoteContent : QuoteContent}
          {type === 'bridge' && duration ? (
            <Text style={[styles.sourceName, { color: durationColor }]}>
              {' · '}
              {t('page.bridge.duration', {
                duration: Math.ceil(duration / 60),
              })}
            </Text>
          ) : null}
          {showArrow && (sourceName || sourceLogo) ? (
            <RcIconBluePolygon
              style={styles.arrowIcon}
              color={colors2024['brand-default']}
            />
          ) : null}
          {!sourceLogo && !sourceName ? (
            <Text style={styles.noQuotePlaceholder}>-</Text>
          ) : null}
        </>
      );

      if (!clickable) {
        return <View style={styles.quoteContainer}>{content}</View>;
      }

      return (
        <TouchableOpacity
          onPress={openQuotesList}
          style={styles.quoteContainer}>
          {content}
        </TouchableOpacity>
      );
    },
  );

  const swapGasRowSourceSelector =
    type === 'swap' && (quoteLoading || sourceLogo || sourceName)
      ? sourceSelectorRender({ clickable: true, showArrow: false })
      : undefined;

  const sourceContentRender = useMemoizedFn(() => (
    <ListItem
      name={
        type === 'bridge'
          ? t('page.bridge.showMore.source')
          : t('page.swap.source')
      }
      style={styles.listItem}>
      {sourceSelectorRender()}
    </ListItem>
  ));

  return (
    <View style={StyleSheet.flatten([styles.container])}>
      <View style={{ gap: 12 }}>
        {type === 'bridge' && sourceContentRender()}

        {showLossInfo && (
          <View style={[styles.lossInfo, { marginBottom: 0 }]}>
            <View style={styles.flexRow}>
              <Text style={styles.impactText}>
                {t('page.bridge.price-impact')}
              </Text>
              <TouchableOpacity
                style={styles.diffBox}
                onPress={() => setLossImpactOpen(i => !i)}>
                <Text style={styles.lossAmount}>-{data?.diff}%</Text>
                <Animated.View
                  style={{
                    transform: [
                      { rotate: !lossImpactOpen ? '180deg' : '0deg' },
                    ],
                  }}>
                  <RcIconBluePolygon color={colors2024['orange-default']} />
                </Animated.View>
              </TouchableOpacity>
            </View>

            <WarningText>
              <Text>{t('page.bridge.loss-tips', { usd: data?.lossUsd })}</Text>
              {lossImpactOpen && (
                <>
                  {'\n'}
                  {'\n'}
                  <Text style={styles.impactTooltipText}>
                    {t('page.bridge.est-payment')}{' '}
                    {formatTokenAmount(amount || '0')}
                    {getTokenSymbol(fromToken)} ≈ {data?.fromUsd}
                  </Text>
                  {'\n'}

                  <Text style={styles.impactTooltipText}>
                    {t('page.bridge.est-receiving')}{' '}
                    {formatTokenAmount(toAmount || '0')}
                    {getTokenSymbol(toToken)} ≈ {data?.toUsd}
                  </Text>
                  {'\n'}

                  <Text style={styles.impactTooltipText}>
                    {t('page.bridge.est-difference')} {data?.lossUsd}
                  </Text>
                </>
              )}
            </WarningText>
          </View>
        )}

        {!showSourceFallback && fromToken ? (
          <DirectSignGasInfo
            supportDirectSign={supportDirectSign}
            loading={!!quoteLoading}
            openShowMore={noop}
            noQuote={!sourceLogo && !sourceName}
            chainServeId={fromToken?.chain}
            hideGasLevelInSummary
            sourceSelector={swapGasRowSourceSelector}
            fallbackSourceSelector={swapGasRowSourceSelector}
            onDepositPopupVisibleChange={onDepositPopupVisibleChange}
            onGasSettingsOpenChange={onGasSettingsOpenChange}
            renderSwapQuotes={renderSwapQuotes}
            onRefreshSwapQuotes={onRefreshSwapQuotes}
            swapQuotesLoading={swapQuotesLoading}
            swapGasQuoteVisible={swapGasQuoteVisible}
            onSwapGasQuoteVisibleChange={setSwapGasQuoteVisible}
            gasFeeLabel={
              type === 'swap' ? t('page.signTx.gasSelectorTitle') : undefined
            }
          />
        ) : type === 'swap' ? (
          sourceContentRender()
        ) : null}

        <BridgeSlippage
          autoSuggestSlippage={autoSuggestSlippage}
          value={slippage}
          displaySlippage={displaySlippage}
          onChange={onSlippageChange}
          autoSlippage={autoSlippage}
          isCustomSlippage={isCustomSlippage}
          setAutoSlippage={setAutoSlippage}
          setIsCustomSlippage={setIsCustomSlippage}
          type={type}
          isWrapToken={isWrapToken}
          recommendValue={recommendValue}
          loading={quoteLoading}
          onOptionsOpenChange={onSlippageOptionsOpenChange}
        />

        <ListItem name={t('page.swap.rabbyFee.title')}>
          {isRabbyFeeFree ? (
            <View style={styles.freeFeeContainer}>
              <RcIconSwapFree width={52} height={16} />
              <Text style={styles.waivedFee}>{RABBY_FEE}</Text>
            </View>
          ) : isRabbyFeeHalf ? (
            <Pressable onPress={openFeePopup}>
              <View style={styles.halfFeeContainer}>
                <Text style={styles.halfOriginalFee}>{RABBY_FEE}</Text>
                <Text style={styles.halfFee}>{RABBY_HALF_FEE}</Text>
              </View>
            </Pressable>
          ) : (
            <Pressable onPress={openFeePopup}>
              <Text style={isWrapToken ? styles.wrapTokenFee : styles.fee}>
                {isWrapToken && type === 'swap'
                  ? t('page.swap.no-fees-for-wrap')
                  : RABBY_FEE}
              </Text>
            </Pressable>
          )}
        </ListItem>

        {showMEVGuardedSwitch && (
          <ListItem name={t('page.swap.preferMEV')}>
            <AppSwitch
              value={originPreferMEVGuarded}
              onValueChange={switchPreferMEV}
              barHeight={22}
              circleBorderInactiveColor={colors2024['neutral-bg-2']}
              backgroundInactive={colors2024['neutral-bg-2']}
            />
          </ListItem>
        )}
      </View>
    </View>
  );
};

const rawAmountToBn = (
  value: string | number | BigNumber | null | undefined,
) => {
  if (BigNumber.isBigNumber(value)) {
    return value;
  }
  return new BigNumber(value || 0);
};

const StableSignMainnetHeaderContent = ({
  headerProps,
  dynamicProps,
}: {
  headerProps?: React.ComponentProps<typeof SignMainnetHeaderContent>;
  dynamicProps?: Partial<React.ComponentProps<typeof SignMainnetHeaderContent>>;
}) => {
  const lastHeaderPropsRef = useRef(headerProps);
  if (headerProps) {
    lastHeaderPropsRef.current = headerProps;
  }

  const cachedHeaderProps = lastHeaderPropsRef.current;
  if (!cachedHeaderProps) {
    return null;
  }

  return <SignMainnetHeaderContent {...cachedHeaderProps} {...dynamicProps} />;
};

export const DirectSignGasInfo = ({
  supportDirectSign,
  loading,
  noQuote,
  chainServeId,
  style,
  gasFeeListItemStyle,
  gasFeeListItemInnerStyle,
  textColor,
  onDepositPopupVisibleChange,
  onGasSettingsOpenChange,
  renderSwapQuotes,
  onRefreshSwapQuotes,
  swapQuotesLoading,
  swapGasQuoteVisible,
  onSwapGasQuoteVisibleChange,
  hideGasLevelInSummary,
  sourceSelector,
  fallbackSourceSelector,
  gasFeeLabel,
}: {
  supportDirectSign: boolean;
  loading: boolean;
  openShowMore: (v: boolean) => void;
  noQuote?: boolean;
  chainServeId: string;
  gasFeeListItemStyle?: RNViewProps['style'];
  gasFeeListItemInnerStyle?: RNViewProps['style'];
  textColor?: string;
  hideGasLevelInSummary?: boolean;
  sourceSelector?: React.ReactNode;
  fallbackSourceSelector?: React.ReactNode;
  onDepositPopupVisibleChange?: (visible: boolean) => void;
  onGasSettingsOpenChange?: (open: boolean) => void;
  renderSwapQuotes?: (onSelect: () => void) => React.ReactNode;
  onRefreshSwapQuotes?: () => void;
  swapQuotesLoading?: boolean;
  swapGasQuoteVisible?: boolean;
  onSwapGasQuoteVisibleChange?: (visible: boolean) => void;
  gasFeeLabel?: React.ReactNode;
} & RNViewProps) => {
  const { t } = useTranslation();
  const resolvedGasFeeLabel =
    gasFeeLabel ?? t('page.transactions.detail.GasFee');
  const { styles } = useTheme2024({ getStyle });
  const chainId = useMemo(
    () => findChainByServerID(chainServeId)?.id || 0,
    [chainServeId],
  );

  const { accountId, sig } = useGasAccountSign();
  const instance = useSignatureInstance();

  const { ctx, config } = useSignatureStore();
  const fixedModeOnCurrentChain = useMiniSignFixedMode(
    ctx?.txs?.[0]?.chainId || chainId,
  );
  const showGasContent =
    !!ctx?.txsCalc?.length && !loading && !noQuote && !!config?.account;

  const isReady = (ctx?.txsCalc?.length || 0) > 0;
  const isGasNotEnough = !!ctx?.isGasNotEnough;
  const canUseGasLess = !!ctx?.gasless?.is_gasless;
  const noCustomRPC = ctx?.noCustomRPC ?? true;
  const [manualGasMethod, setManualGasMethod] = useState<
    ApprovalGasMethod | undefined
  >(undefined);
  const accountAddress = config?.account?.address;
  const accountType = config?.account?.type;
  const manualGasScopeKey = useMemo(() => {
    const scopeChainId = ctx?.chainId || chainId;

    if (!accountAddress || !scopeChainId) {
      return '';
    }

    return `${accountType}:${accountAddress}:${scopeChainId}`;
  }, [accountAddress, accountType, chainId, ctx?.chainId]);
  const manualGasScopeKeyRef = useRef('');

  useEffect(() => {
    if (!manualGasScopeKey) {
      return;
    }

    if (
      manualGasScopeKeyRef.current &&
      manualGasScopeKeyRef.current !== manualGasScopeKey
    ) {
      setManualGasMethod(undefined);
    }

    manualGasScopeKeyRef.current = manualGasScopeKey;
  }, [manualGasScopeKey]);

  let gasLessConfig =
    canUseGasLess && ctx?.gasless?.promotion
      ? ctx?.gasless?.promotion?.config
      : undefined;
  if (
    gasLessConfig &&
    ctx?.gasless?.promotion?.id === '0ca5aaa5f0c9217e6f45fe1d109c24fb'
  ) {
    gasLessConfig = { ...gasLessConfig, dark_color: '', theme_color: '' };
  }

  const canGotoUseGasAccount =
    // isSupportedAddr &&
    noCustomRPC &&
    !!ctx?.gasAccount?.balance_is_enough &&
    !ctx?.gasAccount.chain_not_support &&
    !!ctx?.gasAccount.is_gas_account;

  const showGasLess = isReady && (isGasNotEnough || !!gasLessConfig);
  const effectiveGasMethod = manualGasMethod ?? ctx?.gasMethod;
  const payGasByGasAccount = effectiveGasMethod === 'gasAccount';

  const showGasLessToSign = showGasLess && !payGasByGasAccount && canUseGasLess;

  const useGasLess =
    (isGasNotEnough || !!gasLessConfig) && !!canUseGasLess && !!ctx?.useGasless;

  const canDepositUseGasAccount =
    // isSupportedAddr &&
    noCustomRPC &&
    !!ctx?.gasAccount &&
    !ctx?.gasAccount?.balance_is_enough &&
    !ctx?.gasAccount.chain_not_support;

  const gasAccountCanPay =
    effectiveGasMethod === 'gasAccount' &&
    // isSupportedAddr &&
    noCustomRPC &&
    !!ctx?.gasAccount?.balance_is_enough &&
    !ctx?.gasAccount.chain_not_support &&
    !!ctx?.gasAccount.is_gas_account &&
    !(ctx?.gasAccount as any).err_msg;

  const chain = findChain({ id: ctx?.chainId })!;

  const gasToken = ctx?.gasToken || {
    tokenId: chain?.nativeTokenAddress || '',
    symbol: chain?.nativeTokenSymbol || '',
    decimals: chain?.nativeTokenDecimals || 18,
    logoUrl: chain?.nativeTokenLogo || '',
  };
  const checkTxValueInBalance = !isTempoChain(chain?.serverId);

  const handleToggleGasless = value => {
    instance.toggleGasless(value);
  };

  const currentAccount = config?.account;
  const txs = useMemo(() => ctx?.txs || [], [ctx?.txs]);
  const txsResult = ctx?.txsCalc;
  const currentTx = txs[0];
  const { isSpeedUp, isCancel } = currentTx
    ? normalizeTxParams(currentTx)
    : { isSpeedUp: false, isCancel: false };
  const gasAccountCost = ctx?.gasAccount as any;
  const [tempoGasTokenList, setTempoGasTokenList] = useState<
    TempoFeeTokenOption[]
  >([]);
  const [tempoGasTokenLoading, setTempoGasTokenLoading] = useState(false);
  const txFeeToken =
    ((currentTx as unknown as TxWithTempoExtras | undefined)?.feeToken as
      | string
      | undefined) || '';
  const totalGasCost = useMemo(
    () =>
      (txsResult || []).reduce(
        (sum, item) => {
          sum.gasCostAmount = sum.gasCostAmount.plus(
            item.gasCost?.gasCostAmount || 0,
          );
          sum.gasCostUsd = sum.gasCostUsd.plus(item.gasCost?.gasCostUsd || 0);
          return sum;
        },
        {
          gasCostUsd: new BigNumber(0),
          gasCostAmount: new BigNumber(0),
          success: true,
        },
      ),
    [txsResult],
  );
  const maxGasCostRawAmount = useMemo(
    () =>
      (txsResult || []).reduce(
        (sum, item) =>
          sum.plus(new BigNumber(item.gasCost.maxGasCostRawAmount || 0)),
        new BigNumber(0),
      ),
    [txsResult],
  );
  const maxGasCostRawAmountText = useMemo(
    () => maxGasCostRawAmount.toFixed(),
    [maxGasCostRawAmount],
  );
  const maxGasCostRawAmountIn18 = useMemo(
    () => calcTempoMaxGasCostRawAmountIn18(txs),
    [txs],
  );
  const maxGasCostRawAmountIn18Text = useMemo(
    () => maxGasCostRawAmountIn18.toFixed(),
    [maxGasCostRawAmountIn18],
  );
  const currentTempoTokenId =
    txFeeToken || ctx?.tempoPreferredFeeTokenId || gasToken.tokenId || '';
  const showTempoGasTokenSelector =
    !!chain &&
    isTempoChain(chain.serverId) &&
    effectiveGasMethod !== 'gasAccount' &&
    isTempoBatchSupportedAccountType(currentAccount?.type);
  const getCachedTokenItems = useCallback(() => {
    if (!currentAccount?.address) {
      return [];
    }

    return (tokenListStore.getState().tokenListMap[
      currentAccount.address.toLowerCase()
    ] || []) as unknown as TokenItem[];
  }, [currentAccount?.address]);
  const gasCalcMethod = useCallback(
    async (price: number) => {
      if (!currentAccount) {
        return {
          gasCostUsd: new BigNumber(0),
          gasCostAmount: new BigNumber(0),
        };
      }

      const res = await Promise.all(
        (txsResult || []).map(item =>
          explainGas({
            gasUsed: item.gasUsed,
            gasPrice: price,
            chainId,
            nativeTokenPrice:
              item.preExecResult.native_token.price ||
              ctx?.nativeTokenPrice ||
              0,
            tx: item.tx,
            gasLimit: item.gasLimit,
            account: currentAccount,
            preparedL1Fee: item.L1feeCache,
            gasTokenDecimals: gasToken.decimals || 18,
          }),
        ),
      );

      return res.reduce(
        (sum, item) => {
          sum.gasCostAmount = sum.gasCostAmount.plus(item.gasCostAmount);
          sum.gasCostUsd = sum.gasCostUsd.plus(item.gasCostUsd);
          return sum;
        },
        {
          gasCostUsd: new BigNumber(0),
          gasCostAmount: new BigNumber(0),
        },
      );
    },
    [
      chainId,
      ctx?.nativeTokenPrice,
      currentAccount,
      gasToken.decimals,
      txsResult,
    ],
  );
  const checkGasLevelIsNotEnough = useMemoizedFn(
    (
      gas,
      type?: 'gasAccount' | 'native',
    ): Promise<[boolean, number, GasAccountCheckResult?]> => {
      const initialTxs = ctx?.txsCalc || [];
      let nextTxs = initialTxs;

      if (!isReady || !initialTxs.length || !currentAccount) {
        return Promise.resolve([true, 0]);
      }

      return Promise.all(
        initialTxs.map(async item => {
          const tx = {
            ...item.tx,
            ...(ctx?.is1559
              ? {
                  maxFeePerGas: intToHex(Math.round(gas.price || 0)),
                  maxPriorityFeePerGas:
                    gas.maxPriorityFee < 0
                      ? item.tx.maxFeePerGas
                      : intToHex(Math.round(gas.maxPriorityFee)),
                }
              : { gasPrice: intToHex(Math.round(gas.price)) }),
          };
          return {
            ...item,
            tx,
            gasCost: await explainGas({
              gasUsed: item.gasUsed,
              gasPrice: gas.price,
              chainId,
              nativeTokenPrice: item.preExecResult.native_token.price,
              tx,
              gasLimit: item.gasLimit,
              account: currentAccount,
              preparedL1Fee: item.L1feeCache,
              gasTokenDecimals: gasToken.decimals || 18,
            }),
          };
        }),
      ).then(arr => {
        let balance = ctx?.nativeTokenBalance || '';
        nextTxs = arr;

        if (!nextTxs.length) {
          return [true, 0] as [boolean, number];
        }

        if (type === 'native') {
          const checkResult = nextTxs.map(item => {
            const result = checkGasAndNonce({
              recommendGasLimitRatio: item.recommendGasLimitRatio,
              recommendGasLimit: item.gasLimit,
              recommendNonce: item.tx.nonce,
              tx: item.tx,
              gasLimit: item.gasLimit,
              nonce: item.tx.nonce,
              isCancel,
              gasExplainResponse: item.gasCost,
              isSpeedUp,
              isGnosisAccount: false,
              nativeTokenBalance: balance,
              gasTokenDecimals: gasToken.decimals || 18,
              gasTokenId: gasToken.tokenId,
              tempoPreferredFeeTokenId: ctx?.tempoPreferredFeeTokenId,
              checkTxValueInBalance,
            });
            const txValueRaw = checkTxValueInBalance
              ? rawAmountToBn(item.tx.value || 0)
              : new BigNumber(0);
            balance = new BigNumber(balance)
              .minus(txValueRaw)
              .minus(new BigNumber(item.gasCost.maxGasCostRawAmount || 0))
              .toFixed();
            return result;
          });

          return [_.flatten(checkResult)?.some(e => e.code === 3001), 0] as [
            boolean,
            number,
          ];
        }

        return openapi
          .checkGasAccountTxs({
            sig: sig || '',
            account_id: accountId || currentAccount.address,
            tx_list: arr.map(item => ({
              ...item.tx,
              gas: item.gasLimit,
              gasPrice: intToHex(gas.price),
            })),
          })
          .then(gasAccountRes => [
            !gasAccountRes.balance_is_enough,
            (gasAccountRes.gas_account_cost.estimate_tx_cost || 0) +
              (gasAccountRes.gas_account_cost?.gas_cost || 0),
            gasAccountRes,
          ]);
      });
    },
  );

  const handleAutoChangeGasMethod = useCallback(
    async (method: ApprovalGasMethod) => {
      try {
        instance.setGasMethod(method);
      } catch (error) {
        console.error('Gas method change error:', error);
      }
    },
    [instance],
  );

  const handleChangeGasMethod = useCallback(
    async (method: ApprovalGasMethod) => {
      setManualGasMethod(method);
      try {
        instance.setGasMethod(method, { manual: true });
      } catch (error) {
        console.error('Gas method change error:', error);
      }
    },
    [instance],
  );

  const handleGasChange = useCallback(
    async gas => {
      try {
        await instance.updateGasLevel(gas);
      } catch (error) {
        console.error('Gas change error:', error);
      }
    },
    [instance],
  );

  const handleSelectTempoGasToken = useCallback(
    async (
      token: TempoFeeTokenOption,
      options?: Parameters<typeof instance.setTempoFeeToken>[1],
    ) => {
      instance.setTempoFeeToken(token, options);
      if (ctx?.selectedGas) {
        await handleGasChange(ctx.selectedGas as any);
      }
    },
    [ctx?.selectedGas, handleGasChange, instance],
  );

  useEffect(() => {
    if (!currentAccount?.address || !chain || !showTempoGasTokenSelector) {
      setTempoGasTokenList([]);
      setTempoGasTokenLoading(false);
      return;
    }

    let mounted = true;
    const cachedTokenItems = getCachedTokenItems();
    const cachedOptions = listTempoFeeTokenOptionsFromCache({
      tokenList: cachedTokenItems,
      chainServerId: chain.serverId,
      maxGasCostRawAmount,
      maxGasCostRawAmountDecimals: gasToken.decimals || 18,
      maxGasCostRawAmountIn18,
    });

    if (cachedOptions.length) {
      setTempoGasTokenList(cachedOptions);
    }

    setTempoGasTokenLoading(true);
    loadTempoFeeTokenOptionsState({
      account: currentAccount,
      userAddress: currentAccount.address,
      chainServerId: chain.serverId,
      tokenList: cachedTokenItems,
      txFeeToken,
      maxGasCostRawAmount,
      maxGasCostRawAmountDecimals: gasToken.decimals || 18,
      maxGasCostRawAmountIn18,
    })
      .then(({ options, preferredTokenId, selectedOption }) => {
        if (!mounted) {
          return;
        }
        setTempoGasTokenList(options);
        if (
          selectedOption &&
          currentTempoTokenId.toLowerCase() !== selectedOption.id.toLowerCase()
        ) {
          const shouldApplyFallbackFeeToken =
            !!txFeeToken &&
            txFeeToken.toLowerCase() !== selectedOption.id.toLowerCase();
          handleSelectTempoGasToken(selectedOption, {
            applyFeeToken: shouldApplyFallbackFeeToken,
            tempoPreferredFeeTokenId: preferredTokenId,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) {
          setTempoGasTokenLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [
    chain,
    chain?.serverId,
    currentAccount,
    currentAccount?.address,
    currentTempoTokenId,
    gasToken.decimals,
    getCachedTokenItems,
    handleSelectTempoGasToken,
    maxGasCostRawAmount,
    maxGasCostRawAmountIn18,
    maxGasCostRawAmountIn18Text,
    maxGasCostRawAmountText,
    showTempoGasTokenSelector,
    txFeeToken,
  ]);

  const handleChangeGasAccount = useMemoizedFn(async () => {
    await handleChangeGasMethod('gasAccount');
    if (ctx?.selectedGas) {
      await handleGasChange(ctx.selectedGas as any);
    }
  });

  const handleTopUpWaitResult = useMemoizedFn(
    async (result: GasAccountTopUpResult) => {
      if (!ctx || !config || !ctx.txs.length) {
        return;
      }

      const nextTxs = await buildTopUpResumedTxs({
        txs: ctx.txs,
        originalAccount: config.account,
        originalChainServerId: chain.serverId,
        topUpResult: result,
      });

      instance.replaceTxs(nextTxs);
      setManualGasMethod('gasAccount');
      instance.setGasMethod('gasAccount', { manual: true });
      handleGasChange(ctx?.selectedGas);
    },
  );

  const showGasFeeTooHighTips = ctx?.gasFeeTooHigh && !loading && !noQuote;
  const showGasLessNotEnoughTip = shouldShowGasLessNotEnough({
    showGasLess,
    isGasNotEnough,
    payGasByGasAccount: !!payGasByGasAccount,
    canUseGasLess,
  });
  const showGasAccountTip = payGasByGasAccount && !gasAccountCanPay;
  const showGasTips =
    showGasLessToSign || showGasLessNotEnoughTip || showGasAccountTip;

  useEffect(() => {
    if (manualGasMethod) {
      return;
    }

    if (
      shouldAutoSwitchToGasAccountFromGasless({
        showGasLess,
        isGasNotEnough,
        canUseGasLess,
        canGotoUseGasAccount: !!canGotoUseGasAccount,
      }) &&
      !payGasByGasAccount
    ) {
      handleAutoChangeGasMethod('gasAccount');
    }
  }, [
    canGotoUseGasAccount,
    canUseGasLess,
    handleAutoChangeGasMethod,
    isGasNotEnough,
    manualGasMethod,
    payGasByGasAccount,
    showGasLess,
  ]);

  if (!supportDirectSign) {
    return null;
  }

  const gasTipsComponent = () => (
    <>
      {showGasLessToSign ? (
        <GasLessActivityToSign
          gasLessEnable={useGasLess}
          handleFreeGas={() => {
            handleToggleGasless?.(true);
          }}
          gasLessConfig={gasLessConfig}
        />
      ) : null}

      {showGasLessNotEnoughTip ? (
        <GasLessNotEnough
          inShowMore
          nativeTokenInsufficient={isGasNotEnough}
          canGotoUseGasAccount={canGotoUseGasAccount}
          canDepositUseGasAccount={canDepositUseGasAccount}
          onChangeGasAccount={handleChangeGasAccount}
          gasAccountAddress={accountId || config?.account.address || ''}
          gasAccountCost={ctx?.gasAccount as any}
          onDepositPopupVisibleChange={onDepositPopupVisibleChange}
          onWaitDepositResult={handleTopUpWaitResult}
          onDeposit={() => {
            // onDeposit?.();
            // handleGasChange(ctx?.selectedGas);
            // handleChangeGasMethod('gasAccount');
          }}
        />
      ) : null}

      {showGasAccountTip ? (
        <GasAccountTips
          inShowMore
          gasAccountAddress={accountId || config?.account.address || ''}
          gasAccountCost={ctx?.gasAccount as any}
          onChangeGasAccount={handleChangeGasAccount}
          isWalletConnect={false}
          noCustomRPC={noCustomRPC}
          nativeTokenInsufficient={isGasNotEnough}
          onDepositPopupVisibleChange={onDepositPopupVisibleChange}
          onWaitDepositResult={handleTopUpWaitResult}
          onDeposit={() => {
            //   // onDeposit?.();
            //   handleGasChange(ctx?.selectedGas);
            // handleChangeGasMethod('gasAccount');
          }}
        />
      ) : null}
    </>
  );

  const gasSelectorHeaderProps: React.ComponentProps<
    typeof SignMainnetHeaderContent
  > | null =
    showGasContent && currentTx && currentAccount
      ? {
          textColor,
          gasFeeListItemStyle,
          gasFeeListItemInnerStyle,
          fixedMode: true,
          defaultFixedModeOnCurrentChain: fixedModeOnCurrentChain,
          tx: currentTx,
          gasAccountCost,
          gasMethod: effectiveGasMethod,
          onChangeGasMethod: handleChangeGasMethod,
          onAutoChangeGasMethod: handleAutoChangeGasMethod,
          disableAutoGasLevelSwitch: !!manualGasMethod,
          showGasMethodShortcut: false,
          hideGasLevelInSummary,
          rightPrefix: sourceSelector,
          disabled: false,
          isReady,
          gasLimit: ctx?.txs?.[0]?.gas,
          gasList: ctx?.gasList || [],
          selectedGas: ctx?.selectedGas || null,
          version: txsResult?.[0]?.preExecResult?.pre_exec_version || 'v0',
          chainId: ctx?.chainId || chainId,
          onChange: handleGasChange,
          nonce: ctx?.txsCalc?.[0]?.tx?.nonce || '0x1',
          isSpeedUp: !!isSpeedUp,
          isCancel: !!isCancel,
          is1559: !!ctx?.is1559,
          isHardware: false,
          nativeTokenBalance: ctx?.nativeTokenBalance || '0x0',
          gasToken,
          showTempoGasTokenSelector,
          tempoGasTokenList,
          tempoPreferredFeeTokenId: ctx?.tempoPreferredFeeTokenId,
          onSelectTempoGasToken: handleSelectTempoGasToken,
          tempoGasTokenLoading,
          gasPriceMedian: ctx?.gasPriceMedian || null,
          gas: totalGasCost,
          gasCalcMethod,
          checkGasLevelIsNotEnough,
          account: currentAccount,
          gasCostUsdStr: formatGasHeaderUsdValue(
            totalGasCost.gasCostUsd.toString(10),
          ),
          nativeTokenInsufficient: isGasNotEnough,
          freeGasAvailable: canUseGasLess,
          onGasSettingsOpenChange,
          renderSwapQuotes,
          onRefreshSwapQuotes,
          swapQuotesLoading,
          swapGasInteractionDisabled: false,
          swapGasQuoteVisible,
          onSwapGasQuoteVisibleChange,
          gasFeeLabel: resolvedGasFeeLabel,
        }
      : null;
  const keepCombinedGasHeaderMounted =
    !!renderSwapQuotes && !!swapGasQuoteVisible;

  return (
    <View style={style}>
      {showGasContent || keepCombinedGasHeaderMounted ? (
        <StableSignMainnetHeaderContent
          headerProps={gasSelectorHeaderProps || undefined}
          dynamicProps={{
            onGasSettingsOpenChange,
            renderSwapQuotes,
            onRefreshSwapQuotes,
            swapQuotesLoading,
            swapGasInteractionDisabled: !showGasContent,
            swapGasQuoteVisible,
            onSwapGasQuoteVisibleChange,
            rightPrefix: sourceSelector,
          }}
        />
      ) : (
        <ListItem
          name={<>{resolvedGasFeeLabel}</>}
          style={gasFeeListItemStyle}
          innerStyle={gasFeeListItemInnerStyle}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {fallbackSourceSelector ?? sourceSelector}
            {!loading && noQuote ? (
              <Text style={styles.noQuotePlaceholder}>-</Text>
            ) : (
              <CustomSkeleton
                style={
                  hideGasLevelInSummary
                    ? styles.infoCardGasSkeleton
                    : styles.gasSkeleton
                }
              />
            )}
          </View>
        </ListItem>
      )}
      {showGasFeeTooHighTips ? (
        <WarningText style={{ marginTop: 10 }}>
          {t('page.bridge.gasFeeTooHight')}
        </WarningText>
      ) : null}
      {showGasContent && showGasTips ? (
        <View style={{ marginTop: 6 }}>{gasTipsComponent()}</View>
      ) : null}
    </View>
  );
};

function ListItem({
  name,
  style,
  innerStyle,
  children,
  LeftIcon,
}: {
  name: React.ReactNode;
  style?: RNViewProps['style'];
  innerStyle?: RNViewProps['style'];
  children: React.ReactNode;
  LeftIcon?: React.ReactNode;
}) {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={[styles.listItemContainer, style]}>
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
          },
          innerStyle,
        ]}>
        <Text style={styles.listItemText}>{name}</Text>
        {LeftIcon}
      </View>
      <View style={styles.flexRow}>{children}</View>
    </View>
  );
}

export const RecommendFromToken = ({
  token,
  style,
  onOk,
}: {
  token: TokenItem;
  style?: object;
  onOk: () => void;
}) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  return (
    <View style={[styles.recommendFromToken, style]}>
      <View style={styles.recommendTextWrapper}>
        <Text style={styles.recommendText}>{t('page.bridge.bridge-from')}</Text>
        <View style={styles.tokenContainer}>
          <AssetAvatar
            size={26}
            chain={token.chain}
            logo={token.logo_url}
            chainSize={12}
          />
          <Text style={styles.tokenText}>{getTokenSymbol(token)}</Text>
        </View>
        <Text style={styles.recommendText}>
          {t('page.bridge.for-available-quote')}
        </Text>
      </View>
      <TouchableOpacity onPress={onOk} style={styles.okButton}>
        <Text style={styles.okButtonText}>{t('global.ok')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, colors }) => ({
  container: { marginHorizontal: 24, marginTop: 12 },
  impactTooltipText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  listItemText: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
  },
  lossInfo: { marginBottom: 12, fontSize: 12, color: '#5B5B5B' },
  flexRow: { flexDirection: 'row', justifyContent: 'space-between' },
  lossAmount: {
    fontSize: 16,
    fontWeight: '700',
    // fontFamily: 'SF Pro ',
    lineHeight: 20,
    color: colors2024['orange-default'],
    marginRight: 4,
  },
  impactText: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
  },
  diffBox: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lossTip: {
    marginTop: 8,
    // paddingHorizontal: 4,
    // backgroundColor: colors2024['red-light-1'],
    color: colors2024['red-default'],
    fontSize: 14,
    marginBottom: 8,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',

    // paddingHorizontal: 14,
    // paddingVertical: 8,
    // borderRadius: 8,
    // overflow: 'hidden',
  },
  listItem: {},
  listItemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourceLogo: { width: 18, height: 18, borderRadius: 16 },
  sourceName: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    color: colors2024['brand-default'],
    lineHeight: 18,
  },
  fee: {
    color: colors2024['brand-default'],
    textAlign: 'right',
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },
  wrapTokenFee: {
    color: colors2024['neutral-foot'],
    textAlign: 'right',
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 20,
  },
  freeFeeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  halfFeeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  halfFee: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  halfOriginalFee: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    textDecorationLine: 'line-through',
  },
  waivedFee: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 20,
    textDecorationLine: 'line-through',
  },
  recommendFromToken: {
    // flexDirection: 'row',
    // height: 44,
    alignItems: 'flex-end',
    height: 122,
    marginTop: 100,
    marginHorizontal: 24,
    paddingHorizontal: 12,
    paddingVertical: 20,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    // borderBlockColor: colors2024['neutral-line'],
    backgroundColor: colors2024['neutral-bg-1'],
    // alignItems: 'center',
  },
  recommendTextWrapper: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
  },
  recommendText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    lineHeight: 18,
    color: colors2024['neutral-info'],
  },
  tokenContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: colors2024['neutral-bg-4'],
    borderRadius: 12,
  },
  tokenText: {
    color: colors2024['neutral-title-1'],
    marginLeft: 6,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    lineHeight: 20,
  },
  okButton: {
    backgroundColor: colors2024['brand-default'],
    borderRadius: 100,
    width: 77,
    height: 36,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  okButtonText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    lineHeight: 20,
    color: colors2024['neutral-bg-1'],
    marginRight: 4,
  },

  quoteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  afterLabel: {
    fontSize: 14,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-body'],
  },
  noQuotePlaceholder: {
    color: colors2024['neutral-foot'],
    fontSize: 12,
  },
  gasSkeleton: {
    width: 131,
    height: 24,
    borderRadius: 100,
  },
  infoCardGasSkeleton: {
    width: 60,
    height: 24,
    borderRadius: 12,
  },
  arrowIcon: {
    transform: [{ rotate: '-90deg' }],
  },

  gasAccountTip: {
    fontSize: 13,
    fontWeight: '400',
    color: colors['neutral-title-2'],
  },
  gasAccountTipsBox: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  bestQuoteWrapper: {
    borderColor: colors2024['brand-default'],
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  bestQuoteTag: {
    left: -StyleSheet.hairlineWidth * 2,
  },
  bestTagWrapper: {
    position: 'absolute',
    top: StyleSheet.hairlineWidth * 2,
    left: 7,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bestText: {
    color: colors2024['neutral-InvertHighlight'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 16,
  },
  bestRightWrapper: {
    flexDirection: 'row',
    gap: 4,
    paddingRight: 6,
    paddingLeft: 2,
    alignItems: 'center',
  },
}));

export default React.memo(BridgeShowMore);
