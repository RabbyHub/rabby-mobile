import {
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

import CloseCC from './icons/close-cc.svg';
import RabbyMascotLight from './icons/rabby-mascot-light.svg';
import RabbyMascotDark from './icons/rabby-mascot-dark.svg';
import { useExposureRateGuide, useRateModal } from './hooks';
import PressableStar from './RateStar';
import { useEffect, useState } from 'react';
import { matomoRequestEvent } from '@/utils/analytics';
import { Text } from '@/components/Typography';

const STAR_SIZE = 32;
const TRIGGER_HEIGHT = 100;

const SIZES = {
  closeIconSize: 20,
  closeIconOffset: 10,
};

const TRIGGER_AFTER_DELAY = Math.max(500, PressableStar.MS_PLAY_ONCE);

function starToText(number: number) {
  const map: Record<number, string> = {
    1: 'One',
    2: 'Two',
    3: 'Three',
    4: 'Four',
    5: 'Five',
  };
  return map[number] ?? 'Unknown';
}

export function RateModalTriggerOnHome({ style }: RNViewProps) {
  const { isLight, styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const { t } = useTranslation();

  const { toggleShowRateModal } = useRateModal();
  const [userSelectedStar, setUserSelectedStar] = useState(0);
  const { shouldShowRateGuideOnHome, disableExposureRateGuide } =
    useExposureRateGuide();

  useEffect(() => {
    if (userSelectedStar <= 0) return;

    const timer = setTimeout(() => {
      toggleShowRateModal(true, {
        starCountOnOpen: userSelectedStar,
      });
      matomoRequestEvent({
        category: 'Rate Rabby',
        action: `Rate_Star_${starToText(userSelectedStar)}`,
      });
      setUserSelectedStar(0);
    }, TRIGGER_AFTER_DELAY);

    return () => {
      clearTimeout(timer);
      setUserSelectedStar(0);
    };
  }, [userSelectedStar, toggleShowRateModal]);

  useEffect(() => {
    if (!shouldShowRateGuideOnHome) return;

    matomoRequestEvent({
      category: 'Rate Rabby',
      action: 'Rate_Show',
    });
  }, [shouldShowRateGuideOnHome]);

  if (!shouldShowRateGuideOnHome) return null;

  const Mascot = isLight ? RabbyMascotLight : RabbyMascotDark;

  return (
    <TouchableWithoutFeedback style={style} disabled>
      <View
        style={StyleSheet.flatten([styles.container])}
        testID="RateModalTriggerOnHome">
        <View style={styles.content}>
          <Text style={styles.title}>
            {t('page.nextComponent.rateModalTriggerOnHome.title', {
              defaultValue: 'Rating Rabby Wallet',
            })}
          </Text>
          <View style={styles.starsContainer}>
            {Array.from({ length: 5 }, (_, index) => (
              <PressableStar
                key={`star-${index}`}
                size={STAR_SIZE}
                disabled={!!userSelectedStar}
                isFilled={false}
                isActive={userSelectedStar >= index + 1}
                onPress={evt => {
                  evt.stopPropagation();
                  setUserSelectedStar(index + 1);
                }}
              />
            ))}
          </View>
        </View>

        <View style={styles.mascotContainer} pointerEvents="none">
          <Mascot width={126} height={TRIGGER_HEIGHT} />
        </View>

        <TouchableOpacity
          style={styles.closeContainer}
          onPress={evt => {
            evt.stopPropagation();
            disableExposureRateGuide();
          }}>
          <CloseCC
            color={colors2024['neutral-secondary']}
            width={SIZES.closeIconSize}
            height={SIZES.closeIconSize}
          />
        </TouchableOpacity>
      </View>
    </TouchableWithoutFeedback>
  );
}

const getStyles = createGetStyles2024(({ colors2024, isLight }) => {
  return {
    container: {
      position: 'relative',
      width: '100%',
      height: TRIGGER_HEIGHT,
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
    content: {
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
    starsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: STAR_SIZE,
      alignSelf: 'stretch',
    },
    mascotContainer: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 126,
      height: TRIGGER_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeContainer: {
      position: 'absolute',
      top: SIZES.closeIconOffset,
      right: SIZES.closeIconOffset,
      width: SIZES.closeIconSize,
      height: SIZES.closeIconSize,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
  };
});
