import React, { useCallback } from 'react';
import { View } from 'react-native';

import RcIconMoveDownCC from '@/assets2024/icons/home/IconMoveDownCC.svg';
import { FastTouchable } from '@/components/Perf/FastTouchable';
import { Text } from '@/components/Typography';
import type { MultiHomeFeatTitle } from '@/constant/newStyle';
import { useAppLanguage } from '@/hooks/lang';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useHomeFeatureNewTag } from '../../hooks/useHomeFeatureNewTag';
import { NewTag } from '../NewTag';
import { HomeFeatureBadge } from './HomeFeatureBadge';
import type { HomeFeatureItem } from './useHomeFeatureMenu';

type HomeFeatureCardProps = {
  item: HomeFeatureItem;
  /** Edit mode is on: the card stops opening its feature. */
  editing: boolean;
  /** Shows the dashed outline and the move arrow while editing. */
  movable: boolean;
  /** Which way the arrow points: down leaves Home, up goes back to it. */
  moveDirection: 'down' | 'up';
  onPress: (key: MultiHomeFeatTitle) => void;
  onLongPress: () => void;
  onMove: () => void;
};

export const HomeFeatureCard = React.memo(function HomeFeatureCard({
  item,
  editing,
  movable,
  moveDirection,
  onPress,
  onLongPress,
  onMove,
}: HomeFeatureCardProps) {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { currentLanguage } = useAppLanguage();
  const isZhLang = currentLanguage === 'zh-CN' || currentLanguage === 'zh-Hant';
  const { shouldShowNewTag, markVisited } = useHomeFeatureNewTag(item.key);
  const showMove = editing && movable;

  const handlePress = useCallback(() => {
    console.debug('[perf] touched menu', item.key);
    onPress(item.key);
    markVisited();
  }, [item.key, markVisited, onPress]);

  return (
    <FastTouchable
      style={styles.card}
      testID={`home-feature-card-${item.key}`}
      disabled={editing}
      onPress={handlePress}
      onLongPress={onLongPress}>
      <View style={styles.badgeWrapper}>
        <View style={styles.iconWrapper}>
          <item.icon
            width={28}
            height={28}
            color={isLight ? colors2024['brand-default-icon'] : '#7084FF'}
          />
        </View>
        <View style={styles.rightBadgeWrapper}>
          <HomeFeatureBadge featureKey={item.key} />
        </View>
      </View>
      <View
        style={[styles.titleWithNewTagRow, showMove && styles.titleRowMovable]}>
        <Text
          style={[styles.title, isZhLang && styles.titleZh]}
          numberOfLines={1}
          ellipsizeMode="tail">
          {item.title}
        </Text>
        {shouldShowNewTag ? (
          <View style={styles.newTagWrapper}>
            <NewTag />
          </View>
        ) : null}
      </View>
      {showMove ? (
        <>
          <View pointerEvents="none" style={styles.dashedOutline} />
          <FastTouchable
            style={styles.moveButton}
            testID={`home-feature-move-${item.key}`}
            onPress={onMove}>
            <RcIconMoveDownCC
              width={20}
              height={20}
              color={colors2024['brand-default']}
              style={moveDirection === 'up' ? styles.moveIconUp : undefined}
            />
          </FastTouchable>
        </>
      ) : null}
    </FastTouchable>
  );
});

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  card: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    width: '100%',
    height: '100%',
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: 20,
    paddingBottom: 16,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 12,
    position: 'relative',
  },
  badgeWrapper: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconWrapper: {
    height: 28,
    width: 28,
  },
  rightBadgeWrapper: {
    position: 'relative',
    right: -4,
    alignSelf: 'flex-start',
  },
  titleWithNewTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Keep a long title clear of the move arrow in the bottom-right corner.
  titleRowMovable: {
    paddingRight: 14,
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'left',
    fontFamily: 'SF Pro Rounded',
  },
  titleZh: {
    fontSize: 15,
  },
  newTagWrapper: {
    marginLeft: 4,
  },
  // Drawn as an overlay instead of on the card itself, so entering edit mode
  // never changes the card's own border box and its content stays put.
  dashedOutline: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors2024['brand-default-light'],
  },
  // The arrow is 20pt; the touch target around it is a full corner of the
  // card so it is easy to hit without widening the artwork.
  moveButton: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 48,
    height: 52,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingRight: 10,
    paddingBottom: 15,
  },
  moveIconUp: {
    transform: [{ rotate: '180deg' }],
  },
}));
