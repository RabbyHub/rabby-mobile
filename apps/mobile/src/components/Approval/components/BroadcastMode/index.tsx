import { CHAINS_ENUM } from '@debank/common';
import { CHAINS } from '@/constant/chains';
import { TxPushType } from '@rabby-wallet/rabby-api/dist/types';
import { useRequest } from 'ahooks';
import clsx from 'clsx';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import {
  AppBottomSheetModal,
  AppBottomSheetModalTitle,
} from '@/components/customized/BottomSheet';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useCurrentAccount } from '@/hooks/account';
import { openapi } from '@/core/request';
import { Tip } from '@/components/Tip';
import IconArrowRight from '@/assets/icons/approval/edit-arrow-right.svg';
import IconChecked from '@/assets/icons/common/box-checked.svg';
import IconUnChecked from '@/assets/icons/common/box-unchecked.svg';
import { useThemeColors } from '@/hooks/theme';
import { getStyles } from './styles';
import { TouchableOpacity } from 'react-native';

// const OptionList = styled.div`
//   margin-bottom: -12px;
//   .option {
//     padding: 12px 16px;
//     border-radius: 6px;
//     background: var(--r-neutral-card-2, #f2f4f7);
//     border: 1px solid transparent;
//     cursor: pointer;

//     & + .option {
//       margin-top: 12px;
//     }

//     &.is-selected {
//       border: 1px solid var(--r-blue-default, #7084ff);
//       background: var(--r-blue-light-1, #eef1ff);
//     }
//     &:not(.is-disabled):hover {
//       border: 1px solid var(--r-blue-default, #7084ff);
//     }

//     &.is-disabled {
//       cursor: not-allowed;
//       opacity: 0.5;
//     }

//     &-title {
//       color: var(--r-neutral-title-1, #192945);
//       font-size: 15px;
//       font-weight: 500;
//       line-height: 18px;
//       margin-bottom: 4px;
//     }

//     &-desc {
//       color: var(--r-neutral-body, #3e495e);
//       font-size: 13px;
//       font-weight: 400;
//       line-height: 16px;
//     }
//   }
// `;

interface BroadcastModeProps {
  value: {
    type: TxPushType;
    lowGasDeadline?: number;
  };
  onChange?: (value: { type: TxPushType; lowGasDeadline?: number }) => void;
  style?: StyleProp<ViewStyle>;
  chain: CHAINS_ENUM;
  isSpeedUp?: boolean;
  isCancel?: boolean;
  isGasTopUp?: boolean;
}
export const BroadcastMode = ({
  value,
  onChange,
  style,
  chain,
  isSpeedUp,
  isCancel,
  isGasTopUp,
}: BroadcastModeProps) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [drawerVisible, setDrawerVisible] = React.useState(false);
  const { t } = useTranslation();
  const { currentAccount: account } = useCurrentAccount();
  const { data: supportedPushType } = useRequest(
    () => openapi.gasSupportedPushType(CHAINS[chain]?.serverId),
    {
      refreshDeps: [chain],
    },
  );
  // const { data: hasCustomRPC } = useRequest(() => wallet.hasCustomRPC(chain), {
  //   refreshDeps: [chain],
  // });
  const hasCustomRPC = false;

  const disabledMap = React.useMemo(() => {
    const result = {
      low_gas: {
        disabled: false,
        tips: '',
      },
      mev: {
        disabled: false,
        tips: '',
      },
    };
    if (hasCustomRPC) {
      Object.keys(result).forEach(key => {
        result[key] = {
          disabled: true,
          tips: t('page.signTx.BroadcastMode.tips.customRPC'),
        };
      });
      return result;
    }

    if (account?.type === 'WalletConnect') {
      Object.keys(result).forEach(key => {
        result[key] = {
          disabled: true,
          tips: t('page.signTx.BroadcastMode.tips.walletConnect'),
        };
      });

      return result;
    }

    Object.entries(supportedPushType || {}).forEach(([key, value]) => {
      if (!value) {
        result[key] = {
          disabled: true,
          tips: t('page.signTx.BroadcastMode.tips.notSupportChain'),
        };
      }
    });
    if (isSpeedUp || isCancel || isGasTopUp) {
      result.low_gas.disabled = true;
      result.low_gas.tips = t('page.signTx.BroadcastMode.tips.notSupported');
    }
    return result;
  }, [supportedPushType, account?.type]);

  useEffect(() => {
    if (value?.type && disabledMap[value.type]?.disabled) {
      onChange?.({
        type: 'default',
      });
    }
  }, [disabledMap, value.type, onChange]);

  const options: {
    title: string;
    desc: string;
    value: TxPushType;
    disabled?: boolean;
    tips?: string;
  }[] = [
    {
      title: t('page.signTx.BroadcastMode.instant.title'),
      desc: t('page.signTx.BroadcastMode.instant.desc'),
      value: 'default',
    },
    {
      title: t('page.signTx.BroadcastMode.lowGas.title'),
      desc: t('page.signTx.BroadcastMode.lowGas.desc'),
      value: 'low_gas',
      disabled: disabledMap.low_gas.disabled,
      tips: disabledMap.low_gas.tips,
    },
    {
      title: t('page.signTx.BroadcastMode.mev.title'),
      desc: t('page.signTx.BroadcastMode.mev.desc'),
      value: 'mev',
      disabled: disabledMap.mev.disabled,
      tips: disabledMap.mev.tips,
    },
  ];

  const deadlineOptions = [
    {
      title: t('page.signTx.BroadcastMode.lowGasDeadline.1h'),
      value: 1 * 60 * 60,
    },
    {
      title: t('page.signTx.BroadcastMode.lowGasDeadline.4h'),
      value: 4 * 60 * 60,
    },
    {
      title: t('page.signTx.BroadcastMode.lowGasDeadline.24h'),
      value: 24 * 60 * 60,
    },
  ];

  const selectedOption = options.find(option => option.value === value.type);

  const modalRef = useRef<AppBottomSheetModal>(null);

  useEffect(() => {
    if (drawerVisible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [drawerVisible]);

  return (
    <View style={StyleSheet.flatten([styles.wrapper, style])}>
      <View>
        <View style={styles.broadcastModeHeader}>
          <Text style={styles.broadcastModeTitle}>
            {t('page.signTx.BroadcastMode.title')}
          </Text>
          <TouchableOpacity
            style={styles.broadcastModeExtra}
            onPress={() => {
              setDrawerVisible(true);
            }}>
            <Text style={styles.broadcastModeExtraText}>
              {selectedOption?.title}
            </Text>
            <IconArrowRight />
          </TouchableOpacity>
        </View>
        <View style={styles.broadcastModeBody}>
          <View style={styles.broadcastModeBodyUl}>
            <View
              style={StyleSheet.flatten([
                styles.broadcastModeBodyLi,
                styles.broadcastModeBodyLiFirst,
              ])}>
              <View style={styles.broadcastModeBodyLiBefore} />
              <Text style={styles.broadcastModeBodyLiText}>
                {selectedOption?.desc}
              </Text>
            </View>
            {/* TODO: 当前不需要，WalletConnect 不支持 */}
            {/* {value.type === 'low_gas' ? (
              <View
                style={StyleSheet.flatten([
                  styles.broadcastModeBodyLi,
                ])}>
                <View style={styles.broadcastModeBodyLiBefore} />

                <Text style={styles.broadcastModeBodyLiText}>
                  {t('page.signTx.BroadcastMode.lowGasDeadline.label')}
                </Text>
                <View style={styles.deadlineOptions}>
                  {deadlineOptions.map(item => {
                    return (
                      <TouchableOpacity
                        key={item.value}
                        style={StyleSheet.flatten([
                          styles.deadlineOption,
                          item.value === value.lowGasDeadline &&
                            styles.deadlineOptionSelected,
                        ])}
                        onPress={() => {
                          onChange?.({
                            type: value.type,
                            lowGasDeadline: item.value,
                          });
                        }}>
                        <Text style={styles.deadlineOptionText}>
                          {item.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null} */}
          </View>
        </View>
      </View>
      {/* TODO: 当前不需要，WalletConnect 不支持 */}
      {/* <AppBottomSheetModal
        ref={modalRef}
        snapPoints={['50%']}
        onDismiss={() => setDrawerVisible(false)}>
        <BottomSheetView>
          <AppBottomSheetModalTitle
            title={t('page.signTx.BroadcastMode.title')}
          />
          <OptionList>
            {options.map(option => (
              <Tip content={option.tips || ''} key={option.value}>
                <div
                  className={clsx(
                    'option',
                    option.value === value.type && 'is-selected',
                    option.disabled && 'is-disabled',
                  )}
                  onClick={() => {
                    if (option.disabled) {
                      return;
                    }
                    onChange?.({
                      type: option.value,
                      lowGasDeadline:
                        option.value === 'low_gas'
                          ? deadlineOptions[1]?.value
                          : undefined,
                    });
                    setDrawerVisible(false);
                  }}>
                  <div className="flex items-center gap-[4px]">
                    <div className="mr-auto">
                      <div className="option-title">{option.title}</div>
                      <div className="option-desc">{option.desc}</div>
                    </div>
                    {option.value === value.type ? (
                      <IconChecked />
                    ) : (
                      <IconUnChecked />
                    )}
                  </div>
                </div>
              </Tip>
            ))}
          </OptionList>
        </BottomSheetView>
      </AppBottomSheetModal> */}
    </View>
  );
};
