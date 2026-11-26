import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import WarningIcon from '@/assets2024/icons/common/warning-circle-cc.svg';
import { isNarrowScreenWidth } from '@/constant/layout';
import { AutoFitText, AutoFitTextMeasure } from '@/components/AutoFitText';

const CHIP_CHROME_WIDTH = { tight: 27, regular: 28 };

/**
 * Locales that still do not fit on the narrowest tier (375pt): their label
 * needs the row's width for two lines too, so the chip drops one point of font
 * size to give the label back the few points it is short by.
 */
const NARROW_COMPRESS_LANGUAGES = new Set(['fr', 'ru']);
const NARROW_CHIP_FONT_SIZE = 12;

/** Extra points so a wrapped line never tips onto a third line from rounding. */
const CHIP_WIDTH_SLACK = 2;

function getChipMetrics(
  windowWidth: number | undefined,
  isEnglish: boolean,
  language: string | undefined,
) {
  const narrow = isNarrowScreenWidth(windowWidth);
  const languagePrefixForCompress = (language ?? '')
    .split('-')[0]
    .toLowerCase();
  const compress =
    narrow && NARROW_COMPRESS_LANGUAGES.has(languagePrefixForCompress);
  // The row is `windowWidth - 32` (card margins) `- 48` (card padding).
  const rowWidth = Math.max(0, (windowWidth ?? 0) - 80);
  // Hard cap so a long locale never pushes the trailing arrow.
  const maxWidth = rowWidth > 0 ? Math.round(rowWidth * 0.6) : undefined;
  // A chip may sit on one line only while it stays a minor part of the row;
  // past this it wraps to two lines so the label keeps its own width.
  const oneLineCap = rowWidth > 0 ? Math.round(rowWidth * 0.4) : undefined;
  // `useTheme2024` hands the factory the resolved tag (`ru-RU`), so match on
  // the primary subtag instead of duplicating every regional variant.
  const languagePrefix = (language ?? '').split('-')[0].toLowerCase();
  const tight = narrow || !isEnglish;

  return {
    tight,
    compress,
    maxWidth,
    oneLineCap,
    chrome: compress
      ? 22
      : tight
      ? CHIP_CHROME_WIDTH.tight
      : CHIP_CHROME_WIDTH.regular,
  };
}

interface BackupBadgeProps {
  onPress?: () => void;
}

export const BackupBadge: React.FC<BackupBadgeProps> = ({ onPress }) => {
  const { styles, colors2024, windowWidth, language } = useTheme2024({
    getStyle,
  });
  const isEnglishChip = /^en(-|$)/i.test(language ?? '');
  const chip = getChipMetrics(windowWidth, isEnglishChip, language);
  const { tight } = chip;

  // The chip is sized by its copy: the width comes from the measured copy and
  // the chip is `flexShrink: 0`, so it hugs its text exactly and wraps at the
  // narrowest two-line width instead of ellipsizing. Relying on the platform's
  // natural width is not enough: iOS restricts a Text to the row's remaining
  // space while Android measures its unclamped width.
  const [textMeasure, setTextMeasure] = React.useState<AutoFitTextMeasure>();

  const chipWidth = React.useMemo(() => {
    // English is the fixed design baseline: it keeps the original chip sizing.
    if (isEnglishChip) {
      return undefined;
    }

    const cap = chip.maxWidth ?? Number.POSITIVE_INFINITY;
    if (!textMeasure || !(textMeasure.singleLineWidth > 0)) {
      return undefined;
    }

    const oneLine =
      Math.ceil(textMeasure.singleLineWidth) + chip.chrome + CHIP_WIDTH_SLACK;
    const twoLine =
      Math.ceil(
        Math.min(textMeasure.singleLineWidth, textMeasure.twoLineWidth),
      ) +
      chip.chrome +
      CHIP_WIDTH_SLACK;
    // Keep the natural one-line chip while it still leaves the row most of its
    // width; otherwise cap at the narrowest width that holds two lines.
    const preferred =
      chip.oneLineCap === undefined || oneLine <= chip.oneLineCap
        ? oneLine
        : twoLine;
    const needed = preferred;

    return Math.min(cap, needed);
  }, [chip, isEnglishChip, textMeasure]);

  const content = (
    <View
      style={[
        styles.container,
        !isEnglishChip ? styles.measured : null,
        chipWidth ? { width: chipWidth } : null,
      ]}>
      <WarningIcon
        width={tight ? 16 : 18}
        height={tight ? 16 : 18}
        color={colors2024['orange-default']}
      />
      <AutoFitText
        i18nKey="backupReminder.badge"
        style={styles.text}
        numberOfLines={2}
        onMeasureTextWidth={setTextMeasure}
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
    const isEnglish = /^en(-|$)/i.test(language ?? '');
    // Only the 375pt tier needs the tighter chip; wider screens keep the
    // original padding so their look does not change. See
    // `IPHONE_SCREEN_TIERS` in `@/constant/layout`. English keeps the exact
    // design chrome; a translated chip uses the compact chrome, which buys the
    // few points a long word needs to stay inside two lines.
    const { tight, compress, maxWidth } = getChipMetrics(
      windowWidth,
      isEnglish,
      language,
    );

    return {
      container: {
        flexDirection: 'row',
        alignItems: 'center',
        // English keeps the original chip behaviour; a translated chip is
        // sized by its copy and must not be stretched or squeezed by the row.
        flexShrink: 1,
        flexGrow: 0,
        maxWidth,
        gap: compress ? 2 : tight ? 3 : 4,
        backgroundColor: colors2024['orange-light-1'],
        paddingHorizontal: compress ? 2 : tight ? 4 : 6,
        paddingVertical: 4,
        borderRadius: 8,
        borderCurve: 'continuous',
      },
      measured: {
        flexShrink: 0,
        flexGrow: 0,
      },
      text: {
        // Narrow fr/ru only: one point down keeps the whole chip visible while
        // handing the label the width it needs for its own two lines.
        fontSize: compress ? NARROW_CHIP_FONT_SIZE : 14,
        lineHeight: 18,
        fontWeight: '700',
        fontFamily: 'SF Pro Rounded',
        color: colors2024['orange-default'],
        flexShrink: 1,
      },
    };
  },
);
