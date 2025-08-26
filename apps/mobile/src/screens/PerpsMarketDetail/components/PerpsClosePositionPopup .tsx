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
  BottomSheetView,
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

export const PerpsClosePositionPopup: React.FC<{
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
      // enableDynamicSizing
      snapPoints={[358]}
      maxDynamicContentSize={maxHeight}>
      <BottomSheetView>
        <AutoLockView style={[styles.container]}>
          <View>
            <Text style={styles.title}>Close ETH-USD Long Position</Text>
          </View>

          <View style={styles.list}>
            <View style={styles.listItem}>
              <View style={styles.listItemMain}>
                <Text style={styles.label}>Position Size</Text>
              </View>
              <View>
                <Text style={styles.value}>-0.0031 ETH</Text>
              </View>
            </View>
            <View style={styles.listItem}>
              <View style={styles.listItemMain}>
                <Text style={styles.label}>PNL</Text>
              </View>
              <View>
                <Text style={styles.value}>+$0.0043(0.22%)</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity>
            <View style={styles.feeContainer}>
              <Text style={styles.fee}>Fee : $1.00</Text>
              <RcIconInfoFillCC color={'#CED0DA'} width={15} height={15} />
            </View>
          </TouchableOpacity>
          <Button
            type="primary"
            title={'Open Long Position'}
            onPress={() => {}}
          />
        </AutoLockView>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    container: {
      height: '100%',
      paddingBottom: 56,
      paddingHorizontal: 20,
      // minHeight: 544,
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
    feeContainer: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      marginTop: 26,
      marginBottom: 16,
    },
    fee: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '400',
      fontFamily: 'SF Pro Rounded',
      color: colors2024['neutral-foot'],
    },
  };
});
