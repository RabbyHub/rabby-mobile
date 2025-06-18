import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';

import CloseCC from './icons/close-cc.svg';
import RabbySilhouetteLight from './icons/rabby-silhouette-light.svg';
import RabbySilhouetteDark from './icons/rabby-silhouette-dark.svg';
import { useExposureRateGuide, useRateModal } from './hooks';
import PressableStar from './RateStar';
import { useEffect, useState } from 'react';

const STAR_SIZE = 38;
const TRIGGER_HEIGHT = 88;

const SIZES = {
  closeIconSize: 16,
  closeIconOffset: 12,
};

const TRIGGER_AFTER_DELAY = 500; // ms
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
      setUserSelectedStar(0);
    }, TRIGGER_AFTER_DELAY);

    return () => {
      clearTimeout(timer);
      setUserSelectedStar(0);
    };
  }, [userSelectedStar, toggleShowRateModal]);

  if (!shouldShowRateGuideOnHome) return null;

  return (
    <TouchableWithoutFeedback style={style} disabled>
      <View
        style={StyleSheet.flatten([styles.container])}
        testID="RateModalTriggerOnHome">
        <View style={[styles.silhouetteContainer]}>
          {!isLight ? (
            <RabbySilhouetteDark height={TRIGGER_HEIGHT} />
          ) : (
            <RabbySilhouetteLight height={TRIGGER_HEIGHT} />
          )}
        </View>
        <TouchableOpacity
          style={styles.closeContainer}
          onPress={evt => {
            evt.stopPropagation();
            disableExposureRateGuide();
          }}>
          <CloseCC
            color={colors2024['neutral-title-1']}
            width={SIZES.closeIconSize}
            height={SIZES.closeIconSize}
          />
        </TouchableOpacity>
        <Text style={styles.text}>
          {t('page.nextComponent.rateModalTriggerOnHome.description')}
        </Text>
        <View style={styles.starsContainer}>
          {Array.from({ length: 5 }, (_, index) => (
            <PressableStar
              key={`star-${index}`}
              size={STAR_SIZE}
              // never allow to select star if user already selected one
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
    </TouchableWithoutFeedback>
  );
}

const getStyles = createGetStyles2024(({ colors2024 }) => {
  return {
    container: {
      position: 'relative',
      width: '100%',
      height: TRIGGER_HEIGHT,
      borderRadius: 12,
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: colors2024['brand-light-1'],

      backgroundColor: colors2024['brand-light-1'],
      shadowColor: colors2024['brand-light-1'],
      shadowOffset: {
        width: 0,
        height: 6,
      },
      shadowRadius: 8,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      paddingVertical: 16,
    },
    silhouetteContainer: {
      position: 'absolute',
      height: TRIGGER_HEIGHT,
      left: 0,
      alignSelf: 'center',
    },
    closeContainer: {
      position: 'absolute',
      top: 0,
      right: 0,
      paddingTop: SIZES.closeIconOffset - 2,
      paddingRight: SIZES.closeIconOffset,
      paddingLeft: SIZES.closeIconOffset * 0.5,
      paddingBottom: SIZES.closeIconOffset * 0.5,
      maxWidth: SIZES.closeIconSize + SIZES.closeIconOffset * 2,
      maxHeight: SIZES.closeIconSize + SIZES.closeIconOffset * 2,
      // ...makeDebugBorder(),
      alignItems: 'center',
      justifyContent: 'center',
    },
    starsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
      gap: 18,
      width: '100%',
      maxWidth: STAR_SIZE * 5 + 4 * 4, // 5 stars + 4 gaps
      height: STAR_SIZE,
    },
    text: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro',
      fontSize: 16,
      fontStyle: 'normal',
      fontWeight: 700,
      lineHeight: 20,
    },
  };
});
