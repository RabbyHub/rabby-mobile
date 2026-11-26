import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colord } from 'colord';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  Extrapolate,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import RcIconEditDoneCC from '@/assets2024/icons/home/IconEditDoneCC.svg';
import RcIconMoveDownCC from '@/assets2024/icons/home/IconMoveDownCC.svg';
import { Text } from '@/components/Typography';
import { getBottomButtonBottomOffset } from '@/constant/layout';
import { useHomeTabIndex } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { triggerImpact } from '@/utils/common';
import { createGetStyles2024 } from '@/utils/styles';
import {
  homeFeatureLayoutApi,
  useIsHomeFeatureEditing,
} from '../../hooks/homeFeatureLayout';
import { homeDrawerAnimateMutable } from '../../hooks/useHomeDrawerAnimate';
import { HOME_FEATURE_EDIT_FOOTER_HEIGHT } from './constants';

/** Stands in for the arrow icon inside the translated hint sentence. */
const ARROW_SLOT = '￼';
/** The gradient starts fading this far above the footer's own box. */
const GRADIENT_OVERHANG = 25;

const { pullPercent } = homeDrawerAnimateMutable;

function HintLine({
  text,
  arrow,
  style,
}: {
  /** The sentence with `ARROW_SLOT` where the arrow icon belongs. */
  text: string;
  arrow: 'down' | 'up';
  style: React.ComponentProps<typeof Animated.View>['style'];
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [before = '', after = ''] = text.split(ARROW_SLOT);

  return (
    <Animated.View style={[styles.hintLine, style]}>
      {before.trim() ? (
        <Text style={styles.hintText}>{before.trim()}</Text>
      ) : null}
      <RcIconMoveDownCC
        width={20}
        height={20}
        color={colors2024['brand-default']}
        style={arrow === 'up' ? styles.arrowUp : undefined}
      />
      {after.trim() ? (
        <Text style={styles.hintText}>{after.trim()}</Text>
      ) : null}
    </Animated.View>
  );
}

function HomeFeatureEditFooterContent({
  editing,
  onHidden,
}: {
  editing: boolean;
  onHidden: () => void;
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { tabIndex } = useHomeTabIndex();
  const visible = useSharedValue(0);

  useEffect(() => {
    visible.value = withTiming(editing ? 1 : 0, { duration: 200 }, finished => {
      if (finished && !editing) {
        runOnJS(onHidden)();
      }
    });
  }, [editing, onHidden, visible]);

  // Editing is about the two floors of the overview only: leaving them by
  // any route ends it instead of leaving a mode on that nothing shows.
  useEffect(() => {
    if (tabIndex !== 0) {
      homeFeatureLayoutApi.stopEditing();
    }
  }, [tabIndex]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        homeFeatureLayoutApi.stopEditing();
      };
    }, []),
  );

  useEffect(() => {
    if (!editing) {
      return;
    }
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        homeFeatureLayoutApi.stopEditing();
        return true;
      },
    );
    return () => subscription.remove();
  }, [editing]);

  const handleDone = useCallback(() => {
    triggerImpact();
    homeFeatureLayoutApi.stopEditing();
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: visible.value,
    transform: [{ translateY: (1 - visible.value) * 24 }],
  }));
  // The hint follows the floor on screen: it turns while the drawer travels.
  const homeHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      pullPercent.value,
      [-60, -40],
      [0, 1],
      Extrapolate.CLAMP,
    ),
  }));
  const moreHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      pullPercent.value,
      [-60, -40],
      [1, 0],
      Extrapolate.CLAMP,
    ),
  }));

  const gradientColors = useMemo(() => {
    const solid = colors2024['neutral-bg-1'];
    return [colord(solid).alpha(0).toRgbString(), solid];
  }, [colors2024]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.container, containerStyle]}>
      <LinearGradient
        pointerEvents="none"
        colors={gradientColors}
        locations={GRADIENT_LOCATIONS}
        style={styles.gradient}
      />
      <View pointerEvents="none" style={styles.hintBox}>
        <HintLine
          text={t('page.home.featureEdit.removeHint', { arrow: ARROW_SLOT })}
          arrow="down"
          style={homeHintStyle}
        />
        <HintLine
          text={t('page.home.featureEdit.addHint', { arrow: ARROW_SLOT })}
          arrow="up"
          style={[styles.hintLineOverlay, moreHintStyle]}
        />
      </View>
      <TouchableOpacity
        testID="home-feature-edit-done"
        accessibilityRole="button"
        accessibilityLabel={t('global.Done')}
        activeOpacity={0.8}
        disabled={!editing}
        style={styles.doneButton}
        onPress={handleDone}>
        <RcIconEditDoneCC
          width={24}
          height={24}
          color={colors2024['neutral-InvertHighlight']}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * The bar pinned to the bottom of both floors while the feature cards are
 * being edited. Nothing is mounted outside edit mode.
 */
export function HomeFeatureEditFooter() {
  const editing = useIsHomeFeatureEditing();
  const [mounted, setMounted] = useState(editing);
  // Mount with the edit state, unmount only after the exit fade has run.
  if (editing && !mounted) {
    setMounted(true);
  }
  const handleHidden = useCallback(() => {
    setMounted(false);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <HomeFeatureEditFooterContent editing={editing} onHidden={handleHidden} />
  );
}

// Transparent at the very top, solid from about a quarter of the way down.
const GRADIENT_LOCATIONS = [0.02, 0.29];

const getStyle = createGetStyles2024(({ colors2024, safeAreaInsets }) => {
  const bottomOffset = getBottomButtonBottomOffset(safeAreaInsets.bottom);

  return {
    container: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      minHeight:
        HOME_FEATURE_EDIT_FOOTER_HEIGHT -
        getBottomButtonBottomOffset(0) +
        bottomOffset,
      paddingTop: 29,
      paddingBottom: bottomOffset,
      paddingHorizontal: 16,
      alignItems: 'center',
      zIndex: 20,
    },
    gradient: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      top: -GRADIENT_OVERHANG,
    },
    hintBox: {
      minHeight: 20,
      alignSelf: 'stretch',
      justifyContent: 'center',
    },
    hintLine: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
    },
    hintLineOverlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    hintText: {
      flexShrink: 1,
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 16,
      lineHeight: 20,
      textAlign: 'center',
      color: colors2024['brand-default-light'],
    },
    arrowUp: {
      transform: [{ rotate: '180deg' }],
    },
    doneButton: {
      marginTop: 14,
      width: 48,
      height: 48,
      borderRadius: 12,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors2024['brand-default'],
      shadowColor: 'rgb(112, 132, 255)',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
    },
  };
});
