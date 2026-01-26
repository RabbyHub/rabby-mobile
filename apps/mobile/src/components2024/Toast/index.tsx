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
import IconError from '@/assets2024/icons/common/cancel.svg';
import React from 'react';
import { ThemeColors2024 } from '@/constant/theme';
import { Dots } from '@/components/Approval/components/Popup/Dots';
import {
  createGetStyles2024,
  makeDebugBorder,
  makeDevOnlyStyle,
} from '@/utils/styles';
import { getTheme2024 } from '@/hooks/theme';

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
    borderRadius: 12,
    padding: 0,
    overflow: 'visible',
    // ...makeDebugBorder(),
    // paddingHorizontal: 16,
    // paddingVertical: 12,
  },
  backgroundColor: ThemeColors2024.light['neutral-black'],
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

type ToastRenderCtxBase = {
  styles: ReturnType<typeof getStyle>;
  config?: Partial<ToastOptions>;
};
type ToastRenderCtxWithIcon = ToastRenderCtxBase & {
  iconNode: React.ReactNode;
  Icon: React.FC<SvgProps>;
};
export const toastWithIcon =
  (Icon: React.FC<SvgProps>) =>
  (
    message?: string | ((ctx: ToastRenderCtxWithIcon) => React.ReactNode),
    _config?: Partial<ToastOptions>,
  ) => {
    const styles = getTheme2024({ getStyle });
    const iconNode = <Icon width={16} height={16} style={styles.icon} />;
    const msgNode =
      typeof message === 'function' ? (
        message({
          iconNode,
          Icon,
          styles,
          config: _config,
        }) || null
      ) : (
        <>
          {iconNode}
          <Text style={styles.text}>{message || ' '}</Text>
        </>
      );

    const _toast = Toast.show(
      <View style={styles.containerInner}>{msgNode}</View>,
      Object.assign({}, config, _config, {
        containerStyle: StyleSheet.flatten([
          config.containerStyle,
          _config?.containerStyle,
        ]),
      }),
    );
    return () => Toast.hide(_toast);
  };

const info = toastWithIcon(IconCommonInfo);

const success = toastWithIcon(IconTick);
const error = toastWithIcon(IconError);

export const toast = {
  show,
  info,
  success,
  error,
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
        <Text style={{ color: ThemeColors2024.light['neutral-title-2'] }}>
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
      color={ThemeColors2024.light['neutral-title-2']}
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
        <Text style={{ color: ThemeColors2024.light['neutral-title-2'] }}>
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

export const toastWithDotAnimation = (
  message?: string | ((ctx: ToastRenderCtxBase) => React.ReactNode),
  _config?: Partial<ToastOptions>,
) => {
  const styles = getTheme2024({ getStyle });
  const msgNode =
    typeof message === 'function' ? (
      message({
        styles,
        config: _config,
      }) || null
    ) : (
      <Text style={styles.text}>{message || ' '}</Text>
    );

  const _toast = Toast.show(
    <View style={styles.containerInner}>
      {msgNode}
      <Dots style={styles.text} />
    </View>,
    Object.assign({}, config, _config, {
      containerStyle: StyleSheet.flatten([
        config.containerStyle,
        _config?.containerStyle,
      ]),
    }),
  );
  return () => Toast.hide(_toast);
};

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    containerInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
      // ...makeDevOnlyStyle({
      //   backgroundColor: 'white',
      // }),
    },
    icon: {
      marginRight: 6,
      color: ThemeColors2024.light['neutral-title-2'],
    },
    text: {
      // ...makeDebugBorder(),
      color: ThemeColors2024.light['neutral-title-2'],
      fontSize: 15,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },
    selfDefinedContent: {
      maxWidth: 250,
    },
  };
});
