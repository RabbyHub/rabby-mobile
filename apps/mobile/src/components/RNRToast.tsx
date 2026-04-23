import { AnimateableText } from '@/components/Typography';
import { ThemeColors2024 } from '@/constant/theme';
import { IS_IOS } from '@/core/native/utils';
import { useTheme2024 } from '@/hooks/theme';
import { RcIconInfoCC, IconTick } from '@/assets/icons/common';
import IconError from '@/assets2024/icons/common/cancel.svg';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  Easing,
  makeMutable,
  runOnJS,
  runOnUI,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const SHOW_DURATION = 180;
const HIDE_DURATION = 140;
const TOP_OFFSET = 100;
const TOAST_MIN_HEIGHT = 44;
const ICON_SIZE = 16;

const TOAST_KIND = {
  default: 0,
  loading: 1,
  success: 2,
  error: 3,
  info: 4,
} as const;

const TOAST_POSITION = {
  top: 0,
  center: 1,
} as const;

export type RNRToastKind = keyof typeof TOAST_KIND;
export type RNRToastPosition = keyof typeof TOAST_POSITION;

export type RNRToastPayload = {
  message: string;
  kind?: RNRToastKind;
  position?: RNRToastPosition;
  duration?: number;
};

export type RNRToastHandle = {
  id: number;
  hide: () => void;
  update: (
    message: string,
    patch?: Omit<Partial<RNRToastPayload>, 'message'>,
  ) => void;
};

const toastProgressSV = makeMutable(0);
const toastKindSV = makeMutable<(typeof TOAST_KIND)[RNRToastKind]>(
  TOAST_KIND.default,
);
const toastPositionSV = makeMutable<(typeof TOAST_POSITION)[RNRToastPosition]>(
  TOAST_POSITION.top,
);
const toastMessageSV = makeMutable(' ');
const toastDurationSV = makeMutable(0);
const toastCurrentIdSV = makeMutable(0);

let toastHandleSeed = 0;

const normalizePayload = (payload: RNRToastPayload) => {
  'worklet';

  return {
    duration: payload.duration ?? 0,
    kind: payload.kind ?? 'default',
    message: payload.message || ' ',
    position: payload.position ?? 'top',
  };
};

const kindFromValue = (
  value: (typeof TOAST_KIND)[RNRToastKind],
): RNRToastKind => {
  'worklet';

  switch (value) {
    case TOAST_KIND.loading:
      return 'loading';
    case TOAST_KIND.success:
      return 'success';
    case TOAST_KIND.error:
      return 'error';
    case TOAST_KIND.info:
      return 'info';
    default:
      return 'default';
  }
};

const positionFromValue = (
  value: (typeof TOAST_POSITION)[RNRToastPosition],
): RNRToastPosition => {
  'worklet';

  switch (value) {
    case TOAST_POSITION.center:
      return 'center';
    default:
      return 'top';
  }
};

const animateToastProgress = (
  duration: number,
  onShown?: (() => void) | undefined,
  onHidden?: (() => void) | undefined,
) => {
  'worklet';

  cancelAnimation(toastProgressSV);
  toastProgressSV.value = 0;
  toastProgressSV.value = withSequence(
    withTiming(
      1,
      {
        duration: SHOW_DURATION,
        easing: Easing.out(Easing.cubic),
      },
      finished => {
        if (finished && onShown) {
          runOnJS(onShown)();
        }
      },
    ),
    ...(duration > 0
      ? [
          withDelay(
            duration,
            withTiming(
              0,
              {
                duration: HIDE_DURATION,
                easing: Easing.in(Easing.cubic),
              },
              finished => {
                if (finished && onHidden) {
                  runOnJS(onHidden)();
                }
              },
            ),
          ),
        ]
      : []),
  );
};

const applyPayloadOnUI = (
  id: number,
  payload: RNRToastPayload,
  onShown?: (() => void) | undefined,
  onHidden?: (() => void) | undefined,
) => {
  'worklet';

  const normalized = normalizePayload(payload);

  toastCurrentIdSV.value = id;
  toastMessageSV.value = normalized.message;
  toastKindSV.value = TOAST_KIND[normalized.kind];
  toastPositionSV.value = TOAST_POSITION[normalized.position];
  toastDurationSV.value = normalized.duration;

  animateToastProgress(normalized.duration, onShown, onHidden);
};

const hidePayloadOnUI = (id?: number, onHidden?: (() => void) | undefined) => {
  'worklet';

  if (typeof id === 'number' && toastCurrentIdSV.value !== id) {
    return;
  }

  cancelAnimation(toastProgressSV);
  toastDurationSV.value = 0;
  toastProgressSV.value = withTiming(
    0,
    {
      duration: HIDE_DURATION,
      easing: Easing.in(Easing.cubic),
    },
    finished => {
      if (finished && onHidden) {
        runOnJS(onHidden)();
      }
    },
  );
};

export function showRNRToastOnUI(id: number, payload: RNRToastPayload) {
  'worklet';
  applyPayloadOnUI(id, payload);
}

export function updateRNRToastOnUI(
  id: number,
  patch: Partial<RNRToastPayload> & Pick<RNRToastPayload, 'message'>,
) {
  'worklet';

  if (toastCurrentIdSV.value !== id) {
    return;
  }

  applyPayloadOnUI(id, {
    duration:
      patch.duration === undefined ? toastDurationSV.value : patch.duration,
    kind:
      patch.kind === undefined ? kindFromValue(toastKindSV.value) : patch.kind,
    message: patch.message,
    position:
      patch.position === undefined
        ? positionFromValue(toastPositionSV.value)
        : patch.position,
  });
}

export function hideRNRToastOnUI(id?: number) {
  'worklet';
  hidePayloadOnUI(id);
}

function showToastWithJSCallbacks(
  payload: RNRToastPayload,
  callbacks?: {
    onHidden?: () => void;
    onShown?: () => void;
  },
) {
  const id = ++toastHandleSeed;

  runOnUI(applyPayloadOnUI)(
    id,
    payload,
    callbacks?.onShown,
    callbacks?.onHidden,
  );

  return {
    id,
    hide: (onHidden?: () => void) => {
      runOnUI(hidePayloadOnUI)(id, onHidden);
    },
    update: (
      message: string,
      patch?: Omit<Partial<RNRToastPayload>, 'message'>,
      nextCallbacks?: {
        onHidden?: () => void;
        onShown?: () => void;
      },
    ) => {
      runOnUI(applyPayloadOnUI)(
        id,
        {
          message,
          ...patch,
        },
        nextCallbacks?.onShown,
        nextCallbacks?.onHidden,
      );
    },
  };
}

const show = (
  message: string,
  payload?: Omit<Partial<RNRToastPayload>, 'message'> & {
    onHidden?: () => void;
    onShown?: () => void;
  },
): RNRToastHandle => {
  const handle = showToastWithJSCallbacks(
    {
      message,
      ...payload,
    },
    payload,
  );

  return {
    id: handle.id,
    hide: () => handle.hide(),
    update: (nextMessage, patch) => {
      handle.update(nextMessage, patch);
    },
  };
};

export const rnrToast = {
  show,
  loading(
    message: string,
    payload?: Omit<
      Partial<RNRToastPayload>,
      'message' | 'kind' | 'duration'
    > & {
      onHidden?: () => void;
      onShown?: () => void;
    },
  ) {
    return show(message, {
      duration: 0,
      kind: 'loading',
      position: 'top',
      ...payload,
    });
  },
  success(
    message: string,
    payload?: Omit<Partial<RNRToastPayload>, 'message' | 'kind'> & {
      onHidden?: () => void;
      onShown?: () => void;
    },
  ) {
    return show(message, {
      duration: 2000,
      kind: 'success',
      position: 'top',
      ...payload,
    });
  },
  error(
    message: string,
    payload?: Omit<Partial<RNRToastPayload>, 'message' | 'kind'> & {
      onHidden?: () => void;
      onShown?: () => void;
    },
  ) {
    return show(message, {
      duration: 2400,
      kind: 'error',
      position: 'top',
      ...payload,
    });
  },
  info(
    message: string,
    payload?: Omit<Partial<RNRToastPayload>, 'message' | 'kind'> & {
      onHidden?: () => void;
      onShown?: () => void;
    },
  ) {
    return show(message, {
      duration: 2000,
      kind: 'info',
      position: 'top',
      ...payload,
    });
  },
  hide(id?: number) {
    runOnUI(hidePayloadOnUI)(id);
  },
};

const ToastSpinner = () => {
  const rotation = useSharedValue(0);
  const style = useAnimatedStyle(() => {
    return {
      transform: [
        {
          rotate: `${rotation.value}deg`,
        },
      ],
    };
  }, [rotation]);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 920,
        easing: Easing.linear,
      }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(rotation);
    };
  }, [rotation]);

  return <Animated.View style={[styles.spinner, style]} />;
};

const LeadingIcon = ({
  kind,
  children,
}: {
  kind: (typeof TOAST_KIND)[RNRToastKind];
  children: React.ReactNode;
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    const isActive = toastKindSV.value === kind;

    return {
      opacity: isActive ? 1 : 0,
      transform: [
        {
          scale: isActive ? 1 : 0.84,
        },
      ],
    };
  }, []);

  return (
    <Animated.View style={[styles.leadingIcon, animatedStyle]}>
      {children}
    </Animated.View>
  );
};

export const RNRToastHost = () => {
  const { colors2024, styles: themedStyles } = useTheme2024({
    getStyle: getStyles,
  });
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const animatedProps = useAnimatedProps(() => {
    return {
      text: toastMessageSV.value,
    };
  });

  const wrapperStyle = useAnimatedStyle(() => {
    const progress = toastProgressSV.value;
    const isCenter = toastPositionSV.value === TOAST_POSITION.center;

    return {
      opacity: progress,
      top: isCenter
        ? windowHeight * 0.5 - TOAST_MIN_HEIGHT * 0.5
        : insets.top + TOP_OFFSET,
      transform: [
        {
          translateY: isCenter ? (1 - progress) * 12 : (1 - progress) * -12,
        },
        {
          scale: 0.96 + progress * 0.04,
        },
      ],
    };
  }, [insets.top, windowHeight]);

  const leadingSlotStyle = useAnimatedStyle(() => {
    const hasLeading = toastKindSV.value !== TOAST_KIND.default;

    return {
      marginRight: hasLeading ? 6 : 0,
      opacity: hasLeading ? 1 : 0,
      width: hasLeading ? ICON_SIZE : 0,
    };
  }, []);

  return (
    <View pointerEvents="box-none" style={styles.host}>
      <Animated.View
        pointerEvents="none"
        style={[
          themedStyles.wrapper,
          {
            backgroundColor: ThemeColors2024.light['neutral-black'],
          },
          wrapperStyle,
        ]}>
        <Animated.View style={[themedStyles.leadingSlot, leadingSlotStyle]}>
          <LeadingIcon kind={TOAST_KIND.loading}>
            <ToastSpinner />
          </LeadingIcon>
          <LeadingIcon kind={TOAST_KIND.success}>
            <IconTick width={ICON_SIZE} height={ICON_SIZE} />
          </LeadingIcon>
          <LeadingIcon kind={TOAST_KIND.error}>
            <IconError width={ICON_SIZE} height={ICON_SIZE} />
          </LeadingIcon>
          <LeadingIcon kind={TOAST_KIND.info}>
            <RcIconInfoCC
              width={ICON_SIZE}
              height={ICON_SIZE}
              color={colors2024['neutral-info']}
            />
          </LeadingIcon>
        </Animated.View>
        <AnimateableText
          animatedProps={animatedProps}
          style={[themedStyles.text, styles.flexShrink]}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  flexShrink: {
    flexShrink: 1,
  },
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  leadingIcon: {
    alignItems: 'center',
    height: ICON_SIZE,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    top: 0,
    width: ICON_SIZE,
  },
  spinner: {
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderLeftColor: ThemeColors2024.light['neutral-InvertHighlight'],
    borderRadius: 999,
    borderTopColor: ThemeColors2024.light['neutral-InvertHighlight'],
    borderWidth: 2,
    height: ICON_SIZE,
    width: ICON_SIZE,
  },
});

const getStyles = createGetStyles2024(() => {
  return {
    leadingSlot: {
      height: ICON_SIZE,
      position: 'relative',
    },
    text: {
      color: ThemeColors2024.light['neutral-InvertHighlight'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 15,
      fontWeight: '700',
      maxWidth: 250,
    },
    wrapper: {
      alignItems: 'center',
      alignSelf: 'center',
      borderRadius: 12,
      flexDirection: 'row',
      justifyContent: 'center',
      maxWidth: '84%',
      minHeight: TOAST_MIN_HEIGHT,
      paddingHorizontal: 12,
      paddingVertical: IS_IOS ? 10 : 8,
      position: 'absolute',
    },
  };
});
