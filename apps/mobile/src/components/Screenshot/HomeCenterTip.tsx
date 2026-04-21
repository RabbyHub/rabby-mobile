import { useTranslation } from 'react-i18next';

import { View, TouchableOpacity } from 'react-native';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

import RcBgBug from './icons/hometip-bg-bug.svg';
import RcBulb from './icons/hometip-bulb.svg';
import RcCloseCC from './icons/hometip-close-cc.svg';

import { useViewedHomeTip } from './hooks';
import { ScreenLayouts } from '@/constant/layout';
import { IS_IOS } from '@/core/native/utils';
import { Text } from '@/components/Typography';

export function TipFeedbackByScreenshot({ style }: RNViewProps) {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const { viewedHomeTip, markViewedHomeTip } = useViewedHomeTip();

  if (viewedHomeTip) return null;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.line}>
        <Text style={styles.title}>
          {IS_IOS ? (
            <Text style={styles.textBulb}>💡</Text>
          ) : (
            <RcBulb style={styles.iconBulb} />
          )}
          {t('page.nextComponent.homeCenterTipScreenshot.title')}
        </Text>
        <TouchableOpacity
          onPress={() => {
            markViewedHomeTip();
          }}>
          <RcCloseCC style={styles.closeIcon} />
        </TouchableOpacity>
      </View>
      <View style={styles.line}>
        <Text style={styles.description}>
          {t('page.nextComponent.homeCenterTipScreenshot.description')}
        </Text>
      </View>
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    container: {
      marginHorizontal: ScreenLayouts.homeHorizontalPadding,

      position: 'relative',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,

      flexDirection: 'column',
      justifyContent: 'center',

      backgroundColor: colors2024['neutral-line'],
    },

    iconBgBug: {
      position: 'absolute',
      top: 0,
      right: 20,
      zIndex: -1,
    },

    closeIcon: {
      width: 22,
      height: 22,
      color: colors2024['neutral-title-1'],
    },

    line: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      // ...makeDebugBorder(),
    },

    textBulb: {},

    iconBulb: {
      width: 20,
      height: 20,
      marginBottom: 8,
      position: 'relative',
      left: -2,
      bottom: -4,
    },

    title: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontWeight: 700,
      lineHeight: 20,
      color: colors2024['neutral-title-1'],
    },

    description: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontWeight: 500,
      lineHeight: 18,
      color: colors2024['neutral-foot'],
    },
  };
});
