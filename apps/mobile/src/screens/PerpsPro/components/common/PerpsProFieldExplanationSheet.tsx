import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import {
  BOTTOM_BUTTON_COMPACT_HEIGHT,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { MODAL_GATE_IDS, useRegisterBlockingModal } from '@/utils/modalGate';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  PERPS_PRO_FIELD_EXPLANATIONS,
  type PerpsProFieldExplanationKey,
} from '../../model/fieldExplanation';
import { usePerpsProSheetNavigationRegistration } from './perpsProSheetNavigationRegistry';
import {
  getPerpsProBottomSheetChromeStyles,
  PERPS_PRO_COMPACT_BUTTON_TITLE_STYLE,
} from './perpsProVisual';

export const PerpsProFieldExplanationSheet: React.FC<{
  explanationKey: PerpsProFieldExplanationKey;
  onDismiss: () => void;
}> = React.memo(({ explanationKey, onDismiss }) => {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { colors2024, styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const explanation = PERPS_PRO_FIELD_EXPLANATIONS[explanationKey];
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
      enableDynamicSizing={false}
      handleIndicatorStyle={styles.handleIndicator}
      handleStyle={styles.handle}
      onDismiss={onDismiss}
      snapPoints={[290]}
      style={styles.modal}>
      <BottomSheetView style={styles.sheetView}>
        <AutoLockView style={styles.container}>
          <Text style={styles.title}>{t(explanation.titleKey)}</Text>
          <Text style={styles.description}>
            {t(explanation.descriptionKey)}
          </Text>
          <View style={styles.footer}>
            <Button
              height={BOTTOM_BUTTON_COMPACT_HEIGHT}
              onPress={() => modalRef.current?.close()}
              title={t('global.confirm')}
              titleStyle={PERPS_PRO_COMPACT_BUTTON_TITLE_STYLE}
              type="primary"
            />
          </View>
        </AutoLockView>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
});

PerpsProFieldExplanationSheet.displayName = 'PerpsProFieldExplanationSheet';

const getStyle = createGetStyles2024(({ colors2024, safeAreaInsets }) => ({
  ...getPerpsProBottomSheetChromeStyles(colors2024),
  sheetView: { height: '100%' },
  container: {
    height: '100%',
    paddingHorizontal: 15,
    paddingTop: 8,
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  description: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 12,
  },
  footer: {
    marginTop: 'auto',
    paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
    paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
  },
}));
