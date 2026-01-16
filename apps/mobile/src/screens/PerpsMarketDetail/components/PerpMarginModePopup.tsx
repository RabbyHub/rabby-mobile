import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';

const getStyle = createGetStyles2024(({ colors2024, isLight }) => {
  return {
    container: {
      height: '100%',
      paddingHorizontal: 24,
      paddingTop: 12,
    },
    scrollViewContent: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 16,
      flexGrow: 1,
    },
    title: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '900',
      color: colors2024['neutral-title-1'],
      marginBottom: 24,
      textAlign: 'center',
    },
    cardList: {
      gap: 16,
    },
    modeCard: {
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors2024['neutral-bg-2'],
      borderWidth: 1,
      borderColor: colors2024['neutral-bg-2'],
    },
    modeCardActive: {
      // borderColor: colors2024['brand-default'],
      // backgroundColor: isLight
      //   ? colors2024['brand-light-1']
      //   : colors2024['neutral-bg-2'],
    },
    modeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      // justifyContent: 'flex-start',
      gap: 12,
      // marginBottom: 8,
    },
    modeTitle: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
    },
    textWrapper: {
      flex: 1,
      flexDirection: 'column',
      gap: 4,
    },
    modeDesc: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '400',
      color: colors2024['neutral-foot'],
    },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors2024['neutral-line'],
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOuterActive: {
      borderColor: colors2024['brand-disable'],
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors2024['brand-default'],
    },
    footer: {
      backgroundColor: colors2024['neutral-bg-1'],
      paddingTop: 32,
      // paddingHorizontal: 16,
      paddingBottom: 40,
    },
  };
});

export const PerpMarginModePopup: React.FC<{
  visible: boolean;
  selectedMarginMode: 'cross' | 'isolated';
  onConfirm: (mode: 'cross' | 'isolated') => void;
  onClose: () => void;
}> = ({ visible, selectedMarginMode, onConfirm, onClose }) => {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const [selectedMode, setSelectedMode] = React.useState<'cross' | 'isolated'>(
    selectedMarginMode,
  );
  const { styles, colors2024, isLight } = useTheme2024({
    getStyle,
  });
  const { t } = useTranslation();

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  React.useEffect(() => {
    if (visible) {
      setSelectedMode(selectedMarginMode);
    }
  }, [visible, selectedMarginMode]);

  const handleConfirm = useMemoizedFn(() => {
    onConfirm(selectedMode);
  });

  const isCross = selectedMode === 'cross';

  return (
    <AppBottomSheetModal
      ref={modalRef}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg1',
      })}
      onDismiss={onClose}
      snapPoints={[510]}>
      <AutoLockView style={styles.container}>
        <View>
          <Text style={styles.title}>
            {t('page.perpsDetail.PerpsPosition.marginMode')}
          </Text>
        </View>
        <View style={styles.cardList}>
          <TouchableOpacity
            onPress={() => {
              setSelectedMode('cross');
            }}
            style={[styles.modeCard, isCross ? styles.modeCardActive : null]}>
            <View style={styles.modeHeader}>
              <View
                style={[
                  styles.radioOuter,
                  isCross ? styles.radioOuterActive : null,
                ]}>
                {isCross ? <View style={styles.radioInner} /> : null}
              </View>
              <View style={styles.textWrapper}>
                <Text style={styles.modeTitle}>
                  {t('page.perpsDetail.PerpMarginModePopup.crossTitle')}
                </Text>
                <Text style={styles.modeDesc}>
                  {t('page.perpsDetail.PerpMarginModePopup.crossDesc')}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setSelectedMode('isolated');
            }}
            style={[styles.modeCard, !isCross ? styles.modeCardActive : null]}>
            <View style={styles.modeHeader}>
              <View
                style={[
                  styles.radioOuter,
                  !isCross ? styles.radioOuterActive : null,
                ]}>
                {!isCross ? <View style={styles.radioInner} /> : null}
              </View>
              <View style={styles.textWrapper}>
                <Text style={styles.modeTitle}>
                  {t('page.perpsDetail.PerpMarginModePopup.isolatedTitle')}
                </Text>
                <Text style={styles.modeDesc}>
                  {t('page.perpsDetail.PerpMarginModePopup.isolatedDesc')}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.footer}>
          <Button
            type="primary"
            title={t('global.confirm')}
            onPress={handleConfirm}
          />
        </View>
      </AutoLockView>
    </AppBottomSheetModal>
  );
};
