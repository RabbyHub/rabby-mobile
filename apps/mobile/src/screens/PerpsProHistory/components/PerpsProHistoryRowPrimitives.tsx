import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { PerpsProDottedUnderlineText } from '@/screens/PerpsPro/components/common/PerpsProDottedUnderlineText';
import {
  getPerpsProMetadataTagContainerStyle,
  getPerpsProMetadataTagTextStyle,
  getPerpsProSolidSideTagContainerStyle,
  getPerpsProSolidSideTagTextStyle,
} from '@/screens/PerpsPro/components/common/perpsProSemanticTagStyles';
import { PERPS_PRO_FONT_FAMILY } from '@/screens/PerpsPro/components/common/perpsProVisual';
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
}>;

export const PerpsProHistoryRowLayout: React.FC<{
  badges?: readonly PerpsProHistoryBadge[];
  details: readonly PerpsProHistoryDetail[];
  side?: 'buy' | 'sell';
  sideAccessibilityLabel?: string;
  sourceTag?: string | null;
  testID: string;
  time: number;
  title: string;
  trailing?: React.ReactNode;
}> = ({
  badges = [],
  details,
  side,
  sideAccessibilityLabel,
  sourceTag,
  testID,
  time,
  title,
  trailing,
}) => {
  const { styles } = useTheme2024({ getStyle });
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
            {side ? (
              <View
                style={side === 'buy' ? styles.buySideTag : styles.sellSideTag}
                testID={`${testID}-side-tag`}>
                <Text
                  accessibilityLabel={sideAccessibilityLabel}
                  style={styles.sideText}>
                  {side === 'buy' ? 'B' : 'S'}
                </Text>
              </View>
            ) : null}
            <Text numberOfLines={1} style={styles.title}>
              {title}
            </Text>
            {sourceTag ? (
              <View style={styles.sourceTag} testID={`${testID}-source-tag`}>
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
              <View key={`${badge.label}:${index}`} style={styles.badge}>
                <Text style={styles.badgeText}>{badge.label}</Text>
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

const value = (color: string, fontWeight: '400' | '500' = '400') => ({
  color,
  flexShrink: 1,
  fontFamily: PERPS_PRO_FONT_FAMILY,
  fontSize: 12,
  fontWeight,
  lineHeight: 16,
  marginLeft: 16,
  textAlign: 'right' as const,
});

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  row: {
    backgroundColor: colors2024['neutral-card-1'],
    borderRadius: 12,
    gap: 8,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 16,
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
    fontFamily: PERPS_PRO_FONT_FAMILY,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  buySideTag: {
    ...getPerpsProSolidSideTagContainerStyle(colors2024, 'positive'),
  },
  sellSideTag: {
    ...getPerpsProSolidSideTagContainerStyle(colors2024, 'negative'),
  },
  sideText: getPerpsProSolidSideTagTextStyle(colors2024),
  sourceTag: getPerpsProMetadataTagContainerStyle(colors2024),
  sourceText: getPerpsProMetadataTagTextStyle(colors2024),
  timeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    marginLeft: 12,
  },
  time: {
    color: colors2024['neutral-secondary'],
    fontFamily: PERPS_PRO_FONT_FAMILY,
    fontSize: 12,
    lineHeight: 16,
  },
  badges: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  badge: {
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  badgeText: {
    color: colors2024['neutral-foot'],
    fontFamily: PERPS_PRO_FONT_FAMILY,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  details: {
    gap: 8,
  },
  detailRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 16,
  },
  label: {
    color: colors2024['neutral-secondary'],
    fontFamily: PERPS_PRO_FONT_FAMILY,
    fontSize: 12,
    lineHeight: 16,
  },
  neutralValue: value(colors2024['neutral-title-1']),
  positiveValue: value(colors2024['green-default'], '500'),
  negativeValue: value(colors2024['red-default'], '500'),
  infoValue: value(colors2024['neutral-info'], '500'),
}));
