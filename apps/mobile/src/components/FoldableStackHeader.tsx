import React from 'react';
import { StyleSheet, View, type TextStyle } from 'react-native';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';

import { HeaderBackButton } from '@/components/NavigationHeaderBack';
import { useCustomHeaderTop } from '@/hooks/useAppLayout';
import { useSystemColumnInset } from '@/components/SafeWindowFrame/backdrop';
import { useTheme2024 } from '@/hooks/theme';
import { Text } from '@/components/Typography';
import { createGetStyles2024 } from '@/utils/styles';

const HEADER_CONTENT_HEIGHT = 44;
const HEADER_HORIZONTAL_INSET = 16;

/**
 * JS replica of the native stack header, used **only** on the iPhone Duo outer
 * screen.
 *
 * That posture renders the app tree at the full window width so screen
 * backgrounds run under the system column; `react-native-screens` cannot lay a
 * UIKit bar item out on that wider view, so every stack screen switches to this
 * header there. Other devices / postures keep the native header untouched.
 */
export function FoldableStackHeader(props: NativeStackHeaderProps) {
  const { options, route, navigation } = props;
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const headerTop = useCustomHeaderTop();
  const columnInset = useSystemColumnInset();
  const titleAlignLeft = options.headerTitleAlign === 'left';

  const canGoBack = navigation.canGoBack();
  const tintColor =
    (options.headerTintColor as string | undefined) ??
    colors2024['neutral-title-1'];
  const backgroundColor =
    (options.headerStyle as { backgroundColor?: string } | undefined)
      ?.backgroundColor ?? 'transparent';

  const titleNode = (() => {
    const headerTitle = options.headerTitle as unknown;
    if (typeof headerTitle === 'function') {
      return headerTitle({ children: options.title ?? route.name, tintColor });
    }
    if (typeof headerTitle === 'string') {
      return (
        <Text
          numberOfLines={1}
          style={[
            styles.title,
            options.headerTitleStyle as TextStyle | undefined,
            { color: tintColor },
          ]}>
          {headerTitle}
        </Text>
      );
    }
    if (headerTitle !== undefined) {
      return headerTitle as React.ReactNode;
    }
    const headerTitleNode = options.title ?? route.name;
    return (
      <Text
        numberOfLines={1}
        style={[
          styles.title,
          options.headerTitleStyle as TextStyle | undefined,
          { color: tintColor },
        ]}>
        {headerTitleNode}
      </Text>
    );
  })();

  const leftNode = options.headerLeft ? (
    options.headerLeft({ tintColor, canGoBack })
  ) : canGoBack ? (
    <HeaderBackButton tintColor={tintColor} />
  ) : null;

  const rightNode = options.headerRight
    ? options.headerRight({ tintColor, canGoBack })
    : null;

  return (
    <View
      style={[
        styles.outer,
        {
          paddingTop: headerTop,
          backgroundColor,
          paddingLeft: columnInset.left,
          paddingRight: columnInset.right,
        },
      ]}>
      <View style={styles.row}>
        <View style={styles.side}>{leftNode}</View>
        <View
          style={[styles.titleWrap, titleAlignLeft && styles.titleWrapLeft]}>
          {titleNode}
        </View>
        <View style={[styles.side, styles.sideRight]}>{rightNode}</View>
      </View>
    </View>
  );
}

export function renderFoldableStackHeader(props: NativeStackHeaderProps) {
  return <FoldableStackHeader {...props} />;
}

const getStyle = createGetStyles2024(() => ({
  outer: {
    width: '100%',
  },
  row: {
    height: HEADER_CONTENT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: HEADER_HORIZONTAL_INSET,
  },
  side: {
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideRight: {
    justifyContent: 'flex-end',
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrapLeft: {
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
}));
