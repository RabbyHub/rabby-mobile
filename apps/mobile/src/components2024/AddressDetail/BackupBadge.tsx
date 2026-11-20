import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import WarningIcon from '@/assets2024/icons/common/warning-circle-cc.svg';
import { isNarrowScreenWidth } from '@/constant/layout';
import { AutoFitText } from '@/components/AutoFitText';

/**
 * Per-language chip floors, in points.
 *
 * The adaptive path normally sizes the chip from its own measured text. A few
 * locales pack a long word that the Android measurement underestimates; give
 * those languages the extra points they need instead of shrinking the font.
 * English is never listed here (it keeps the fixed design metrics).
 */
const CHIP_MIN_WIDTH_BY_LANGUAGE: Partial<Record<string, number>> = {
  // "резервной" needs a little more than the measured two-line width.
  'ru-RU': 132,
};

interface BackupBadgeProps {
  onPress?: () => void;
}

export const BackupBadge: React.FC<BackupBadgeProps> = ({ onPress }) => {
  const { styles, colors2024, windowWidth, language } = useTheme2024({
    getStyle,
  });
  const isEnglishChip = /^en(-|$)/i.test(language ?? '');
  const tight = isNarrowScreenWidth(windowWidth) || !isEnglishChip;

  const content = (
    <View style={styles.container}>
      <WarningIcon
        width={tight ? 16 : 18}
        height={tight ? 16 : 18}
        color={colors2024['orange-default']}
      />
      {/* English stays at the 14pt design size; a translation that does not
          fit wraps to at most two lines, and only shrinks if even that is not
          enough (iOS native auto-fit, Android measured). */}
      <AutoFitText
        i18nKey="backupReminder.badge"
        style={styles.text}
        baseFontSize={14}
        minFontSize={13}
        numberOfLines={2}
      />
    </View>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>;
  }

  return content;
};

const getStyle = createGetStyles2024(
  ({ colors2024, windowWidth, language }) => {
    // Only the 375pt tier needs the tighter chip; wider screens keep the
    // original padding so their look does not change. See
    // `IPHONE_SCREEN_TIERS` in `@/constant/layout`.
    const narrow = isNarrowScreenWidth(windowWidth);
    // The row is `windowWidth - 32` (card margins) `- 48` (card padding).
    // Cap the chip at half of it: a single-line Text cannot shrink below its
    // content width, so without a cap a long locale pushes the chip into the
    // trailing arrow instead of leaving the row's gap intact.
    const rowWidth = Math.max(0, (windowWidth ?? 0) - 80);
    const maxWidth = rowWidth > 0 ? Math.round(rowWidth * 0.6) : undefined;
    const isEnglish = /^en(-|$)/i.test(language ?? '');
    const minWidth = isEnglish
      ? 0
      : CHIP_MIN_WIDTH_BY_LANGUAGE[language ?? ''] ?? 0;
    // English keeps the exact design chrome. A translated chip also uses the
    // compact chrome (its label side wraps), which buys the few points a long
    // word needs to stay inside two lines.
    const tight = narrow || !isEnglish;

    return {
      container: {
        flexDirection: 'row',
        alignItems: 'center',
        // The badge is an atomic chip: it never breaks into a second line.
        // Shrink it (with a tail ellipsis on very long locales) rather than
        // letting it overflow the row; the label column shrinks/wraps first.
        flexShrink: 1,
        // Non-English: grow leftwards into the row (the arrow stays on the
        // right), bounded by `maxWidth`. English keeps its natural chip.
        flexGrow: isEnglish ? 0 : 1,
        minWidth: 0,
        maxWidth,
        gap: tight ? 3 : 4,
        backgroundColor: colors2024['orange-light-1'],
        paddingHorizontal: tight ? 4 : 6,
        paddingVertical: 4,
        borderRadius: 8,
        borderCurve: 'continuous',
      },
      text: {
        fontSize: 14,
        lineHeight: 18,
        fontWeight: '700',
        fontFamily: 'SF Pro Rounded',
        color: colors2024['orange-default'],
        flexShrink: 1,
      },
    };
  },
);
