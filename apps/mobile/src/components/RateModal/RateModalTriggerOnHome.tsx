import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { HomeBanner } from '@/components2024/HomeBanner';

import {
  RcIconCloseCC,
  RcIconRabbyMascotDark,
  RcIconRabbyMascotLight,
} from '@/assets2024/icons/rateModal';
import { useExposureRateGuide, useRateModal } from './hooks';
import PressableStar from './RateStar';
import { useEffect, useState } from 'react';
import { matomoRequestEvent } from '@/utils/analytics';

const STAR_SIZE = 32;
const TRIGGER_HEIGHT = 100;

const CLOSE_ICON_SIZE = 20;

const TRIGGER_AFTER_DELAY = Math.max(500, PressableStar.MS_PLAY_ONCE);

const styles = StyleSheet.create({
  starsContainer: {
    height: STAR_SIZE,
  },
});

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
  const { isLight, colors2024 } = useTheme2024();

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

  const Mascot = isLight ? RcIconRabbyMascotLight : RcIconRabbyMascotDark;

  return (
    <HomeBanner
      style={style}
      testID="RateModalTriggerOnHome"
      title={t('page.nextComponent.rateModalTriggerOnHome.title', {
        defaultValue: 'Rating Rabby Wallet',
      })}
      contentStyle={styles.starsContainer}
      content={Array.from({ length: 5 }, (_, index) => (
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
      mascot={<Mascot width={126} height={TRIGGER_HEIGHT} />}
      onClose={disableExposureRateGuide}
      closeIcon={
        <RcIconCloseCC
          color={colors2024['neutral-secondary']}
          width={CLOSE_ICON_SIZE}
          height={CLOSE_ICON_SIZE}
        />
      }
    />
  );
}
