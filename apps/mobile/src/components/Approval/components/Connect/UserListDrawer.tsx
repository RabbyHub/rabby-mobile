import {
  AppBottomSheetModal,
  AppBottomSheetModalTitle,
} from '@/components/customized/BottomSheet';
import { Radio } from '@/components/Radio';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { DappIcon } from '@/screens/Dapps/components/DappIcon';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    mainView: {
      paddingHorizontal: 20,
      backgroundColor: colors['neutral-bg-1'],
      height: '100%',
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
    footer: {
      backgroundColor: colors['neutral-card-2'],
      borderRadius: 6,
    },
    footerItem: {
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      fontWeight: 500,
      fontSize: 13,
      lineHeight: 15,
      color: colors['neutral-title-1'],
      position: 'relative',
      flexDirection: 'row',
    },
  });

interface Props {
  origin: string;
  logo: string;
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
  origin,
  logo,
  onWhitelist,
  onBlacklist,
  onChange,
  visible,
  onClose,
}: Props) => {
  const { t } = useTranslation();
  const modalRef = React.useRef<AppBottomSheetModal>(null);
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

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
          title={t('page.connect.manageWhiteBlackList')}
        />
        <View>
          <View style={styles.origin}>
            <DappIcon
              origin={origin}
              source={{ uri: logo }}
              style={{ width: 40, height: 40 }}
            />
            <Text style={styles.text}>{origin}</Text>
          </View>
        </View>
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.footerItem}
            onPress={() =>
              onChange({ onBlacklist: false, onWhitelist: false })
            }>
            <Radio
              // eslint-disable-next-line react-native/no-inline-styles
              textStyle={{
                color: colors['neutral-title-1'],
                flex: 1,
              }}
              right
              iconRight
              title={t('page.connect.noMark')}
              checked={!onWhitelist && !onBlacklist}
              onPress={() =>
                onChange({ onBlacklist: false, onWhitelist: false })
              }
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.footerItem}
            onPress={() => onChange({ onBlacklist: false, onWhitelist: true })}>
            <Radio
              // eslint-disable-next-line react-native/no-inline-styles
              textStyle={{
                color: colors['green-default'],
                flex: 1,
              }}
              right
              iconRight
              title={t('page.connect.trusted')}
              checked={onWhitelist}
              onPress={() =>
                onChange({ onBlacklist: false, onWhitelist: true })
              }
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.footerItem}
            onPress={() => onChange({ onBlacklist: true, onWhitelist: false })}>
            <Radio
              // eslint-disable-next-line react-native/no-inline-styles
              textStyle={{
                color: colors['red-default'],
                flex: 1,
              }}
              right
              iconRight
              title={t('page.connect.blocked')}
              checked={onBlacklist}
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
