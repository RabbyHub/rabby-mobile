import { RcArrowRight2CC, RcIconInfoFillCC } from '@/assets/icons/common';
import { AppSwitch } from '@/components';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

export const PerpsOpenPositionPopup: React.FC<{
  visible?: boolean;
  onClose?(): void;
}> = ({ visible, onClose }) => {
  const modalRef = useRef<AppBottomSheetModal>(null);

  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyle,
  });

  const { t } = useTranslation();

  const { height } = useWindowDimensions();
  const maxHeight = useMemo(() => {
    return height - 200;
  }, [height]);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.dismiss();
    }
  }, [visible]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      // snapPoints={snapPoints}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg2',
      })}
      onDismiss={onClose}
      enableDynamicSizing
      maxDynamicContentSize={maxHeight}>
      <BottomSheetScrollView>
        <AutoLockView style={[styles.container]}>
          <View>
            <Text style={styles.title}>Long ETH-USD</Text>
          </View>
          <View style={styles.formItem}>
            <Text style={styles.formItemLabel}>Margin</Text>

            <TextInput
              keyboardType="numeric"
              style={styles.input}
              placeholder="$0"
            />
            <Text style={styles.formItemDesc}>
              $100 {t('page.perps.PerpsWithdrawPopup.available')}
            </Text>
            <Text style={styles.errorMsg}>Insufficient balance</Text>
          </View>
          <View style={styles.list}>
            <View style={styles.listItem}>
              <View style={styles.listItemMain}>
                <Text style={styles.label}>
                  Leverage
                  <Text style={styles.labelInfo}>（1-40x）</Text>
                </Text>
              </View>
              <View>
                <TextInput
                  style={{
                    width: 50,
                    backgroundColor: 'red',
                    textAlign: 'right',
                  }}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View style={styles.listItem}>
              <View style={styles.listItemMain}>
                <Text style={styles.label}>Size</Text>
                <RcIconInfoFillCC
                  width={15}
                  height={15}
                  color={colors2024['neutral-info']}
                />
              </View>
              <View>
                <Text style={styles.value}>$50 = 0.0012 ETH</Text>
              </View>
            </View>
            <View style={styles.listItemContainer}>
              <View style={styles.listItemRow}>
                <View style={styles.listItemMain}>
                  <Text style={styles.label}>Auto Close</Text>
                </View>
                <View>
                  <AppSwitch
                    value={true}
                    circleSize={20}
                    circleBorderWidth={2}
                  />
                </View>
              </View>
              <View style={styles.listSub}>
                <View style={styles.listSubItem}>
                  <Text style={styles.listSubItemLabel}>Take-Profit Price</Text>
                  <Text style={styles.value}>$5000</Text>
                  <RcArrowRight2CC
                    width={16}
                    height={16}
                    color={colors2024['neutral-body']}
                  />
                </View>
                <View style={styles.listSubItem}>
                  <Text style={styles.listSubItemLabel}>Stop-Loss Price</Text>
                  <Text style={styles.value}>$5000</Text>
                  <RcArrowRight2CC
                    width={16}
                    height={16}
                    color={colors2024['neutral-body']}
                  />
                </View>
              </View>
            </View>
          </View>
          <Button type="primary" title={'Check'} onPress={() => {}} />
        </AutoLockView>
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    container: {
      height: '100%',
      paddingBottom: 56,
      paddingHorizontal: 20,
      minHeight: 544,
    },
    formItem: {
      paddingHorizontal: 16,
      paddingVertical: 18,
      borderRadius: 16,
      backgroundColor: colors2024['neutral-bg-1'],
      minHeight: 156,

      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 5,

      marginBottom: 18,
    },
    formItemLabel: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      textAlign: 'center',
    },
    formItemDesc: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
    },
    errorMsg: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['red-default'],
    },
    input: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 40,
      lineHeight: 48,
      fontWeight: '800',
      // color: ctx.colors2024['neutral-body'],
      flex: 1,
    },
    inputError: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '500',
      color: colors2024['neutral-error'],
      backgroundColor: colors2024['neutral-bg-2'],
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderColor: colors2024['neutral-error'],
      borderWidth: 1,
    },
    title: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '800',
      color: colors2024['neutral-title-1'],
      marginBottom: 16,
      textAlign: 'center',
    },
    list: {
      borderRadius: 16,
      backgroundColor: colors2024['neutral-bg-1'],
      marginBottom: 18,
    },
    listItemContainer: {
      padding: 16,
    },
    listItem: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      justifyContent: 'space-between',
    },
    listItemRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    listSub: {
      padding: 12,
      backgroundColor: colors2024['neutral-bg-2'],
      borderRadius: 6,
      marginTop: 12,
    },
    listSubItem: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 28,
    },
    listSubItemLabel: {
      flex: 1,
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['neutral-foot'],
    },
    listItemMain: {
      flex: 1,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 20,
    },
    label: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['neutral-foot'],
    },
    labelInfo: {
      color: colors2024['neutral-info'],
    },
    value: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
    },
  };
});
