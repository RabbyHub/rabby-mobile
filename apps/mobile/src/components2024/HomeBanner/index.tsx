import {
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Text } from '@/components/Typography';

const CLOSE_ICON_SIZE = 20;
const CLOSE_ICON_OFFSET = 10;
const DEFAULT_HEIGHT = 100;

export type HomeBannerProps = {
  title?: string | React.ReactNode;
  /** Main content rendered below the title (e.g. action buttons, inputs, ratings). */
  content?: React.ReactNode;
  /** Mascot or illustration rendered on the right side. */
  mascot?: React.ReactNode;
  onClose?: () => void;
  closeIcon?: React.ReactNode;
  style?: RNViewProps['style'];
  contentStyle?: RNViewProps['style'];
  testID?: string;
};

export function HomeBanner({
  title,
  content,
  mascot,
  onClose,
  closeIcon,
  style,
  contentStyle,
  testID,
}: HomeBannerProps) {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <TouchableWithoutFeedback style={style} disabled>
      <View style={StyleSheet.flatten([styles.container])} testID={testID}>
        <View style={styles.leftContent}>
          {typeof title === 'string' ? (
            <Text style={styles.title}>{title}</Text>
          ) : (
            title
          )}
          {content ? (
            <View
              style={StyleSheet.flatten([styles.contentArea, contentStyle])}>
              {content}
            </View>
          ) : null}
        </View>

        {mascot ? (
          <View style={styles.mascotContainer} pointerEvents="none">
            {mascot}
          </View>
        ) : null}

        {onClose ? (
          <TouchableOpacity
            style={styles.closeContainer}
            onPress={evt => {
              evt.stopPropagation();
              onClose();
            }}>
            {closeIcon}
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableWithoutFeedback>
  );
}

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    position: 'relative',
    width: '100%',
    height: DEFAULT_HEIGHT,
    borderRadius: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    overflow: 'hidden',
  },
  leftContent: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 4,
    zIndex: 1,
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: 900,
    lineHeight: 24,
  },
  contentArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  mascotContainer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 126,
    height: DEFAULT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeContainer: {
    position: 'absolute',
    top: CLOSE_ICON_OFFSET,
    right: CLOSE_ICON_OFFSET,
    width: CLOSE_ICON_SIZE,
    height: CLOSE_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
}));
