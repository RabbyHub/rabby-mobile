import { CHAINS_ENUM } from '@/constant/chains';
import { TxPushType } from '@rabby-wallet/rabby-api/dist/types';
import { useRequest } from 'ahooks';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import {
  AppBottomSheetModal,
  AppBottomSheetModalTitle,
} from '@/components/customized/BottomSheet';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { openapi } from '@/core/request';
import { Tip } from '@/components/Tip';
import { useThemeColors } from '@/hooks/theme';
import { getStyles } from './styles';
import { TouchableOpacity } from 'react-native';
import { Card } from '../Actions/components/Card';
import { Radio } from '@/components/Radio';
import { findChain } from '@/utils/chain';
import { Account } from '@/core/services/preference';

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
  account: Account;
}
export const BroadcastMode = ({
  value,
  onChange,
  style,
  chain,
  isSpeedUp,
  isCancel,
  isGasTopUp,
  account,
}: BroadcastModeProps) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [drawerVisible, setDrawerVisible] = React.useState(false);
  const { t } = useTranslation();
  const { data: supportedPushType } = useRequest(
    () =>
      openapi.gasSupportedPushType(
        findChain({
          enum: chain,
        })?.serverId || '',
      ),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <Card
      style={style}
      onAction={() => {
        setDrawerVisible(true);
      }}
      headline={t('page.signTx.BroadcastMode.title')}
      actionText={selectedOption?.title}
      hasDivider={value.type !== 'default'}>
      {value.type !== 'default' && (
        <View>
          <View style={styles.broadcastModeBody}>
            <View style={styles.broadcastModeBodyUl}>
              <View style={StyleSheet.flatten([styles.broadcastModeBodyLi])}>
                <View style={styles.broadcastModeBodyLiBefore} />

                <Text style={styles.broadcastModeBodyLiText}>
                  {selectedOption?.desc}
                </Text>
              </View>
              {value.type === 'low_gas' ? (
                <View style={StyleSheet.flatten([styles.broadcastModeBodyLi])}>
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
              ) : null}
            </View>
          </View>
        </View>
      )}
      <AppBottomSheetModal
        ref={modalRef}
        enableDynamicSizing
        handleStyle={styles.modal}
        onDismiss={() => setDrawerVisible(false)}>
        <BottomSheetView style={styles.modal}>
          <AppBottomSheetModalTitle
            title={t('page.signTx.BroadcastMode.title')}
          />
          <View style={styles.footer}>
            {options.map(option => (
              <View
                key={option.value}
                style={StyleSheet.flatten([
                  styles.footerItem,
                  option.value === value.type ? styles.checked : {},
                  option.disabled ? styles.disabled : {},
                ])}>
                <Radio
                  containerStyle={styles.footerRadio}
                  textStyle={styles.footerItemText}
                  iconStyle={styles.radioIcon}
                  right
                  iconRight
                  title={
                    option.disabled ? (
                      <Tip
                        parentWrapperStyle={StyleSheet.flatten({
                          flex: 1,
                        })}
                        content={option.tips}>
                        <Text style={styles.optionTitle}>{option.title}</Text>
                        <Text style={styles.optionDesc}>{option.desc}</Text>
                      </Tip>
                    ) : (
                      <View
                        style={StyleSheet.flatten({
                          flex: 1,
                        })}>
                        <Text style={styles.optionTitle}>{option.title}</Text>
                        <Text style={styles.optionDesc}>{option.desc}</Text>
                      </View>
                    )
                  }
                  checked={option.value === value.type}
                  onPress={e => {
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
                  }}
                />
              </View>
            ))}
          </View>
        </BottomSheetView>
      </AppBottomSheetModal>
    </Card>
  );
};
