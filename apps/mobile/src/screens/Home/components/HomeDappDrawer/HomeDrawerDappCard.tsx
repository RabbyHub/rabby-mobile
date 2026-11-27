import React, { useCallback, useRef } from 'react';
import type { GestureResponderEvent } from 'react-native';
import { TouchableOpacity, View } from 'react-native';

import { Text } from '@/components/Typography';
import hotDappList from '@/constant/hot-dapp.json';
import type { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { DappIcon } from '@/screens/Dapps/components/DappIcon';
import { createGetStyles2024 } from '@/utils/styles';

const hotDappIconMap = new Map(
  hotDappList.map(item => [item.origin, item.logo] as const),
);

/** A press that travelled further than this was a scroll or a drawer drag. */
const PRESS_MOVE_TOLERANCE = 10;

type HomeDrawerDappCardProps = {
  dapp: DappInfo;
  title: string;
  /** The line under the title. */
  description: string;
  onPress?: (dapp: DappInfo) => void;
};

/**
 * A website on the second floor: the same card on the favorites page and on
 * every category page.
 */
export const HomeDrawerDappCard = React.memo(function HomeDrawerDappCard({
  dapp,
  title,
  description,
  onPress,
}: HomeDrawerDappCardProps) {
  const { styles } = useTheme2024({ getStyle });
  const pressStartRef = useRef({ x: 0, y: 0 });
  const icon = hotDappIconMap.get(dapp.origin) || dapp.icon;

  const handlePressIn = useCallback((event: GestureResponderEvent) => {
    pressStartRef.current = {
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
    };
  }, []);

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      const diffX = event.nativeEvent.pageX - pressStartRef.current.x;
      const diffY = event.nativeEvent.pageY - pressStartRef.current.y;
      if (Math.hypot(diffX, diffY) > PRESS_MOVE_TOLERANCE) {
        return;
      }

      onPress?.(dapp);
    },
    [dapp, onPress],
  );

  return (
    <TouchableOpacity onPressIn={handlePressIn} onPress={handlePress}>
      <View style={styles.card}>
        <DappIcon
          source={icon ? { uri: icon } : undefined}
          origin={dapp.origin}
          style={styles.icon}
        />
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.description} numberOfLines={1}>
            {description}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  card: {
    minHeight: 70,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderCurve: 'continuous',
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
  },
  description: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
  },
}));
