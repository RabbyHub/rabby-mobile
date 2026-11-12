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
 * Left-aligned JS header for the first screens of the add-wallet flow (QA 1352).
 *
 * On iOS the native header centres a long translation, so titles such as
 * "Selecionar método para adicionar" and "Restaure a sua carteira Rabby" ran
 * past the trailing edge and looked pushed to the right. Production keeps these
 * titles left-aligned in the slot right after the back control, so this row
 * reproduces that layout and lets AutoFitHeaderTitle shrink only when the
 * translation cannot fit on one base-size line.
 */
export const AutoFitLeftHeader = ({ title }: { title: string }) => {
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
          <AutoFitHeaderTitle
            align="left"
            text={title}
            textStyle={styles.title}
          />
        </View>
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
  // 44pt tap target whose visible 24pt chevron sits at the content edge. The
  // negative margin cancels the box's extra 20pt so the title starts at the
  // same x as production, not after a full 44pt slot.
  backSlot: {
    width: 44,
    height: HEADER_CONTENT_HEIGHT,
    marginRight: -20,
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
    justifyContent: 'center',
  },
  title: {
    color: colors2024['neutral-title-1'],
  },
}));
