import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TITLE_STYLE,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { E2E_ID } from '@/constant/e2e';
import { useTheme2024 } from '@/hooks/theme';
import { makeTestIDProps } from '@/utils/makeTestIDProps';
import { createGetStyles2024 } from '@/utils/styles';

/**
 * Explains the "Help improve Rabby" setting. Opened from the info icon on its
 * Settings row; the sheet sizes itself to the copy.
 */
export const DataAnalysisInfoPopup: React.FC<{
  visible: boolean;
  onClose(): void;
}> = ({ visible, onClose }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const modalRef = useRef<AppBottomSheetModal>(null);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      onDismiss={onClose}
      {...makeBottomSheetProps({
        linearGradientType: 'bg0',
        colors: colors2024,
      })}
      enableDynamicSizing>
      <BottomSheetView>
        <AutoLockView>
          <Text style={styles.title}>{t('page.setting.dataAnalysis')}</Text>
          <Text style={styles.desc}>{t('page.setting.dataAnalysisDesc')}</Text>
          <View
            style={[
              styles.footer,
              { paddingBottom: getBottomButtonBottomOffset(bottom) },
            ]}>
            <Button
              type="primary"
              height={BOTTOM_BUTTON_SINGLE_HEIGHT}
              titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
              title={t('component.GlobalTipsPopup.btn')}
              onPress={onClose}
              {...makeTestIDProps(E2E_ID.settings.dataAnalysisInfoConfirm)}
            />
          </View>
        </AutoLockView>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  // The sheet handle above is 36pt tall, which puts the title 48pt from the top.
  title: {
    marginTop: 12,
    paddingHorizontal: 24,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
  },
  desc: {
    marginTop: 12,
    paddingHorizontal: 24,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
  },
  footer: {
    marginTop: 12,
    paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
    paddingHorizontal: 20,
  },
}));
