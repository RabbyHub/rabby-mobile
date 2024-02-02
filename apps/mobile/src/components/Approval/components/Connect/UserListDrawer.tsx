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
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    mainView: {
      paddingHorizontal: 20,
      backgroundColor: colors['neutral-bg-1'],
      height: '100%',
    },
    title: {
      color: colors['neutral-title-1'],
      fontWeight: '700',
      fontSize: 15,
      marginBottom: 20,
      marginTop: 20,
      lineHeight: 18,
    },
    origin: {
      display: 'flex',
      marginBottom: 80,

      flexDirection: 'row',
      alignItems: 'center',
    },
    logo: {
      width: 24,
      height: 24,
      marginRight: 8,
      borderRadius: 4,
    },
    text: {
      flex: 1,
      overflow: 'hidden',
      fontWeight: '500',
      fontSize: 22,
      lineHeight: 26,
      color: colors['neutral-title-1'],
    },
    footer: {
      backgroundColor: colors['neutral-card-2'],
      borderRadius: 6,
    },
    footerItem: {
      flexDirection: 'row',
      position: 'relative',
    },
    radioText: {
      flex: 1,
      fontWeight: '500',
      fontSize: 13,
      lineHeight: 15,
      fontFamily: 'Roboto',
    },
    radioContainer: {
      flex: 1,
      // backgroundColor: 'transparent',
      // borderBottomColor: colors['neutral-line'],
      // borderBottomWidth: 0.5,
    },
    line: {
      height: 0.5,
      backgroundColor: colors['neutral-line'],
      width: 328,
      position: 'absolute',
      left: 18,
      bottom: 0,
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
        <Text style={styles.title}>
          {t('page.connect.manageWhiteBlackList')}
        </Text>
        <View>
          <View style={styles.origin}>
            <DappIcon
              origin={origin}
              source={{ uri: logo }}
              style={styles.logo}
            />
            <Text style={styles.text} numberOfLines={1}>
              {origin}
            </Text>
          </View>
        </View>
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.footerItem}
            onPress={() =>
              onChange({ onBlacklist: false, onWhitelist: false })
            }>
            <Radio
              textStyle={StyleSheet.flatten([
                styles.radioText,
                {
                  color: colors['neutral-title-1'],
                },
              ])}
              containerStyle={styles.radioContainer}
              right
              iconRight
              title={t('page.connect.noMark')}
              checked={!onWhitelist && !onBlacklist}
              onPress={() =>
                onChange({ onBlacklist: false, onWhitelist: false })
              }
            />
            <View style={styles.line} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.footerItem}
            onPress={() => onChange({ onBlacklist: false, onWhitelist: true })}>
            <Radio
              textStyle={StyleSheet.flatten([
                styles.radioText,
                {
                  color: colors['green-default'],
                },
              ])}
              right
              iconRight
              containerStyle={styles.radioContainer}
              title={t('page.connect.trusted')}
              checked={onWhitelist}
              onPress={() =>
                onChange({ onBlacklist: false, onWhitelist: true })
              }
            />
            <View style={styles.line} />
          </TouchableOpacity>
          <TouchableOpacity
            style={StyleSheet.flatten([
              styles.footerItem,
              {
                borderBottomWidth: 0,
              },
            ])}
            onPress={() => onChange({ onBlacklist: true, onWhitelist: false })}>
            <Radio
              textStyle={StyleSheet.flatten([
                styles.radioText,
                {
                  color: colors['red-default'],
                },
              ])}
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
