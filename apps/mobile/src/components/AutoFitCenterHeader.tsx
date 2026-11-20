import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AutoFitHeaderTitle,
  HeaderTitleLanguageStyle,
} from '@/components/AutoFitHeaderTitle';
import { resolveHeaderTitleLanguageStyle } from '@/components/headerTitleTypography';
import { HeaderBackButton } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { IS_IOS } from '@/core/native/utils';
import { ScreenLayouts } from '@/constant/layout';
import { createGetStyles2024 } from '@/utils/styles';

// Match the container's header offset (`ScreenLayouts.headerAreaHeight`), so a
// custom header row lands exactly where the native header + safeOffHeader pair
// did and the content does not gain extra top padding.
const HEADER_CONTENT_HEIGHT = ScreenLayouts.headerAreaHeight;
// The trailing slot is empty and the back control renders a 24pt chevron at the
// content edge, so 32pt is enough on iOS. The old 44pt (native bar item width)
// was what forced the longest English titles to drop below the 20pt baseline
// (QA 1409/1425). Keeping both slots symmetric preserves the centred title;
// the back control keeps its 44pt tap target through its hitSlop.
const HEADER_SIDE_SLOT_WIDTH = IS_IOS ? 32 : 24;
// The cards below start at this inset, so the back control aligns with them.
const HEADER_HORIZONTAL_INSET = 16;
// Breathing room between the side slots and the title glyphs.
const TITLE_AREA_HORIZONTAL_MARGIN = 8;

/**
 * Centred JS header for the first screens of the add-wallet flow (QA 1352).
 *
 * The title occupies a centred slot with equal leading/trailing slots, matching
 * the rest of the 4.22 header work. AutoFitHeaderTitle owns the long-translation
 * behaviour: it measures the real glyphs and shrinks to the compact two-line
 * layout only when the base-size title cannot fit.
 */
export const AutoFitCenterHeader = ({
  title,
  titleKey,
  titleNode,
  textStylesByLanguage,
}: {
  title: string;
  /**
   * Optional rich title content (e.g. the history header's title + account
   * row). When present it replaces the auto-fit `Text`, so callers keep the
   * shared centred row instead of re-implementing the slots.
   */
  titleNode?: React.ReactNode;
  /** i18n key of `title`; drives the English narrow-width typography ladder. */
  titleKey?: string;
  /** Exact language tag -> typography override; decided by the screen. */
  textStylesByLanguage?: Partial<Record<string, HeaderTitleLanguageStyle>>;
}) => {
  const { styles, colors2024, windowWidth, language } = useTheme2024({
    getStyle,
  });
  const insets = useSafeAreaInsets();
  // Live title slot: the same paddings/margins the row below applies. Kept in
  // sync with `getStyle` so the width ladder sees the real glyph width.
  const availableWidth =
    windowWidth -
    2 * HEADER_HORIZONTAL_INSET -
    2 * HEADER_SIDE_SLOT_WIDTH -
    2 * TITLE_AREA_HORIZONTAL_MARGIN;
  const languageStyle = resolveHeaderTitleLanguageStyle({
    titleKey,
    language,
    availableWidth,
  });

  return (
    <View style={[styles.outer, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <View style={styles.backSlot}>
          <HeaderBackButton
            style={styles.backButtonTouch}
            tintColor={colors2024['neutral-title-1']}
          />
        </View>
        <View style={styles.titleArea}>
          {titleNode ?? (
            <AutoFitHeaderTitle
              text={title}
              textStyle={styles.title}
              textStylesByLanguage={textStylesByLanguage}
              languageStyle={languageStyle}
            />
          )}
        </View>
        {/* Equal trailing slot keeps the title centred on the screen. */}
        <View style={styles.rightSlot} />
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  outer: {
    // The screens using this header are drawn on neutral-bg-0 and the native
    // header is transparent; an opaque bg-1 strip here showed up as an extra
    // white header band (QA 1352 follow-up).
    backgroundColor: 'transparent',
  },
  row: {
    height: HEADER_CONTENT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: HEADER_HORIZONTAL_INSET,
  },
  // 44pt tap target whose visible 24pt chevron sits at the content edge.
  backSlot: {
    width: HEADER_SIDE_SLOT_WIDTH,
    height: HEADER_CONTENT_HEIGHT,
    alignItems: 'flex-start',
    justifyContent: 'center',
    flexShrink: 0,
  },
  backButtonTouch: {
    width: '100%',
    height: '100%',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  titleArea: {
    flex: 1,
    // Let AutoFitHeaderTitle measure the same width the visible title uses.
    // The inner Text still centres its glyphs via textAlign.
    alignItems: 'stretch',
    justifyContent: 'center',
    marginHorizontal: TITLE_AREA_HORIZONTAL_MARGIN,
  },
  rightSlot: {
    width: HEADER_SIDE_SLOT_WIDTH,
    height: HEADER_CONTENT_HEIGHT,
    flexShrink: 0,
  },
  title: {
    color: colors2024['neutral-title-1'],
  },
}));
