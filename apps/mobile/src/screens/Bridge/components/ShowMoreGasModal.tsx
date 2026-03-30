import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, useWindowDimensions, View } from 'react-native';
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
import { formatGasHeaderUsdValue } from '@/utils/number';
import { useMiniSignFixedMode } from '@/hooks/miniSignGasStore';
import type { SignatureFlowState } from '@/components2024/MiniSignV2';
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
        {
          backgroundColor: active ? colors2024['brand-default'] : 'transparent',
        },
      ]}
      onPress={onChange}>
      <ActiveComponent
        style={{
          display: active ? 'flex' : 'none',
        }}
      />
      <BlurComponent
        color={colors2024['neutral-foot']}
        style={{
          display: active ? 'none' : 'flex',
        }}
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

  const { height, width } = useWindowDimensions();

  const fixedMode = useMiniSignFixedMode(chainId);

  const calcGasAccountUsd = useCallback(n => {
    const v = Number(n);
    if (!Number.isNaN(v) && v < 0.0001) {
      return `$${n}`;
    }
    return formatGasHeaderUsdValue(n || '0');
  }, []);

  // const hasCustomRpc = !ctx?.noCustomRPC;

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

  if (!ctx?.txsCalc?.length) return null;

  return (
    <SwapModal
      visible={visible}
      onCancel={onCancel}
      overlayStyle={styles.overlay}
      overlayClose>
      <View
        style={[
          styles.container,
          {
            position: 'absolute',
            right: width - (layout.x + layout.width),
            bottom: height - layout.y + 10,
          },
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
          {ctx?.gasList?.map(gas => {
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

            const isGasAccountLoading =
              !isActive &&
              ctx.gasMethod === 'gasAccount' &&
              (gasAccountIsNotEnough?.[gas.level]?.[1] === '' ||
                gasAccountIsNotEnough?.[gas.level]?.[1] === 0);

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
                  !isActive && {
                    borderColor: 'transparent',
                    backgroundColor: 'transparent',
                  },
                ]}
                onPress={() => {
                  externalPanelSelection?.(gas);
                  if (gas.level === 'custom') {
                    handleClickEdit?.();
                  }
                  onCancel();
                }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
                          {
                            marginLeft: 'auto',
                          },
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
    </SwapModal>
  );
}

const getStyle = createGetStyles2024(({ colors, colors2024 }) => ({
  overlay: {
    backgroundColor: 'transparent',
  },
  gasHeaderItem: {
    flexDirection: 'row',
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    // backgroundColor: active ? colors2024['brand-default'] : 'transparent',
    paddingVertical: 2,
    paddingHorizontal: 8,
    gap: 2,
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
    // box-shadow: 2px 4px 25.4px 15px rgba(0, 0, 0, 0.03);
    shadowColor: 'rgba(0, 0, 0, 0.13)',
    shadowOpacity: 1,
    shadowRadius: 25.4,
    shadowOffset: { width: 2, height: 4 },
    elevation: 25.4,
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
    display: 'flex',
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
  fixedMode: {
    // padding: '1 4',
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
}));
