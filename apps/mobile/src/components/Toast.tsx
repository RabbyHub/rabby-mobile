import { View, StyleSheet, Platform, ActivityIndicator } from 'react-native';
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
  position: 400,
  shadow: false,
  animation: true,
  hideOnPress: true,
  delay: 0,
  opacity: 0.9,
};

const show = (message: any, extraConfig?: ToastOptions) => {
  let msg = message;
  if (typeof message !== 'string') {
    // avoid crash
    msg = ' ';
  }

  Toast.show(msg, { ...config, ...extraConfig });
};

const toastWithIcon =
  (Icon: React.FC<SvgProps>) =>
  (message: string, _config?: Partial<ToastOptions>) => {
    let msg = message;
    if (typeof message !== 'string') {
      // avoid crash
      msg = ' ';
    }

    Toast.show(
      (
        <View style={styles.container}>
          <Icon style={styles.icon} />
          <Text style={styles.content}>{msg}</Text>
        </View>
      ) as any,
      Object.assign(
        {},
        config,
        Platform.select({
          ios: {
            containerStyle: {
              paddingBottom: 5,
            },
          },
        }),
        _config,
      ),
    );
  };

const info = toastWithIcon(IconCommonInfo);

const success = toastWithIcon(IconTick);

export const toast = {
  show,
  info,
  success,
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
