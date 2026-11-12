import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AutoFitHeaderTitle } from '@/components/AutoFitHeaderTitle';
import { HeaderBackButton } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

// Matches the row height used by the other JS-owned headers in this stack.
const HEADER_CONTENT_HEIGHT = 48;
// The cards below start at this inset, so the back control aligns with them.
const HEADER_HORIZONTAL_INSET = 16;

/**
 * Centred JS header for the first screens of the add-wallet flow (QA 1352).
 *
 * The title occupies a centred slot with equal leading/trailing slots, matching
 * the rest of the 4.22 header work. AutoFitHeaderTitle owns the long-translation
 * behaviour: it measures the real glyphs and shrinks to the compact two-line
 * layout only when the base-size title cannot fit.
 */
export const AutoFitCenterHeader = ({ title }: { title: string }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const insets = useSafeAreaInsets();

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
          <AutoFitHeaderTitle text={title} textStyle={styles.title} />
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
    width: 44,
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
    marginHorizontal: 8,
  },
  rightSlot: {
    width: 44,
    height: HEADER_CONTENT_HEIGHT,
    flexShrink: 0,
  },
  title: {
    color: colors2024['neutral-title-1'],
  },
}));
