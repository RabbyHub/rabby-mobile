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
  RcIconInfoCC,
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
import { makeThemeIcon2024FromCC } from '@/hooks/makeThemeIcon';

const TOAST_MIN_H = 44;

const config: ToastOptions = {
  position: Toast.positions.TOP + 80,
  shadow: false,
  animation: true,
  hideOnPress: true,
  delay: 0,
  textStyle: {
    fontSize: 15,
  },
  opacity: 1,
  containerStyle: {
    borderRadius: 12,
    minHeight: TOAST_MIN_H,
    padding: 0,
    overflow: 'visible',
    // ...makeDebugBorder(),
  },
  backgroundColor: ThemeColors2024.light['neutral-black'],
};

type ToastRenderCtxBase = {
  styles: ReturnType<typeof getStyle>;
  config?: Partial<ManagedOptions>;
};
type ToastRenderCtxWithIcon = ToastRenderCtxBase & {
  iconNode: React.ReactNode;
  Icon: React.FC<SvgProps>;
};

type ManagedOptions = ToastOptions & {
  /**
   * @description if true, the toast will not be auto removed when next managed toast is shown
   */
  standalone?: boolean;
};
const managedToasts = new Set<any>();
type ShowParamas = Parameters<typeof Toast.show>;
function showManagedToast(
  msgNode: ShowParamas[0],
  options?: Partial<ManagedOptions>,
) {
  clearManagedToasts();
  const toastInst = Toast.show(msgNode, options);
  !options?.standalone && managedToasts.add(toastInst);

  return toastInst;
}
function clearManagedToasts() {
  [...managedToasts].forEach(toast => {
    Toast.hide(toast);
    managedToasts.delete(toast);
  });
}

const show = (
  message: React.ReactNode | ((ctx: ToastRenderCtxBase) => React.ReactNode),
  { standalone = false, ...extraConfig }: Partial<ManagedOptions> = {},
) => {
  const styles = getTheme2024({ getStyle });
  const msgNode =
    typeof message === 'function' ? (
      message({
        styles,
        config: extraConfig,
      }) || null
    ) : (
      <>
        <Text style={styles.text}>{message || ' '}</Text>
      </>
    );

  const toastInst = showManagedToast(msgNode, { ...config, ...extraConfig });

  return () => Toast.hide(toastInst);
};

export const toastWithIcon =
  (Icon: React.FC<SvgProps>) =>
  (
    message?: string | ((ctx: ToastRenderCtxWithIcon) => React.ReactNode),
    _config?: Partial<ManagedOptions>,
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

    const toastInst = showManagedToast(
      <View style={styles.containerInner}>{msgNode}</View>,
      Object.assign({}, config, _config, {
        containerStyle: StyleSheet.flatten([
          config.containerStyle,
          _config?.containerStyle,
        ]),
      }),
    );

    return () => Toast.hide(toastInst);
  };

const IconInfo = makeThemeIcon2024FromCC(RcIconInfoCC, ctx => ({
  onLight: ctx.colors2024['neutral-info'],
  onDark: ctx.colors2024['neutral-info'],
}));

const info = toastWithIcon(IconInfo);

const success = toastWithIcon(IconTick);
const error = toastWithIcon(IconError);

export const toast = {
  show,
  info,
  success,
  error,
  positions: Toast.positions,
};

export const toastLoading = (
  msg?: string,
  options?: Pick<Partial<ManagedOptions>, 'standalone'>,
) => {
  clearManagedToasts();
  const toastInst = showManagedToast(
    <View
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
      ...options,
      duration: 300000000,
      animation: true,
      hideOnPress: false,
      opacity: 0.9,
      shadow: false,
      position: 0,
    },
  );

  return () => Toast.hide(toastInst);
};

export const toastIndicator = (
  msg: string,
  options?: ManagedOptions & {
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

export const toastLoadingSuccess = (
  msg?: string,
  options?: Partial<ManagedOptions>,
) => {
  const toastInst = showManagedToast(
    <View
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
  return () => Toast.hide(toastInst);
};

export const toastWithDotAnimation = (
  message?: string | ((ctx: ToastRenderCtxBase) => React.ReactNode),
  _config?: Partial<ManagedOptions>,
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

  const toastInst = showManagedToast(
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
  return () => Toast.hide(toastInst);
};

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    containerInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      height: '100%',
      // paddingVertical: 16,
      // minHeight: TOAST_MIN_H,
      // ...makeDevOnlyStyle({
      //   backgroundColor: 'white',
      // }),
    },
    icon: {
      marginRight: 6,
      color: ThemeColors2024.light['neutral-InvertHighlight'],
    },
    text: {
      // ...makeDebugBorder(),
      color: ThemeColors2024.light['neutral-InvertHighlight'],
      fontSize: 15,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },
    selfDefinedContent: {
      maxWidth: 250,
    },
  };
});
