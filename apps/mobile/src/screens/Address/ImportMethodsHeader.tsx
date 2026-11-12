import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AutoFitHeaderTitle } from '@/components/AutoFitHeaderTitle';
import { HeaderBackButton } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

// Native nav-bar content height, matching the other custom headers in this
// navigator.
const HEADER_CONTENT_HEIGHT = 48;
// Same inset as the page content below, so the back control starts exactly
// where the cards do (header layout contract).
const HEADER_HORIZONTAL_INSET = 16;

/**
 * Custom header for the "select import method" screen.
 *
 * The native header let a long translation (QA 1352, pt-BR) run past the right
 * edge and pushed the title towards the trailing side. This row reserves a
 * fixed leading slot for the back control, then gives the rest of the width to
 * a single-line title that truncates with an ellipsis, so every language starts
 * at the same x and never overflows.
 */
export const ImportMethodsHeader = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <View style={[styles.outer, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <View style={styles.backSlot}>
          <HeaderBackButton
            style={styles.backButtonTouch}
            tintColor={colors2024['neutral-title-1']}
          />
        </View>
        <View style={styles.center}>
          <AutoFitHeaderTitle
            text={t('screens.addressStackTitle.ImportMethods')}
            textStyle={styles.title}
          />
        </View>
        {/* Reserved trailing slot: keeps the title centred on the screen, the
            same way a real trailing action would. */}
        <View style={styles.rightSlot} />
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  outer: {
    backgroundColor: colors2024['neutral-bg-1'],
  },
  row: {
    height: HEADER_CONTENT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: HEADER_HORIZONTAL_INSET,
  },
  // 44pt wide, full row height: the chevron sits at the page content's left
  // edge and the whole slot is tappable.
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
  center: {
    flex: 1,
    alignItems: 'center',
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
