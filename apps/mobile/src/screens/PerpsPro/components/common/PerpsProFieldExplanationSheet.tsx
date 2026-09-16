import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { MODAL_GATE_IDS, useRegisterBlockingModal } from '@/utils/modalGate';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import React, { useEffect, useRef } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  PERPS_PRO_FIELD_EXPLANATIONS,
  type PerpsProFieldExplanationKey,
} from '../../model/fieldExplanation';
import { usePerpsProSheetNavigationRegistration } from './perpsProSheetNavigationRegistry';
import { getPerpsProDialogStyles } from './perpsProDialogVisual';
import { PerpsProDialogBackdrop } from './PerpsProDialogBackdrop';

const PERPS_PRO_FIELD_EXPLANATION_ACTION_GAP = 24;

export const PerpsProFieldExplanationSheet: React.FC<{
  explanationKey: PerpsProFieldExplanationKey;
  onDismiss: () => void;
}> = React.memo(({ explanationKey, onDismiss }) => {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { colors2024, styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const { top } = useSafeAreaInsets();
  const explanation = PERPS_PRO_FIELD_EXPLANATIONS[explanationKey];
  const maxDynamicContentSize = Math.max(0, height - top);
  usePerpsProSheetNavigationRegistration({
    active: true,
    dismiss: onDismiss,
  });

  useRegisterBlockingModal(MODAL_GATE_IDS.perpsProFieldExplanation, true);

  useEffect(() => {
    modalRef.current?.present();
  }, []);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg0',
      })}
      backdropComponent={PerpsProDialogBackdrop}
      backdropProps={{ pressBehavior: 'close' }}
      backgroundStyle={styles.background}
      enableDynamicSizing
      handleIndicatorStyle={styles.handleIndicator}
      handleStyle={styles.handle}
      maxDynamicContentSize={maxDynamicContentSize}
      onDismiss={onDismiss}
      style={styles.modal}>
      <BottomSheetScrollView showsVerticalScrollIndicator={false}>
        <AutoLockView style={styles.container}>
          <Text style={styles.title}>{t(explanation.titleKey)}</Text>
          <Text style={styles.description}>
            {t(explanation.descriptionKey)}
          </Text>
          <View style={styles.footer}>
            <Button
              buttonStyle={styles.button}
              height={BOTTOM_BUTTON_SINGLE_HEIGHT}
              onPress={() => modalRef.current?.close()}
              title={t('page.perps.pro.funding.gotIt')}
              titleStyle={styles.buttonTitle}
              type="primary"
            />
          </View>
        </AutoLockView>
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
});

PerpsProFieldExplanationSheet.displayName = 'PerpsProFieldExplanationSheet';

const getStyle = createGetStyles2024(
  ({ colors2024, safeAreaInsets, isLight }) => ({
    ...getPerpsProDialogStyles(colors2024, safeAreaInsets.bottom, isLight),
    container: {
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    description: {
      color: colors2024['neutral-foot'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontWeight: '400',
      lineHeight: 20,
      marginTop: 12,
    },
    footer: {
      marginHorizontal: 4,
      paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
      paddingTop: PERPS_PRO_FIELD_EXPLANATION_ACTION_GAP,
    },
  }),
);
