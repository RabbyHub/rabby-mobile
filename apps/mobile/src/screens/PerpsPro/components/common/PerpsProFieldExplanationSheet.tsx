import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import {
  BOTTOM_BUTTON_COMPACT_HEIGHT,
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
import {
  getPerpsProBottomSheetChromeStyles,
  PERPS_PRO_COMPACT_BUTTON_TITLE_STYLE,
  PERPS_PRO_CONFIRM_BUTTON_STYLE,
} from './perpsProVisual';

export const PERPS_PRO_FIELD_EXPLANATION_MIN_HEIGHT = 240;
const PERPS_PRO_FIELD_EXPLANATION_HANDLE_HEIGHT = 40;
const PERPS_PRO_FIELD_EXPLANATION_ACTION_GAP = 44;

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
  const maxDynamicContentSize = Math.max(
    PERPS_PRO_FIELD_EXPLANATION_MIN_HEIGHT,
    height - top,
  );
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
        linearGradientType: 'bg1',
      })}
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
              buttonStyle={PERPS_PRO_CONFIRM_BUTTON_STYLE}
              height={BOTTOM_BUTTON_COMPACT_HEIGHT}
              onPress={() => modalRef.current?.close()}
              title={t('global.confirm')}
              titleStyle={PERPS_PRO_COMPACT_BUTTON_TITLE_STYLE}
              type="primary"
            />
          </View>
        </AutoLockView>
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
});

PerpsProFieldExplanationSheet.displayName = 'PerpsProFieldExplanationSheet';

const getStyle = createGetStyles2024(({ colors2024, safeAreaInsets }) => ({
  ...getPerpsProBottomSheetChromeStyles(colors2024),
  container: {
    minHeight:
      PERPS_PRO_FIELD_EXPLANATION_MIN_HEIGHT -
      PERPS_PRO_FIELD_EXPLANATION_HANDLE_HEIGHT,
    paddingHorizontal: 15,
    paddingTop: 8,
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  description: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    marginTop: 16,
  },
  footer: {
    paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
    paddingTop: PERPS_PRO_FIELD_EXPLANATION_ACTION_GAP,
  },
}));
