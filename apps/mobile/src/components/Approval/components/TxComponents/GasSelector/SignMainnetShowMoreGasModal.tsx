import BigNumber from 'bignumber.js';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SvgProps } from 'react-native-svg';
import { GasLevel } from '@rabby-wallet/rabby-api/dist/types';
import { AssetAvatar } from '@/components';
import { Text } from '@/components/Typography';
import { CustomSkeleton } from '@/components2024/CustomSkeleton';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { SwapModal } from '@/screens/Swap/components/Modal';
import { getGasLevelI18nKey } from '@/utils/trans';
import { calcMaxPriorityFee } from '@/utils/transaction';
import { getAnchoredPopoverPosition } from '@/utils/anchoredPopover';
import IconGasTokenCC from '@/assets2024/icons/gas-account/gas-token-cc.svg';
import IconGasAccountCC from '@/assets2024/icons/gas-account/gas-account-cc.svg';
import IconGasTokenActive from '@/assets2024/icons/gas-account/gas-token-active.svg';
import IconGasAccountActive from '@/assets2024/icons/gas-account/gas-account-active.svg';
import IconGasCustomRightArrowCC from '@/assets2024/icons/gas-account/right-arrow-cc.svg';
import IconGasLevelChecked from '@/assets2024/icons/gas-account/check.svg';
import type { GasTokenInfo, TempoFeeTokenOption } from '@/utils/tempo';
import {
  formatTempoGasTokenAmount,
  TempoGasTokenSelectSheet,
} from './TempoGasTokenSelectSheet';
import { calcGasAccountUsd } from './directSignSummary';
import {
  resolveApprovalGasMethod,
  resolveApprovalDisplayedGasLevelNotEnough,
  resolveApprovalGasLevelMethod,
  shouldHideApprovalGasMethodTabs,
} from './approvalGasDisplay';
import type { SignMainnetGasChange } from './signMainnetCustomGas';
import { type SignMainnetGasLevelState } from './signMainnetGasLevelPrefetch';

const GasMethod = (props: {
  active: boolean;
  onChange: () => void;
  ActiveComponent: React.FC<SvgProps>;
  BlurComponent: React.FC<SvgProps>;
  title: React.ReactNode;
}) => {
  const { active, onChange, ActiveComponent, BlurComponent, title } = props;
  const { colors2024, styles } = useTheme2024({ getStyle });
  return (
    <TouchableOpacity
      style={[
        styles.gasHeaderItem,
        active ? styles.gasHeaderItemActive : styles.gasHeaderItemInactive,
      ]}
      onPress={onChange}>
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

export const SignMainnetShowMoreGasModal = ({
  visible,
  onClose,
  layout,
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
  onEditCustomGas,
  gasToken,
  showTempoGasTokenSelector,
  tempoGasTokenList = [],
  onSelectTempoGasToken,
  tempoGasTokenLoading,
}: {
  visible: boolean;
  onClose: () => void;
  layout: { x: number; y: number; width: number; height: number };
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
  onEditCustomGas?: () => void;
  gasToken?: GasTokenInfo;
  showTempoGasTokenSelector?: boolean;
  tempoGasTokenList?: TempoFeeTokenOption[];
  onSelectTempoGasToken?: (token: TempoFeeTokenOption) => void;
  tempoGasTokenLoading?: boolean;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const currentGasMethod = gasMethod ?? 'native';
  const noCustomRPCEnabled = noCustomRPC ?? true;
  const gasAccountChainSupported =
    !!gasAccountCost && !gasAccountCost.chain_not_support;
  const overlayRef = React.useRef<View>(null);
  const [overlayRect, setOverlayRect] = React.useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [contentSize, setContentSize] = React.useState({
    width: 0,
    height: 0,
  });

  const measureOverlay = React.useCallback(() => {
    requestAnimationFrame(() => {
      overlayRef.current?.measureInWindow((x, y, width, height) => {
        setOverlayRect({ x, y, width, height });
      });
    });
  }, []);

  React.useEffect(() => {
    if (!visible) {
      return;
    }

    measureOverlay();
  }, [
    layout.height,
    layout.width,
    layout.x,
    layout.y,
    measureOverlay,
    visible,
  ]);

  const position = React.useMemo(() => {
    if (
      !layout.width ||
      !layout.height ||
      !overlayRect.width ||
      !overlayRect.height ||
      !contentSize.width ||
      !contentSize.height
    ) {
      return null;
    }

    return getAnchoredPopoverPosition({
      anchorRect: layout,
      overlayRect,
      contentSize,
    });
  }, [contentSize, layout, overlayRect]);

  const handleSelectGas = (gas: GasLevel) => {
    if (gas.level === 'custom') {
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
  };
  const [tempoTokenSheetVisible, setTempoTokenSheetVisible] =
    React.useState(false);
  const currentTempoToken = React.useMemo(() => {
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
  const currentTempoTokenLogo =
    currentTempoToken?.logo_url || gasToken?.logoUrl;
  const currentTempoTokenAmount = currentTempoToken
    ? formatTempoGasTokenAmount(currentTempoToken)
    : '-';
  const openTempoTokenSheet = React.useCallback(() => {
    setTempoTokenSheetVisible(true);
    onClose();
  }, [onClose]);

  if (!visible && !tempoTokenSheetVisible) {
    return null;
  }

  return (
    <>
      {visible ? (
        <SwapModal
          visible={visible}
          onCancel={onClose}
          overlayStyle={styles.overlay}
          overlayClose>
          <View
            ref={overlayRef}
            pointerEvents="box-none"
            style={styles.overlayContent}
            onLayout={measureOverlay}>
            <View
              onLayout={event => {
                const { width, height } = event.nativeEvent.layout;
                setContentSize({ width, height });
              }}
              style={[
                styles.container,
                styles.anchoredContainer,
                position
                  ? {
                      left: position.left,
                      top: position.top,
                    }
                  : styles.fallbackContainer,
              ]}>
              {shouldHideApprovalGasMethodTabs() ? null : (
                <View style={styles.header}>
                  <GasMethod
                    active={currentGasMethod === 'native'}
                    onChange={() => onChangeGasMethod?.('native')}
                    ActiveComponent={IconGasTokenActive}
                    BlurComponent={IconGasTokenCC}
                    title={'Use Gas token'}
                  />
                  <GasMethod
                    active={currentGasMethod === 'gasAccount'}
                    onChange={() => onChangeGasMethod?.('gasAccount')}
                    ActiveComponent={IconGasAccountActive}
                    BlurComponent={IconGasAccountCC}
                    title={'Use Gasaccount'}
                  />
                </View>
              )}
              {showTempoGasTokenSelector &&
              currentGasMethod !== 'gasAccount' ? (
                <TouchableOpacity
                  style={styles.tempoTokenCurrentRow}
                  onPress={openTempoTokenSheet}>
                  <Text style={styles.tempoTokenSectionTitle}>Gas token</Text>
                  <View style={styles.tempoTokenCurrentValue}>
                    {tempoGasTokenLoading && !currentTempoToken ? (
                      <CustomSkeleton style={styles.tempoLoadingSkeleton} />
                    ) : (
                      <>
                        <AssetAvatar size={20} logo={currentTempoTokenLogo} />
                        <Text style={styles.tempoTokenSymbol} numberOfLines={1}>
                          {currentTempoTokenSymbol}
                        </Text>
                        <Text style={styles.tempoTokenAmount} numberOfLines={1}>
                          {currentTempoTokenAmount}
                        </Text>
                      </>
                    )}
                    <IconGasCustomRightArrowCC
                      color={colors2024['neutral-foot']}
                    />
                  </View>
                </TouchableOpacity>
              ) : null}
              <View>
                {gasList.map(gas => {
                  const gwei = new BigNumber(gas.price / 1e9)
                    .toFixed()
                    .slice(0, 8);
                  const levelTitle = t(getGasLevelI18nKey(gas.level));
                  const isActive = selectedGas?.level === gas.level;
                  const isCustom = gas.level === 'custom';
                  const levelNativeInsufficient = isCustom
                    ? false
                    : !!levelState[gas.level]?.nativeNotEnough;
                  const displayMethod = isActive
                    ? resolveApprovalGasMethod({
                        nativeTokenInsufficient: !!nativeTokenInsufficient,
                        gasAccountChainSupported: !!gasAccountChainSupported,
                        noCustomRPC: noCustomRPCEnabled,
                        freeGasAvailable,
                        legacyGasMethod: currentGasMethod,
                      })
                    : resolveApprovalGasLevelMethod({
                        isCustom,
                        currentGasMethod,
                        nativeTokenInsufficient: levelNativeInsufficient,
                        gasAccountChainSupported: !!gasAccountChainSupported,
                        noCustomRPC: noCustomRPCEnabled,
                        freeGasAvailable,
                      });
                  const isRowLoading = !!levelState[gas.level]?.loading;

                  let costUsd =
                    displayMethod === 'native'
                      ? levelState[gas.level]?.nativeUsd
                      : levelState[gas.level]?.gasAccount?.[1];

                  const isNotEnough = resolveApprovalDisplayedGasLevelNotEnough(
                    {
                      isActive,
                      displayMethod,
                      nativeTokenInsufficient: !!nativeTokenInsufficient,
                      gasAccountBalanceEnough:
                        gasAccountCost?.balance_is_enough,
                      levelNativeInsufficient:
                        levelState[gas.level]?.nativeNotEnough,
                      levelGasAccountNotEnough:
                        levelState[gas.level]?.gasAccount?.[0],
                    },
                  );

                  costUsd = isActive
                    ? displayMethod === 'gasAccount'
                      ? calcGasAccountUsd(
                          (gasAccountCost?.gas_account_cost.estimate_tx_cost ||
                            0) +
                            (gasAccountCost?.gas_account_cost.gas_cost || 0),
                        )
                      : selectedGasCostUsdStr
                    : costUsd;

                  if (!costUsd) {
                    costUsd = isActive ? selectedGasCostUsdStr : '-';
                  }

                  return (
                    <TouchableOpacity
                      key={gas.level}
                      style={[
                        styles.gasLevel,
                        !isActive && styles.gasLevelInactive,
                      ]}
                      onPress={() => {
                        if (shouldHideApprovalGasMethodTabs()) {
                          onChangeGasMethod?.(displayMethod);
                        }
                        handleSelectGas(gas);
                        onClose();
                      }}>
                      <View style={styles.levelRow}>
                        <Text style={styles.level}>{levelTitle}</Text>
                        {!isCustom && (
                          <Text style={styles.gwei}> ({gwei} Gwei) </Text>
                        )}
                        {isActive && <IconGasLevelChecked />}
                      </View>

                      {isCustom ? (
                        <>
                          {isActive ? (
                            <Text
                              style={[
                                styles.usd,
                                styles.customActiveUsd,
                                isNotEnough && {
                                  color: colors2024['red-default'],
                                },
                              ]}>
                              {costUsd}
                            </Text>
                          ) : null}
                          <IconGasCustomRightArrowCC
                            color={colors2024['neutral-foot']}
                          />
                        </>
                      ) : isRowLoading ? (
                        <CustomSkeleton style={styles.rowSkeleton} />
                      ) : (
                        <Text
                          style={[
                            styles.usd,
                            isNotEnough && {
                              color: colors2024['red-default'],
                            },
                          ]}>
                          {costUsd}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </SwapModal>
      ) : null}
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
  overlay: {
    backgroundColor: 'transparent',
  },
  overlayContent: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  gasHeaderItem: {
    flexDirection: 'row',
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    gap: 2,
  },
  gasHeaderItemActive: {
    backgroundColor: colors2024['brand-default'],
  },
  gasHeaderItemInactive: {
    backgroundColor: 'transparent',
  },
  inactiveText: {
    color: colors2024['neutral-foot'],
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  activeText: {
    color: colors2024['neutral-InvertHighlight'],
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  container: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: colors2024['neutral-line'],
    backgroundColor: colors2024['neutral-bg-1'],
    shadowColor: 'rgba(0, 0, 0, 0.13)',
    shadowOpacity: 1,
    shadowRadius: 25.4,
    shadowOffset: { width: 2, height: 4 },
    elevation: 25.4,
  },
  anchoredContainer: {
    position: 'absolute',
  },
  fallbackContainer: {
    top: 12,
    right: 12,
  },
  header: {
    padding: 2,
    borderRadius: 6,
    backgroundColor: colors2024['neutral-bg-2'],
    borderWidth: 0.5,
    borderColor: colors2024['neutral-line'],
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  tempoTokenCurrentRow: {
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
    marginBottom: 12,
  },
  tempoTokenCurrentValue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    flexShrink: 1,
    marginLeft: 12,
  },
  tempoTokenSectionTitle: {
    color: colors2024['neutral-info'],
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  tempoLoadingSkeleton: {
    width: 40,
    height: 12,
    borderRadius: 6,
  },
  tempoTokenSymbol: {
    color: colors2024['neutral-title-1'],
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  tempoTokenAmount: {
    color: colors2024['neutral-title-1'],
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  gasLevel: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: colors2024['brand-default'],
    backgroundColor: colors2024['brand-light-1'],
  },
  gasLevelInactive: {
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 60,
  },
  level: {
    color: colors2024['neutral-title-1'],
    fontSize: 13,
    fontWeight: '500',
  },
  gwei: {
    color: colors2024['neutral-info'],
    fontSize: 10,
    fontWeight: '400',
    lineHeight: 12,
  },
  usd: {
    color: colors2024['neutral-title-1'],
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  customActiveUsd: {
    marginLeft: 'auto',
  },
  rowSkeleton: {
    width: 56,
    height: 16,
    borderRadius: 8,
  },
}));
