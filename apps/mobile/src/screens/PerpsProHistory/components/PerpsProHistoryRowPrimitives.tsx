import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { PerpsProDottedUnderlineText } from '@/screens/PerpsPro/components/common/PerpsProDottedUnderlineText';
import {
  getPerpsProSemanticTagContainerStyle,
  getPerpsProSemanticTagTextStyle,
} from '@/screens/PerpsPro/components/common/perpsProSemanticTagStyles';
import { formatPerpsProTime } from '@/screens/PerpsPro/utils/format';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';

import type { PerpsProHistoryTone } from './historyRowFormatters';

export type PerpsProHistoryDetail = Readonly<{
  label: string;
  labelAccessibilityLabel?: string;
  onLabelPress?: () => void;
  tone?: PerpsProHistoryTone;
  value: string;
}>;

export type PerpsProHistoryBadge = Readonly<{
  label: string;
  tone: PerpsProHistoryTone;
}>;

export const PerpsProHistoryRowLayout: React.FC<{
  badges?: readonly PerpsProHistoryBadge[];
  details: readonly PerpsProHistoryDetail[];
  sourceTag?: string | null;
  testID: string;
  time: number;
  title: string;
  trailing?: React.ReactNode;
}> = ({ badges = [], details, sourceTag, testID, time, title, trailing }) => {
  const { styles } = useTheme2024({ getStyle });
  const badgeStyles = {
    info: styles.infoBadge,
    negative: styles.negativeBadge,
    neutral: styles.neutralBadge,
    positive: styles.positiveBadge,
  };
  const badgeTextStyles = {
    info: styles.infoBadgeText,
    negative: styles.negativeBadgeText,
    neutral: styles.neutralBadgeText,
    positive: styles.positiveBadgeText,
  };
  const valueStyles = {
    info: styles.infoValue,
    negative: styles.negativeValue,
    neutral: styles.neutralValue,
    positive: styles.positiveValue,
  };

  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.meta}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text numberOfLines={1} style={styles.title}>
              {title}
            </Text>
            {sourceTag ? (
              <View style={styles.sourceTag}>
                <Text style={styles.sourceText}>{sourceTag}</Text>
              </View>
            ) : null}
          </View>
          {trailing ?? (
            <View style={styles.timeRow}>
              <Text style={styles.time}>{formatPerpsProTime(time)}</Text>
            </View>
          )}
        </View>
        {badges.length ? (
          <View style={styles.badges}>
            {badges.map((badge, index) => (
              <View
                key={`${badge.label}:${index}`}
                style={badgeStyles[badge.tone]}>
                <Text style={badgeTextStyles[badge.tone]}>{badge.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <View style={styles.details} testID={`${testID}-details`}>
        {details.map((detail, index) => (
          <View key={`${detail.label}:${index}`} style={styles.detailRow}>
            {detail.onLabelPress ? (
              <PerpsProDottedUnderlineText
                accessibilityLabel={
                  detail.labelAccessibilityLabel ?? detail.label
                }
                onPress={detail.onLabelPress}
                style={styles.label}
                testID={`perps-pro-history-detail-action-${index}`}>
                {detail.label}
              </PerpsProDottedUnderlineText>
            ) : (
              <Text style={styles.label}>{detail.label}</Text>
            )}
            <Text
              numberOfLines={2}
              style={valueStyles[detail.tone ?? 'neutral']}>
              {detail.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const value = (color: string) => ({
  color,
  flexShrink: 1,
  fontFamily: 'SF Pro',
  fontSize: 12,
  fontWeight: '500' as const,
  lineHeight: 16,
  marginLeft: 16,
  textAlign: 'right' as const,
});

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  row: {
    gap: 16,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  meta: {
    gap: 8,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  titleRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    minWidth: 0,
  },
  title: {
    color: colors2024['neutral-title-1'],
    flexShrink: 1,
    fontFamily: 'SF Pro',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  sourceTag: getPerpsProSemanticTagContainerStyle(colors2024, 'neutral'),
  sourceText: getPerpsProSemanticTagTextStyle(colors2024, 'neutral'),
  timeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    marginLeft: 12,
  },
  time: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 10,
    lineHeight: 12,
  },
  badges: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  positiveBadge: getPerpsProSemanticTagContainerStyle(colors2024, 'positive'),
  negativeBadge: getPerpsProSemanticTagContainerStyle(colors2024, 'negative'),
  neutralBadge: getPerpsProSemanticTagContainerStyle(colors2024, 'neutral'),
  infoBadge: getPerpsProSemanticTagContainerStyle(colors2024, 'neutral'),
  positiveBadgeText: getPerpsProSemanticTagTextStyle(colors2024, 'positive'),
  negativeBadgeText: getPerpsProSemanticTagTextStyle(colors2024, 'negative'),
  neutralBadgeText: getPerpsProSemanticTagTextStyle(colors2024, 'neutral'),
  infoBadgeText: getPerpsProSemanticTagTextStyle(colors2024, 'neutral', {
    color: colors2024['neutral-info'],
  }),
  details: {
    borderBottomColor: colors2024['neutral-bg-5'],
    borderBottomWidth: 1,
    gap: 8,
    paddingBottom: 12,
  },
  detailRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 16,
  },
  label: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
  },
  neutralValue: value(colors2024['neutral-title-1']),
  positiveValue: value(colors2024['green-default']),
  negativeValue: value(colors2024['red-default']),
  infoValue: value(colors2024['neutral-info']),
}));
