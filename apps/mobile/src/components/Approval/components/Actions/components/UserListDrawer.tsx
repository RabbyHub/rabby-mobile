import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppBottomSheetModal,
  AppBottomSheetModalTitle,
} from '@/components/customized/BottomSheet';
import { Radio } from '@/components/Radio';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Chain } from '@/constant/chains';
import { BottomSheetView } from '@gorhom/bottom-sheet';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    mainView: {
      paddingHorizontal: 20,
      backgroundColor: colors['neutral-bg-2'],
      paddingBottom: 40,
    },
    origin: {
      display: 'flex',
      marginBottom: 80,
      fontWeight: 500,
      fontSize: 22,
      lineHeight: 26,
      color: colors['neutral-title-1'],
      flexDirection: 'row',
    },
    logo: {
      width: 24,
      height: 24,
      marginRight: 8,
    },
    text: {
      flex: 1,
      overflow: 'hidden',
    },
    modal: {
      backgroundColor: colors['neutral-bg-2'],
    },
    footer: {
      gap: 12,
    },
    footerItem: {
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      position: 'relative',
      flexDirection: 'row',
      backgroundColor: colors['neutral-card-1'],
      borderRadius: 6,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    radioIcon: {
      width: 20,
      height: 20,
    },
    footerItemText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
    },
    checked: {
      borderColor: colors['blue-default'],
      backgroundColor: colors['blue-light1'],
    },
  });

interface Props {
  address: string;
  chain?: Chain;
  onWhitelist: boolean;
  onBlacklist: boolean;
  visible: boolean;
  onClose(): void;
  onChange({
    onWhitelist,
    onBlacklist,
  }: {
    onWhitelist: boolean;
    onBlacklist: boolean;
  }): void;
}

const UserListDrawer = ({
  address,
  chain,
  onWhitelist,
  onBlacklist,
  onChange,
  visible,
  onClose,
}: Props) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const modalRef = React.useRef<AppBottomSheetModal>(null);
  React.useEffect(() => {
    if (!visible) {
      modalRef.current?.close();
    } else {
      modalRef.current?.present();
    }
  }, [visible]);
  return (
    <AppBottomSheetModal
      ref={modalRef}
      onDismiss={onClose}
      enableDynamicSizing
      handleStyle={styles.modal}>
      <BottomSheetView style={styles.mainView}>
        <AppBottomSheetModalTitle
          title={t('page.signTx.myMarkWithContract', {
            chainName: chain?.name,
          })}
        />
        <View style={styles.footer}>
          <TouchableOpacity
            style={StyleSheet.flatten([
              styles.footerItem,
              !onWhitelist && !onBlacklist ? styles.checked : {},
            ])}
            onPress={() =>
              onChange({ onBlacklist: false, onWhitelist: false })
            }>
            <Radio
              textStyle={StyleSheet.flatten([
                {
                  color: colors['neutral-title-1'],
                },
                styles.footerItemText,
              ])}
              iconStyle={styles.radioIcon}
              right
              iconRight
              title={t('page.signTx.noMark')}
              checked={!onWhitelist && !onBlacklist}
              onPress={() =>
                onChange({ onBlacklist: false, onWhitelist: false })
              }
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={StyleSheet.flatten([
              styles.footerItem,
              onWhitelist && !onBlacklist ? styles.checked : {},
            ])}
            onPress={() => onChange({ onBlacklist: false, onWhitelist: true })}>
            <Radio
              textStyle={StyleSheet.flatten([
                {
                  color: colors['green-default'],
                },
                styles.footerItemText,
              ])}
              iconStyle={styles.radioIcon}
              right
              iconRight
              title={t('page.signTx.trusted')}
              checked={onWhitelist && !onBlacklist}
              onPress={() =>
                onChange({ onBlacklist: false, onWhitelist: true })
              }
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={StyleSheet.flatten([
              styles.footerItem,
              !onWhitelist && onBlacklist ? styles.checked : {},
            ])}
            onPress={() => onChange({ onBlacklist: true, onWhitelist: false })}>
            <Radio
              textStyle={StyleSheet.flatten([
                {
                  color: colors['red-default'],
                },
                styles.footerItemText,
              ])}
              iconStyle={styles.radioIcon}
              right
              iconRight
              title={t('page.signTx.blocked')}
              checked={!onWhitelist && onBlacklist}
              onPress={() =>
                onChange({ onBlacklist: true, onWhitelist: false })
              }
            />
          </TouchableOpacity>
        </View>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

export default UserListDrawer;
