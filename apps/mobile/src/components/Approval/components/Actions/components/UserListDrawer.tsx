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
import { Chain } from '@debank/common';
import { BottomSheetView } from '@gorhom/bottom-sheet';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    mainView: {
      paddingHorizontal: 20,
      backgroundColor: colors['neutral-bg-1'],
      height: '100%',
    },
    footer: {
      backgroundColor: '#f5f6fa',
      borderRadius: 6,
    },
    item: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 15,
      fontWeight: '500',
      fontSize: 13,
      lineHeight: 15,
      color: '#13141a',
      position: 'relative',
      borderBottomWidth: 1,
      borderBottomColor: '#e5e9ef',
    },
    checkboxWrapper: {
      borderWidth: 1,
      borderColor: colors['neutral-line'], // Default color if --r-neutral-line is not available
      backgroundColor: colors['neutral-foot'], // Default color if --r-neutral-foot is not available
    },
    checked: {
      backgroundColor: colors['blue-default'], // Default color if --r-blue-default is not available
      borderWidth: 0,
    },
    afterLine: {
      position: 'absolute',
      bottom: 0,
      left: 18,
      width: 328,
      height: 1,
      backgroundColor: '#e5e9ef',
    },
    hover: {
      backgroundColor: colors['blue-light-1'], // Default color if --r-blue-light-1 is not available
      borderWidth: 1,
      borderColor: colors['blue-default'], // Default color if --r-blue-default is not available
      borderRadius: 6,
    },
    lastChild: {
      borderBottomWidth: 0,
    },
  });

interface Props {
  address: string;
  chain: Chain;
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
      snapPoints={['45%']}>
      <BottomSheetView style={styles.mainView}>
        <AppBottomSheetModalTitle
          title={t('page.signTx.myMarkWithContract', {
            chainName: chain.name,
          })}
        />
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.item}
            onPress={() =>
              onChange({ onBlacklist: false, onWhitelist: false })
            }>
            <View>
              <Radio
                // eslint-disable-next-line react-native/no-inline-styles
                textStyle={{
                  color: colors['neutral-title-1'],
                  flex: 1,
                }}
                right
                iconRight
                title={t('page.signTx.noMark')}
                checked={!onWhitelist && !onBlacklist}
                onPress={() =>
                  onChange({ onBlacklist: false, onWhitelist: false })
                }
              />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.item}
            onPress={() => onChange({ onBlacklist: false, onWhitelist: true })}>
            <View>
              <Radio
                // eslint-disable-next-line react-native/no-inline-styles
                textStyle={{
                  color: colors['green-default'],
                  flex: 1,
                }}
                right
                iconRight
                title={t('page.signTx.trusted')}
                checked={!onWhitelist && !onBlacklist}
                onPress={() =>
                  onChange({ onBlacklist: false, onWhitelist: true })
                }
              />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.item}
            onPress={() => onChange({ onBlacklist: true, onWhitelist: false })}>
            <View>
              <Radio
                // eslint-disable-next-line react-native/no-inline-styles
                textStyle={{
                  color: colors['red-default'],
                  flex: 1,
                }}
                right
                iconRight
                title={t('page.signTx.blocked')}
                checked={!onWhitelist && !onBlacklist}
                onPress={() =>
                  onChange({ onBlacklist: true, onWhitelist: false })
                }
              />
            </View>
          </TouchableOpacity>
        </View>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

export default UserListDrawer;
