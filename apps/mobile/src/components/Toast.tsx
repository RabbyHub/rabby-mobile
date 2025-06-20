import {
  View,
  StyleSheet,
  Platform,
  ActivityIndicator,
  StyleProp,
  TextStyle,
} from 'react-native';
import Toast, { ToastOptions } from 'react-native-root-toast';
import { SvgProps } from 'react-native-svg';

import { Text } from '@/components';
import {
  IconCommonInfo,
  IconTick,
  IconToastSuccess,
} from '@/assets/icons/common';
import React from 'react';
import { ThemeColors } from '@/constant/theme';

const config: ToastOptions = {
  position: Toast.positions.TOP + 80,
  shadow: false,
  animation: true,
  hideOnPress: true,
  delay: 0,
  textStyle: {
    fontSize: 15,
  },
  containerStyle: {
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backgroundColor: ThemeColors.light['neutral-black'],
};

const show = (message: any, extraConfig?: ToastOptions) => {
  let msg = message;
  if (typeof message !== 'string') {
    // avoid crash
    msg = ' ';
  }

  const _toast = Toast.show(msg, { ...config, ...extraConfig });
  return () => Toast.hide(_toast);
};

type ToastRenderCtx = {
  textStyle: StyleProp<TextStyle>;
  config?: Partial<ToastOptions>;
};
export const toastWithIcon =
  (Icon: React.FC<SvgProps>) =>
  (
    message?: string | ((ctx: ToastRenderCtx) => React.ReactNode),
    _config?: Partial<ToastOptions>,
  ) => {
    const msgNode =
      typeof message === 'function' ? (
        message({ textStyle: styles.content, config: _config }) || null
      ) : (
        <Text style={styles.content}>{message || ' '}</Text>
      );

    const _toast = Toast.show(
      (
        <View style={styles.container}>
          <Icon style={styles.icon} />
          {msgNode}
        </View>
      ) as any,
      Object.assign(
        {},
        config,
        _config,
        Platform.OS === 'ios'
          ? {
              containerStyle: {
                ...(config.containerStyle as any),
                ...(_config?.containerStyle as any),
                paddingBottom: 5,
              },
            }
          : {},
      ),
    );
    return () => Toast.hide(_toast);
  };

const info = toastWithIcon(IconCommonInfo);

const success = toastWithIcon(IconTick);

export const toast = {
  show,
  info,
  success,
  error: info,
  positions: Toast.positions,
};

export const toastLoading = (msg?: string) => {
  const _toast = Toast.show(
    // @ts-ignore
    <View
      // eslint-disable-next-line react-native/no-inline-styles
      style={{
        width: 126,
        height: 126,
        justifyContent: 'space-evenly',
        alignItems: 'center',
        borderRadius: 8,
      }}>
      <ActivityIndicator size="large" />
      {msg ? (
        <Text style={{ color: ThemeColors.light['neutral-title-2'] }}>
          {msg}
        </Text>
      ) : null}
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

export const toastIndicator = (
  msg: string,
  options?: ToastOptions & {
    isTop?: boolean;
  },
) => {
  return toastWithIcon(() => (
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
      : toast.positions.CENTER,
    hideOnPress: false,
    ...options,
  });
};

export const toastLoadingSuccess = (msg?: string, options?: ToastOptions) => {
  const _toast = Toast.show(
    // @ts-ignore
    <View
      // eslint-disable-next-line react-native/no-inline-styles
      style={{
        width: 126,
        height: 126,
        justifyContent: 'space-evenly',
        alignItems: 'center',
        borderRadius: 8,
      }}>
      <IconToastSuccess width={50} height={50} />
      {msg ? (
        <Text style={{ color: ThemeColors.light['neutral-title-2'] }}>
          {msg}
        </Text>
      ) : null}
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
    marginRight: 8,
    color: ThemeColors.light['neutral-title-2'],
  },
  content: {
    color: ThemeColors.light['neutral-title-2'],
    maxWidth: 250,
  },
});
