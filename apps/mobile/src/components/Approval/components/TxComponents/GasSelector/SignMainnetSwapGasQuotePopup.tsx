import BigNumber from 'bignumber.js';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { TouchableOpacity, View, type ViewStyle } from 'react-native';
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
import IconGasTokenCC from '@/assets2024/icons/gas-account/swap-gas-token-cc.svg';
import IconGasAccountCC from '@/assets2024/icons/gas-account/swap-gas-account-cc.svg';
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
  IconComponent,
  title,
}: {
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
  IconComponent: React.FC<SvgProps>;
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
      <IconComponent
        width={16}
        height={16}
        color={
          active ? colors2024['brand-default'] : colors2024['neutral-foot']
        }
      />
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
    const levelTitle = t(
      gas.level === 'slow'
        ? 'page.signTx.swapGasLevel.normal'
        : gas.level === 'normal'
        ? 'page.signTx.swapGasLevel.fast'
        : gas.level === 'fast'
        ? 'page.signTx.swapGasLevel.instant'
        : getGasLevelI18nKey(gas.level),
    );
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
        <View style={styles.gasCardMain}>
          <GasLevelIcon
            level={gas.level}
            size={24}
            color={
              gas.level === 'slow'
                ? colors2024['neutral-body']
                : colors2024['neutral-title-1']
            }
          />
          {isCustom ? (
            <Text style={styles.gasCardTitle}>{levelTitle}</Text>
          ) : isRowLoading ? (
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
        </View>
        {isCustom ? (
          <View style={styles.gasCardCustomFooter}>
            {isActive && costUsd && costUsd !== '-' ? (
              <Text
                style={[
                  styles.gasCardCustomUsd,
                  isNotEnough && styles.gasCardUsdNotEnough,
                ]}>
                {costUsd}
              </Text>
            ) : null}
            <IconGasCustomRightArrowCC
              width={14}
              height={14}
              color={colors2024['neutral-foot']}
            />
          </View>
        ) : (
          <View style={styles.gasCardDetails}>
            <Text style={styles.gasCardLevel}>{levelTitle}</Text>
            <Text style={styles.gasCardGwei}>{gwei} Gwei</Text>
          </View>
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
                    IconComponent={IconGasTokenCC}
                    title={t('page.gasAccount.gasToken')}
                  />
                  <GasMethodTab
                    active={currentGasMethod === 'gasAccount'}
                    disabled={gasInteractionDisabled || !noCustomRPCEnabled}
                    onPress={() => onChangeGasMethod?.('gasAccount')}
                    IconComponent={IconGasAccountCC}
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
                    width={14}
                    height={14}
                    color={colors2024['neutral-foot']}
                  />
                </View>
              </TouchableOpacity>
            ) : null}

            <View style={styles.gasCardsRow}>
              {gasList.map(renderGasLevelCard)}
            </View>
          </View>

          <View style={styles.quotesSection}>
            <View style={styles.quotesIntro}>
              <View style={styles.quotesHeader}>
                <Text style={styles.sectionTitle}>
                  {t('page.swap.quotes', { defaultValue: 'Quotes' })}
                </Text>
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={onRefreshQuotes}>
                  <RcIconRefreshCC
                    width={20}
                    height={20}
                    color={colors2024['neutral-body']}
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.quotesSubtitle}>
                {t('page.bridge.best-subtitle')}
              </Text>
            </View>
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

const getStyle = createGetStyles2024(({ isLight, colors2024 }) => ({
  sheetContent: {
    flex: 1,
  },
  sheetContentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 32,
  },
  section: {
    gap: 12,
    marginHorizontal: 4,
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
    borderRadius: 8,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  gasHeaderItem: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 5,
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
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'SF Pro',
  },
  inactiveText: {
    color: colors2024['neutral-foot'],
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'SF Pro',
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
    flexDirection: 'row',
    gap: 6,
  },
  gasCard: {
    flex: 1,
    minWidth: 0,
    height: 119,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    paddingVertical: 12,
    gap: 12,
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
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
  },
  gasCardUsd: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
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
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-foot'],
    textAlign: 'center',
  },
  gasCardGwei: {
    fontSize: 12,
    lineHeight: 16,
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
  gasCardSkeleton: {
    width: 48,
    height: 12,
    borderRadius: 4,
  },
  gasCardMain: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  gasCardDetails: {
    alignItems: 'center',
    gap: 3,
  },
  gasCardCustomFooter: {
    height: 30,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  gasCardCustomUsd: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
  },
  quotesSection: {
    gap: 16,
  },
  quotesIntro: {
    gap: 8,
  },
  quotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refreshButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  quotesSubtitle: {
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    marginHorizontal: 4,
  },
  quotesList: {
    gap: 12,
  },
}));
