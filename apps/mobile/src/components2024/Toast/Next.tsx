import {
  Dimensions,
  View,
  StyleSheet,
  Platform,
  ActivityIndicator,
  StyleProp,
  TextStyle,
  Text,
} from 'react-native';
import Toast, { ToastOptions } from 'react-native-root-toast';
import { SvgProps } from 'react-native-svg';

import {
  RcIconInfoCC,
  IconTick,
  IconToastSuccess,
} from '@/assets/icons/common';

export const RcIconInfo = makeThemeIcon2024FromCC(RcIconInfoCC, ctx => ({
  onLight: ctx.colors['neutral-title-1'],
  onDark: ctx.colors['neutral-title-1'],
}));

import React from 'react';
import { ThemeColors } from '@/constant/theme';
import { makeThemeIcon2024FromCC } from '@/hooks/makeThemeIcon';

function getConfig(): ToastOptions {
  return {
    position: Toast.positions.TOP + 80,
    shadow: false,
    animation: true,
    hideOnPress: true,
    delay: 0,
    textStyle: {
      fontSize: 14,
    },
    containerStyle: {
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    backgroundColor: ThemeColors.light['neutral-black'],
  };
}

const show = (message: any, extraConfig?: ToastOptions) => {
  let msg = message;
  if (typeof message !== 'string') {
    // avoid crash
    msg = ' ';
  }

  const _toast = Toast.show(msg, { ...getConfig(), ...extraConfig });
  return () => Toast.hide(_toast);
};

type ToastRenderCtx = {
  textStyle: StyleProp<TextStyle>;
  config?: Partial<ToastOptions>;
};
export const toast4WithIcon =
  (Icon: React.FC<SvgProps>) =>
  (
    message?: React.ReactNode | ((ctx: ToastRenderCtx) => React.ReactNode),
    _config?: Partial<ToastOptions>,
  ) => {
    const msgNode =
      typeof message === 'function' ? (
        message({ textStyle: styles.text, config: _config }) || null
      ) : (
        <Text style={styles.text}>{message || ' '}</Text>
      );

    const _toast = Toast.show(
      <View style={[styles.container, { paddingRight: 16 }]}>
        <Icon style={[styles.icon]} />
        {msgNode}
      </View>,
      Object.assign(
        {},
        getConfig(),
        _config,
        Platform.OS === 'ios'
          ? {
              containerStyle: {
                ...(getConfig().containerStyle as any),
                ...(_config?.containerStyle as any),
                paddingBottom: 5,
              },
            }
          : {},
      ),
    );
    return () => Toast.hide(_toast);
  };

const info = toast4WithIcon(RcIconInfo);

const success = toast4WithIcon(IconToastSuccess);

export const toast4 = {
  show,
  info,
  success,
  error: info,
  positions: Toast.positions,
};

export const toast4Loading = (
  msg?: React.ReactNode | ((ctx: ToastRenderCtx) => React.ReactNode),
) => {
  const msgNode =
    typeof msg === 'function' ? (
      msg({
        textStyle: StyleSheet.flatten([styles.text, styles.textInLoading]),
      })
    ) : (
      <Text style={{ color: ThemeColors.light['neutral-title-2'] }}>{msg}</Text>
    );

  const _toast = Toast.show(
    <View
      style={{
        width: 126,
        height: 126,
        justifyContent: 'space-evenly',
        alignItems: 'center',
        borderRadius: 8,
      }}>
      <ActivityIndicator size="large" />
      {msgNode || null}
    </View>,
    {
      duration: 300000000,
      animation: true,
      hideOnPress: false,
      opacity: 0.9,
      shadow: false,
      position: 0,
    },
  );
  return () => Toast.hide(_toast);
};

export const toast4Indicator = (
  msg: string,
  options?: ToastOptions & {
    isTop?: boolean;
  },
) => {
  return toast4WithIcon(() => (
    <ActivityIndicator
      // eslint-disable-next-line react-native/no-inline-styles
      style={{
        marginRight: 6,
      }}
      color={ThemeColors.light['neutral-title-2']}
    />
  ))(msg, {
    duration: 100000,
    position: options?.isTop
      ? Toast.positions.TOP + 80
      : toast4.positions.CENTER,
    hideOnPress: false,
    ...options,
  });
};

export const toast4LoadingSuccess = (
  msg?: React.ReactNode | ((ctx: ToastRenderCtx) => React.ReactNode),
  options?: ToastOptions,
) => {
  const msgNode =
    typeof msg === 'function' ? (
      msg({
        textStyle: StyleSheet.flatten([styles.text, styles.textInLoading]),
      })
    ) : (
      <Text style={{ color: ThemeColors.light['neutral-title-2'] }}>{msg}</Text>
    );
  const _toast = Toast.show(
    <View
      style={{
        width: 126,
        height: 126,
        justifyContent: 'space-evenly',
        alignItems: 'center',
        borderRadius: 8,
      }}>
      <IconToastSuccess width={50} height={50} />
      {msgNode || null}
    </View>,
    {
      animation: true,
      hideOnPress: true,
      opacity: 0.9,
      position: 0,
      shadow: false,
      ...options,
    },
  );
  return () => Toast.hide(_toast);
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 16,
    height: 16,
    marginRight: 8,
    color: ThemeColors.light['neutral-title-2'],
  },
  text: {
    color: ThemeColors.light['neutral-title-2'],
    fontSize: 16,
    maxWidth: Dimensions.get('window').width - 20 * 2,
  },
  textInLoading: {
    fontSize: 14,
  },
});
