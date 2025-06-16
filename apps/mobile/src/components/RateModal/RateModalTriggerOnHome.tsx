import { StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';

import StarCC from './icons/star-cc.svg';
import CloseCC from './icons/close-cc.svg';
import RabbySilhouette from './icons/rabby-silhouette.svg';
import { RateModal } from './RateModal';
import { useRateModal } from './hooks';

const STAR_SIZE = 38;
const TRIGGER_HEIGHT = 88;

export function RateModalTriggerOnHome({ style }: RNViewProps) {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const { t } = useTranslation();

  const { shouldShowGuideOnHome, toggleShowRateModal } = useRateModal();

  if (!shouldShowGuideOnHome) return null;

  return (
    <>
      <TouchableWithoutFeedback
        style={style}
        onPress={() => {
          toggleShowRateModal(true);
        }}>
        <View
          style={StyleSheet.flatten([styles.container])}
          testID="RateModalTriggerOnHome">
          <View style={styles.silhouetteContainer}>
            <RabbySilhouette height={TRIGGER_HEIGHT} />
          </View>
          <View style={styles.closeContainer}>
            <CloseCC
              color={colors2024['neutral-title-1']}
              width={16}
              height={16}
            />
          </View>
          <Text style={styles.text}>
            {t('page.nextComponent.rateModalTriggerOnHome.description')}
          </Text>
          <View style={styles.starsContainer}>
            {Array.from({ length: 5 }, (_, index) => (
              <StarCC
                key={`star-${index}`}
                width={STAR_SIZE}
                height={STAR_SIZE}
                color={'rgba(0, 0, 0, 0.16)'}
              />
            ))}
          </View>
        </View>
      </TouchableWithoutFeedback>
      <RateModal />
    </>
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
      top: 12,
      right: 12,
      width: 16,
      height: 16,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    starsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
      gap: 4,
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
