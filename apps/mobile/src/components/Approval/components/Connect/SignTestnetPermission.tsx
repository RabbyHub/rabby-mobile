import React, { useMemo } from 'react';
import IconArrowdown from '@/assets/icons/approval/arrow-down.svg';
import { useTranslation } from 'react-i18next';
import {
  SIGN_PERMISSION_TYPES,
  SIGN_PERMISSION_OPTIONS,
} from '@/constant/permission';
import { preferenceService } from '@/core/services';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import {
  AppBottomSheetModal,
  AppBottomSheetModalTitle,
} from '@/components/customized/BottomSheet';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { Radio } from '@/components/Radio';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    container: {
      display: 'flex',
      alignItems: 'center',
      shadowColor: 'black',
      shadowOffset: { width: 0, height: -8 },
      shadowRadius: 24,
      shadowOpacity: 0.1,
      backgroundColor: colors['neutral-card-1'],
      paddingHorizontal: 20,
      paddingVertical: 11,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      flexDirection: 'row',
    },
    radioText: {
      fontSize: 15,
      fontWeight: '500',
      color: colors['neutral-title-1'],
      flex: 1,
    },
    radioGroup: {
      flexDirection: 'row',
      borderColor: colors['neutral-line'],
      borderBottomWidth: StyleSheet.hairlineWidth,
      paddingVertical: 17,
    },
    modalContainer: {
      paddingHorizontal: 20,
    },
    radioGroupContainer: {
      backgroundColor: colors['neutral-card-2'],
      borderRadius: 8,
      paddingHorizontal: 16,
      overflow: 'hidden',
    },
    title: {
      fontSize: 13,
      color: colors['neutral-body'],
      lineHeight: 18,
    },
    value: {
      display: 'flex',
      alignItems: 'center',
      marginLeft: 'auto',
      gap: 2,
      fontSize: 15,
      fontWeight: '500',
      color: colors['neutral-title-1'],
      lineHeight: 18,
      flexDirection: 'row',
    },
  });

interface SignTestnetPermissionProps {
  value?: SIGN_PERMISSION_TYPES;
  onChange?: (value: SIGN_PERMISSION_TYPES) => void;
}
export const SignTestnetPermission = ({
  value: _value,
  onChange,
}: SignTestnetPermissionProps) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const isShowTestnet = preferenceService.getIsShowTestnet();
  const modalRef = React.useRef<AppBottomSheetModal>(null);
  const value = _value || SIGN_PERMISSION_TYPES.MAINNET_AND_TESTNET;

  const { t } = useTranslation();
  const options = useMemo(
    () =>
      SIGN_PERMISSION_OPTIONS.map(item => {
        return {
          ...item,
          label: t(`constant.SIGN_PERMISSION_OPTIONS.${item.value}` as const),
        };
      }),
    [t],
  );
  const label = React.useMemo(() => {
    return options.find(item => item.value === value)?.label;
  }, [value, options]);

  if (!isShowTestnet) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {t('page.connect.SignTestnetPermission.title')}
      </Text>
      <TouchableOpacity
        style={styles.value}
        onPress={() => {
          modalRef.current?.present();
        }}>
        <Text style={styles.value}>{label}</Text>
        <IconArrowdown />
      </TouchableOpacity>

      <AppBottomSheetModal ref={modalRef} snapPoints={[300]}>
        <BottomSheetView style={styles.modalContainer}>
          <AppBottomSheetModalTitle
            title={t('page.connect.SignTestnetPermission.title')}
          />

          <View style={styles.radioGroupContainer}>
            {options.map(item => {
              return (
                <View key={item.value} style={styles.radioGroup}>
                  <Radio
                    title={item.label}
                    right
                    iconRight
                    textStyle={styles.radioText}
                    checked={value === item.value}
                    onPress={_ => {
                      onChange?.(item.value);
                      modalRef.current?.dismiss();
                    }}
                  />
                </View>
              );
            })}
          </View>
        </BottomSheetView>
      </AppBottomSheetModal>
    </View>
  );
};
