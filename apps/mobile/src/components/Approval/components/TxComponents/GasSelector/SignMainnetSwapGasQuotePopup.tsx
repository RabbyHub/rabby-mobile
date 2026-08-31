import BigNumber from 'bignumber.js';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { GasLevel } from '@rabby-wallet/rabby-api/dist/types';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { CustomSkeleton } from '@/components2024/CustomSkeleton';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { getGasLevelI18nKey } from '@/utils/trans';
import { calcMaxPriorityFee } from '@/utils/transaction';
import RcIconRefreshCC from '@/assets2024/icons/bridge/IconRefreshCC.svg';
import IconGasTokenCC from '@/assets2024/icons/gas-account/gas-token-cc.svg';
import IconGasAccountCC from '@/assets2024/icons/gas-account/gas-account-cc.svg';
import IconGasTokenActive from '@/assets2024/icons/gas-account/gas-token-active.svg';
import IconGasAccountActive from '@/assets2024/icons/gas-account/gas-account-active.svg';
import IconGasCustomRightArrowCC from '@/assets2024/icons/gas-account/right-arrow-cc.svg';
import { AssetAvatar } from '@/components';
import { GasLevelIcon } from './GasMenuButton';
import { calcGasAccountUsd } from './directSignSummary';
import {
  resolveApprovalDisplayedGasLevelNotEnough,
  resolveApprovalGasLevelMethod,
  resolveApprovalGasMethod,
  shouldHideApprovalGasMethodTabs,
} from './approvalGasDisplay';
import type { SignMainnetGasChange } from './signMainnetCustomGas';
import {
  TempoGasTokenSelectSheet,
  formatTempoGasTokenAmount,
} from './TempoGasTokenSelectSheet';
import type { GasTokenInfo, TempoFeeTokenOption } from '@/utils/tempo';
import type { SignMainnetGasLevelState } from './signMainnetGasLevelPrefetch';
import type { SvgProps } from 'react-native-svg';

type SignMainnetSwapGasQuotePopupProps = {
  visible: boolean;
  onClose: () => void;
  gasList: GasLevel[];
  selectedGas: GasLevel | null;
  gasMethod?: 'native' | 'gasAccount';
  onChangeGasMethod?: (value: 'native' | 'gasAccount') => void;
  chainId?: number;
  gasLimit: string | number | BigNumber;
  nonce: string | number;
  onChange: (gas: SignMainnetGasChange) => void;
  isCancel?: boolean;
  isSpeedUp?: boolean;
  selectedGasCostUsdStr: string;
  gasAccountCost?: {
    gas_account_cost: {
      total_cost: number;
      tx_cost: number;
      gas_cost: number;
      estimate_tx_cost: number;
    };
    is_gas_account: boolean;
    balance_is_enough: boolean;
    chain_not_support: boolean;
  };
  nativeTokenInsufficient?: boolean;
  noCustomRPC?: boolean;
  freeGasAvailable?: boolean;
  levelState: SignMainnetGasLevelState;
  showTempoGasTokenSelector?: boolean;
  gasToken?: GasTokenInfo;
  tempoGasTokenList?: TempoFeeTokenOption[];
  onSelectTempoGasToken?: (token: TempoFeeTokenOption) => void;
  tempoGasTokenLoading?: boolean;
  onEditCustomGas?: () => void;
  renderQuotes: (onSelect: () => void) => React.ReactNode;
  onRefreshQuotes: () => void;
  quotesLoading?: boolean;
  gasInteractionDisabled?: boolean;
  autoOpenSignal?: number;
};

const GasMethodTab = ({
  active,
  disabled,
  onPress,
  ActiveComponent,
  BlurComponent,
  title,
}: {
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
  ActiveComponent: React.FC<SvgProps>;
  BlurComponent: React.FC<SvgProps>;
  title: React.ReactNode;
}) => {
  const { colors2024, styles } = useTheme2024({ getStyle });

  return (
    <TouchableOpacity
      disabled={disabled}
      style={[
        styles.gasHeaderItem,
        active ? styles.gasHeaderItemActive : styles.gasHeaderItemInactive,
        disabled && styles.gasHeaderItemDisabled,
      ]}
      onPress={onPress}>
      {active ? (
        <ActiveComponent />
      ) : (
        <BlurComponent color={colors2024['neutral-foot']} />
      )}
      <Text style={active ? styles.activeText : styles.inactiveText}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

export const SignMainnetSwapGasQuotePopup = ({
  visible,
  onClose,
  gasList,
  selectedGas,
  gasMethod,
  onChangeGasMethod,
  chainId,
  gasLimit,
  nonce,
  onChange,
  isCancel,
  isSpeedUp,
  selectedGasCostUsdStr,
  gasAccountCost,
  nativeTokenInsufficient,
  noCustomRPC,
  freeGasAvailable,
  levelState,
  showTempoGasTokenSelector,
  gasToken,
  tempoGasTokenList = [],
  onSelectTempoGasToken,
  tempoGasTokenLoading,
  onEditCustomGas,
  renderQuotes,
  onRefreshQuotes,
  quotesLoading,
  gasInteractionDisabled,
  autoOpenSignal = 0,
}: SignMainnetSwapGasQuotePopupProps) => {
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const sheetRef = useRef<BottomSheetModal>(null);
  const lastHandledAutoOpenSignalRef = useRef(0);
  const [tempoTokenSheetVisible, setTempoTokenSheetVisible] =
    React.useState(false);

  const currentGasMethod = gasMethod ?? 'native';
  const noCustomRPCEnabled = noCustomRPC ?? true;
  const gasAccountChainSupported =
    !!gasAccountCost && !gasAccountCost.chain_not_support;

  useEffect(() => {
    if (visible) {
      requestAnimationFrame(() => {
        sheetRef.current?.present();
      });
      return;
    }

    sheetRef.current?.dismiss();
  }, [visible]);

  useEffect(() => {
    if (
      !autoOpenSignal ||
      autoOpenSignal === lastHandledAutoOpenSignalRef.current ||
      visible
    ) {
      return;
    }

    lastHandledAutoOpenSignalRef.current = autoOpenSignal;
    requestAnimationFrame(() => {
      sheetRef.current?.present();
    });
  }, [autoOpenSignal, visible]);

  const currentTempoToken = useMemo(() => {
    if (!gasToken?.tokenId) {
      return undefined;
    }

    return tempoGasTokenList.find(
      token => token.id.toLowerCase() === gasToken.tokenId.toLowerCase(),
    );
  }, [gasToken?.tokenId, tempoGasTokenList]);

  const currentTempoTokenSymbol =
    currentTempoToken?.display_symbol ||
    currentTempoToken?.optimized_symbol ||
    currentTempoToken?.symbol ||
    gasToken?.symbol ||
    '-';

  const handleSelectGas = useCallback(
    (gas: GasLevel) => {
      if (gasInteractionDisabled) {
        return;
      }

      if (gas.level === 'custom') {
        onClose();
        onEditCustomGas?.();
        return;
      }

      onChange({
        ...gas,
        gasLimit: Number(gasLimit),
        nonce: Number(nonce),
        level: gas.level,
        maxPriorityFee: calcMaxPriorityFee(
          gasList,
          gas,
          chainId || 0,
          !!(isCancel || isSpeedUp),
        ),
      });
      onClose();
    },
    [
      chainId,
      gasInteractionDisabled,
      gasLimit,
      gasList,
      isCancel,
      isSpeedUp,
      nonce,
      onChange,
      onClose,
      onEditCustomGas,
    ],
  );

  const renderGasLevelCard = (gas: GasLevel) => {
    const gwei = new BigNumber(gas.price / 1e9).toFixed().slice(0, 8);
    const levelTitle = t(getGasLevelI18nKey(gas.level));
    const isActive = selectedGas?.level === gas.level;
    const isCustom = gas.level === 'custom';
    const levelNativeInsufficient = isCustom
      ? false
      : !!levelState[gas.level]?.nativeNotEnough;
    const displayMethod = isActive
      ? resolveApprovalGasMethod({
          nativeTokenInsufficient: !!nativeTokenInsufficient,
          gasAccountChainSupported,
          noCustomRPC: noCustomRPCEnabled,
          freeGasAvailable,
          legacyGasMethod: currentGasMethod,
        })
      : resolveApprovalGasLevelMethod({
          isCustom,
          currentGasMethod,
          nativeTokenInsufficient: levelNativeInsufficient,
          gasAccountChainSupported,
          noCustomRPC: noCustomRPCEnabled,
          freeGasAvailable,
        });
    const isRowLoading = !!levelState[gas.level]?.loading;

    let costUsd =
      displayMethod === 'native'
        ? levelState[gas.level]?.nativeUsd
        : levelState[gas.level]?.gasAccount?.[1];

    const isNotEnough = resolveApprovalDisplayedGasLevelNotEnough({
      isActive,
      displayMethod,
      nativeTokenInsufficient: !!nativeTokenInsufficient,
      gasAccountBalanceEnough: gasAccountCost?.balance_is_enough,
      levelNativeInsufficient,
      levelGasAccountNotEnough: levelState[gas.level]?.gasAccount?.[0],
    });

    costUsd = isActive
      ? displayMethod === 'gasAccount'
        ? levelState[gas.level]?.gasAccount?.[1] ||
          calcGasAccountUsd(
            (gasAccountCost?.gas_account_cost.estimate_tx_cost || 0) +
              (gasAccountCost?.gas_account_cost.gas_cost || 0),
          )
        : levelState[gas.level]?.nativeUsd || selectedGasCostUsdStr
      : costUsd;

    if (!costUsd) {
      costUsd = isActive ? selectedGasCostUsdStr : '-';
    }

    const cardStyle: ViewStyle[] = [
      styles.gasCard,
      isActive ? styles.gasCardActive : styles.gasCardInactive,
      ...(gasInteractionDisabled ? [styles.gasCardDisabled] : []),
    ];

    return (
      <TouchableOpacity
        key={gas.level}
        disabled={gasInteractionDisabled}
        style={cardStyle}
        onPress={() => handleSelectGas(gas)}>
        <GasLevelIcon level={gas.level} />
        {isCustom ? (
          <>
            <Text style={styles.gasCardTitle}>{levelTitle}</Text>
            <View style={styles.customGasFooter}>
              {isActive && costUsd ? (
                <Text
                  style={[
                    styles.gasCardUsd,
                    isNotEnough && styles.gasCardUsdNotEnough,
                  ]}>
                  {costUsd}
                </Text>
              ) : null}
              <IconGasCustomRightArrowCC color={colors2024['neutral-foot']} />
            </View>
          </>
        ) : (
          <>
            {isRowLoading ? (
              <CustomSkeleton style={styles.gasCardSkeleton} />
            ) : (
              <Text
                style={[
                  styles.gasCardUsd,
                  isNotEnough && styles.gasCardUsdNotEnough,
                ]}>
                {costUsd}
              </Text>
            )}
            <Text style={styles.gasCardLevel}>{levelTitle}</Text>
            <Text style={styles.gasCardGwei}>{gwei} Gwei</Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <>
      <AppBottomSheetModal
        ref={sheetRef}
        snapPoints={['85%']}
        onDismiss={onClose}
        enableDismissOnClose
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: isLight ? 'bg0' : 'bg1',
        })}>
        <BottomSheetScrollView
          style={styles.sheetContent}
          contentContainerStyle={styles.sheetContentContainer}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t('page.signTx.gasSelectorTitle')}
              </Text>
              {shouldHideApprovalGasMethodTabs() ? null : (
                <View style={styles.gasMethodTabs}>
                  <GasMethodTab
                    active={currentGasMethod === 'native'}
                    disabled={
                      gasInteractionDisabled ||
                      (currentGasMethod !== 'native' && !noCustomRPCEnabled)
                    }
                    onPress={() => onChangeGasMethod?.('native')}
                    ActiveComponent={IconGasTokenActive}
                    BlurComponent={IconGasTokenCC}
                    title={t('page.gasAccount.gasToken')}
                  />
                  <GasMethodTab
                    active={currentGasMethod === 'gasAccount'}
                    disabled={gasInteractionDisabled || !noCustomRPCEnabled}
                    onPress={() => onChangeGasMethod?.('gasAccount')}
                    ActiveComponent={IconGasAccountActive}
                    BlurComponent={IconGasAccountCC}
                    title={t('page.gasAccount.title')}
                  />
                </View>
              )}
            </View>

            {showTempoGasTokenSelector && currentGasMethod !== 'gasAccount' ? (
              <TouchableOpacity
                disabled={gasInteractionDisabled}
                style={[
                  styles.tempoTokenRow,
                  gasInteractionDisabled && styles.tempoTokenRowDisabled,
                ]}
                onPress={() => {
                  if (gasInteractionDisabled) {
                    return;
                  }
                  onClose();
                  setTempoTokenSheetVisible(true);
                }}>
                <Text style={styles.tempoTokenLabel}>
                  {t('page.gasAccount.gasToken')}
                </Text>
                <View style={styles.tempoTokenValue}>
                  <AssetAvatar size={20} logo={currentTempoToken?.logo_url} />
                  <Text style={styles.tempoTokenSymbol} numberOfLines={1}>
                    {currentTempoTokenSymbol}
                  </Text>
                  {currentTempoToken ? (
                    <Text style={styles.tempoTokenAmount} numberOfLines={1}>
                      {formatTempoGasTokenAmount(currentTempoToken)}
                    </Text>
                  ) : null}
                  <IconGasCustomRightArrowCC
                    color={colors2024['neutral-foot']}
                  />
                </View>
              </TouchableOpacity>
            ) : null}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.gasCardsRow}>
              {gasList.map(renderGasLevelCard)}
            </ScrollView>
          </View>

          <View style={styles.divider} />

          <View style={styles.quotesSection}>
            <View style={styles.quotesHeader}>
              <Text style={styles.sectionTitle}>
                {t('page.swap.quotes', { defaultValue: 'Quotes' })}
              </Text>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={onRefreshQuotes}>
                <RcIconRefreshCC color={colors2024['brand-default']} />
                <Text style={styles.refreshText}>{t('global.refresh')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.quotesSubtitle}>
              {t('page.bridge.best-subtitle')}
            </Text>
            <View style={styles.quotesList}>{renderQuotes(onClose)}</View>
          </View>
        </BottomSheetScrollView>
      </AppBottomSheetModal>

      <TempoGasTokenSelectSheet
        visible={tempoTokenSheetVisible}
        gasToken={gasToken}
        tokenList={tempoGasTokenList}
        loading={tempoGasTokenLoading}
        onClose={() => setTempoTokenSheetVisible(false)}
        onSelect={onSelectTempoGasToken}
      />
    </>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  sheetContent: {
    flex: 1,
  },
  sheetContentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 24,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  gasMethodTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 2,
    borderRadius: 6,
    backgroundColor: colors2024['neutral-bg-2'],
    borderWidth: 0.5,
    borderColor: colors2024['neutral-line'],
  },
  gasHeaderItem: {
    flexDirection: 'row',
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    gap: 4,
  },
  gasHeaderItemActive: {
    backgroundColor: colors2024['brand-light-1'],
  },
  gasHeaderItemInactive: {
    backgroundColor: 'transparent',
  },
  gasHeaderItemDisabled: {
    opacity: 0.5,
  },
  activeText: {
    color: colors2024['brand-default'],
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  inactiveText: {
    color: colors2024['neutral-foot'],
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  tempoTokenRow: {
    minHeight: 42,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: colors2024['neutral-line'],
    backgroundColor: colors2024['neutral-bg-2'],
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  tempoTokenRowDisabled: {
    opacity: 0.5,
  },
  tempoTokenLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: colors2024['neutral-foot'],
  },
  tempoTokenValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  tempoTokenSymbol: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
    maxWidth: 72,
  },
  tempoTokenAmount: {
    fontSize: 12,
    lineHeight: 16,
    color: colors2024['neutral-foot'],
    maxWidth: 88,
  },
  gasCardsRow: {
    gap: 6,
    paddingVertical: 2,
  },
  gasCard: {
    width: 88,
    minHeight: 106,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    gap: 4,
  },
  gasCardActive: {
    borderColor: colors2024['brand-default'],
    backgroundColor: colors2024['brand-light-1'],
  },
  gasCardInactive: {
    borderColor: 'transparent',
    backgroundColor: colors2024['neutral-bg-2'],
  },
  gasCardDisabled: {
    opacity: 0.5,
  },
  gasCardTitle: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
  },
  gasCardUsd: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
  },
  gasCardUsdNotEnough: {
    color: colors2024['red-default'],
  },
  gasCardLevel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    textAlign: 'center',
  },
  gasCardGwei: {
    fontSize: 12,
    lineHeight: 16,
    color: colors2024['neutral-foot'],
    textAlign: 'center',
  },
  gasCardSkeleton: {
    width: 48,
    height: 12,
    borderRadius: 4,
  },
  customGasFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 30,
  },
  divider: {
    height: 1,
    backgroundColor: colors2024['neutral-line'],
  },
  quotesSection: {
    gap: 12,
  },
  quotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  refreshText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['brand-default'],
  },
  quotesSubtitle: {
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
  },
  quotesList: {
    gap: 12,
  },
}));
