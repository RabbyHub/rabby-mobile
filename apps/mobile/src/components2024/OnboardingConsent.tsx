import React from 'react';
import { Pressable, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Trans, useTranslation } from 'react-i18next';

import { AppSwitch2024 } from '@/components/customized/Switch2024';
import { Text } from '@/components/Typography';
import { E2E_ID } from '@/constant/e2e';
import { useTheme2024 } from '@/hooks/theme';
import { useShowUserAgreementLikeModal } from '@/screens/ManagePassword/components/UserAgreementLikeModalInner2024';
import { makeTestIDProps } from '@/utils/makeTestIDProps';
import { createGetStyles2024 } from '@/utils/styles';

// The design's compact switch: a 28.8 x 16 track with a 12.8 knob, i.e. the
// default 43.2 x 24 switch at two-thirds scale.
const COMPACT_SWITCH_PROPS = {
  circleSize: 16,
  barHeight: 16,
  circleBorderWidth: 1.6,
  switchWidthMultiplier: 1.8,
  switchLeftPx: 2.5,
  switchRightPx: 2.5,
} as const;
// The compact switch is too small to hit reliably, so its whole title row
// toggles it. The slop stays inside the card's 12pt padding.
const TITLE_ROW_HIT_SLOP = { top: 12, left: 12, right: 12, bottom: 4 };

/**
 * "Help improve Rabby" card for the screens where a user sets their first
 * password. The caller owns the value and persists it on submit.
 */
export function DataAnalysisCard({
  value,
  onValueChange,
  style,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={[styles.card, style]}>
      {/* Not one accessibility element: the switch keeps its own role and test ID */}
      <Pressable
        accessible={false}
        style={styles.titleRow}
        hitSlop={TITLE_ROW_HIT_SLOP}
        onPress={() => onValueChange(!value)}>
        <Text style={styles.title}>{t('page.setting.dataAnalysis')}</Text>
        <AppSwitch2024
          {...COMPACT_SWITCH_PROPS}
          value={value}
          {...makeTestIDProps(
            E2E_ID.onboarding.setPasswordDataAnalysis,
            value
              ? E2E_ID.onboarding.setPasswordDataAnalysisOn
              : E2E_ID.onboarding.setPasswordDataAnalysisOff,
          )}
          onValueChange={onValueChange}
        />
      </Pressable>
      <Text style={styles.description}>
        {t('page.createPassword.dataAnalysisDesc')}
      </Text>
    </View>
  );
}

/**
 * "By continuing, you agree to..." notice that sits above the submit button.
 * Its links open the Terms of Use and Privacy Policy sheets.
 */
export function AgreementNotice({ style }: { style?: StyleProp<TextStyle> }) {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });
  const { viewTermsOfUse, viewPrivacyPolicy } = useShowUserAgreementLikeModal();

  return (
    <Text style={[styles.notice, style]}>
      <Trans
        i18nKey="page.createPassword.agreeByContinuing"
        t={t}
        components={{
          terms: (
            <Text
              key="terms"
              style={styles.noticeLink}
              suppressHighlighting
              onPress={viewTermsOfUse}
            />
          ),
          privacy: (
            <Text
              key="privacy"
              style={styles.noticeLink}
              suppressHighlighting
              onPress={viewPrivacyPolicy}
            />
          ),
        }}
      />
    </Text>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  card: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors2024['neutral-bg-5'],
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  description: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
  },
  notice: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
  },
  noticeLink: {
    color: colors2024['brand-default'],
  },
}));
