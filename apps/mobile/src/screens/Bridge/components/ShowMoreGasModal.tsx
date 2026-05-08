import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { SwapModal } from '@/screens/Swap/components/Modal';
import { SvgProps } from 'react-native-svg';
import IconGasTokenCC from '@/assets2024/icons/gas-account/gas-token-cc.svg';
import IconGasAccountCC from '@/assets2024/icons/gas-account/gas-account-cc.svg';
import IconGasTokenActive from '@/assets2024/icons/gas-account/gas-token-active.svg';
import IconGasAccountActive from '@/assets2024/icons/gas-account/gas-account-active.svg';
import IconGasCustomRightArrowCC from '@/assets2024/icons/gas-account/right-arrow-cc.svg';
import IconGasLevelChecked from '@/assets2024/icons/gas-account/check.svg';
import BigNumber from 'bignumber.js';
import { getGasLevelI18nKey } from '@/utils/trans';
import { getAnchoredPopoverPosition } from '@/utils/anchoredPopover';
import { calcGasAccountUsd } from '@/components/Approval/components/TxComponents/GasSelector/directSignSummary';
import { useMiniSignFixedMode } from '@/hooks/miniSignGasStore';
import type { SignatureFlowState } from '@/components2024/MiniSignV2/state/types';
import type { MiniSignGasPanelInfo } from '@/components2024/MiniSignV2/state/useMiniSignGasPanel';
import { GAS_ACCOUNT_INSUFFICIENT_TIP } from '@/screens/GasAccount/hooks/checkTsx';
import { Text } from '@/components/Typography';

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
      <ActiveComponent
        style={active ? styles.iconVisible : styles.iconHidden}
      />
      <BlurComponent
        color={colors2024['neutral-foot']}
        style={active ? styles.iconHidden : styles.iconVisible}
      />
      <Text style={active ? styles.activeText : styles.inactiveText}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

export default function ShowMoreGasSelectModal({
  visible,
  onCancel,
  onConfirm: _onConfirm,
  layout,
  chainId,
  ctx,
  gasInfo,
  onChangeGasMethod,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  layout: { x: number; y: number; width: number; height: number };
  chainId?: number;
  ctx?: SignatureFlowState['ctx'];
  gasInfo?: MiniSignGasPanelInfo;
  onChangeGasMethod: (method: 'native' | 'gasAccount') => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const fixedMode = useMiniSignFixedMode(chainId);
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

  const {
    externalPanelSelection,
    handleClickEdit,
    gasCostUsdStr,
    gasUsdList,
    gasIsNotEnough,
    gasAccountIsNotEnough,
    gasAccountCost,
  } = gasInfo || {};
  const gasAccountErrorMsg = (ctx?.gasAccount as any)?.err_msg as string;
  const gasAccountError =
    !!gasAccountErrorMsg &&
    gasAccountErrorMsg?.toLowerCase() !==
      GAS_ACCOUNT_INSUFFICIENT_TIP.toLowerCase();

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

  if (!ctx?.txsCalc?.length) {
    return null;
  }

  return (
    <SwapModal
      visible={visible}
      onCancel={onCancel}
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
              : styles.hiddenUntilMeasured,
          ]}>
          <View style={styles.header}>
            <GasMethod
              active={ctx.gasMethod === 'native'}
              onChange={() => onChangeGasMethod('native')}
              ActiveComponent={IconGasTokenActive}
              BlurComponent={IconGasTokenCC}
              title={'Use Gas token'}
            />
            <GasMethod
              active={ctx.gasMethod === 'gasAccount'}
              onChange={() => onChangeGasMethod('gasAccount')}
              ActiveComponent={IconGasAccountActive}
              BlurComponent={IconGasAccountCC}
              title={'Use Gasaccount'}
            />
          </View>
          <View>
            {ctx.gasList?.map(gas => {
              const gwei = new BigNumber(gas.price / 1e9).toFixed().slice(0, 8);
              const levelTitle = t(getGasLevelI18nKey(gas.level));
              const isActive = ctx.selectedGas?.level === gas.level;
              const isCustom = gas.level === 'custom';
              let costUsd =
                ctx.gasMethod === 'native'
                  ? gasUsdList?.[gas.level]
                  : gasAccountIsNotEnough?.[gas.level]?.[1];

              const isNotEnough =
                ctx.gasMethod === 'native'
                  ? gasIsNotEnough?.[gas.level]
                  : gasAccountIsNotEnough?.[gas.level]?.[0];

              const errorOnGasAccount =
                ctx.gasMethod === 'gasAccount' && !!gasAccountError;

              costUsd = isActive
                ? ctx.gasMethod === 'gasAccount'
                  ? calcGasAccountUsd(
                      (gasAccountCost?.estimate_tx_cost || 0) +
                        (gasAccountCost?.gas_cost || 0),
                    )
                  : gasCostUsdStr
                : costUsd;

              return (
                <TouchableOpacity
                  key={gas.level}
                  style={[
                    styles.gasLevel,
                    !isActive && styles.gasLevelInactive,
                  ]}
                  onPress={() => {
                    externalPanelSelection?.(gas);
                    if (gas.level === 'custom') {
                      handleClickEdit?.();
                    }
                    onCancel();
                  }}>
                  <View style={styles.levelRow}>
                    <Text style={styles.level}>{levelTitle}</Text>
                    {isCustom && fixedMode ? (
                      <Text style={styles.fixedMode}>Fixed mode</Text>
                    ) : null}
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
                            (isNotEnough || errorOnGasAccount) && {
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
                  ) : (
                    <Text
                      style={[
                        styles.usd,
                        (isNotEnough || errorOnGasAccount) && {
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
  );
}

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
  iconVisible: {
    display: 'flex',
  },
  iconHidden: {
    display: 'none',
  },
  inactiveText: {
    color: colors2024['neutral-foot'],
    fontSize: 12,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 16,
  },
  activeText: {
    color: colors2024['neutral-InvertHighlight'],
    fontSize: 12,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 16,
  },
  container: {
    padding: 12,
    paddingBottom: 4,
    borderRadius: 12,
    borderWidth: 0.5,
    borderStyle: 'solid',
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
  hiddenUntilMeasured: {
    opacity: 0,
  },
  header: {
    padding: 2,
    borderRadius: 6,
    backgroundColor: colors2024['neutral-bg-2'],
    borderWidth: 0.5,
    borderStyle: 'solid',
    borderColor: colors2024['neutral-line'],
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  gasLevel: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 0.5,
    borderStyle: 'solid',
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
  },
  fixedMode: {
    color: colors2024['brand-default'],
    paddingVertical: 1,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 16,
    backgroundColor: colors2024['brand-light-1'],
    borderRadius: 4,
    marginLeft: 2,
    marginRight: 6,
    overflow: 'hidden',
  },
  level: {
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    fontSize: 13,
    fontStyle: 'normal',
    fontWeight: '500',
  },
  gwei: {
    color: colors2024['neutral-info'],
    fontSize: 10,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 12,
  },
  usd: {
    color: colors2024['neutral-title-1'],
    fontSize: 12,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 16,
  },
  customActiveUsd: {
    marginLeft: 'auto',
  },
}));
