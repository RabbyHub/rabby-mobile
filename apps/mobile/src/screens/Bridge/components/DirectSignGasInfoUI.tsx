import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  InteractionManager,
  TouchableOpacity,
  View,
  ViewProps as RNViewProps,
} from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { Text } from '@/components/Typography';
import { CustomSkeleton } from '@/components2024/CustomSkeleton';
import RcIconBluePolygon from '@/assets2024/icons/bridge/IconBluePolygon.svg';

type TriggerLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const EMPTY_LAYOUT: TriggerLayout = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
};

const isValidTriggerLayout = (
  layout: TriggerLayout | null | undefined,
): layout is TriggerLayout => !!layout && layout.width > 0 && layout.height > 0;

type DirectSignGasInfoUIProps = {
  label?: React.ReactNode;
  leftIcon?: React.ReactNode;
  loading: boolean;
  empty?: boolean;
  emptyText?: string;
  levelText?: string;
  valueText?: string;
  chainId?: number;
  textColor?: string;
  valueColor?: string;
  style?: RNViewProps['style'];
  listItemStyle?: RNViewProps['style'];
  listItemInnerStyle?: RNViewProps['style'];
  onOpenChange?: (open: boolean) => void;
  autoOpenSignal?: number;
  renderModal?: (args: {
    visible: boolean;
    layout: { x: number; y: number; width: number; height: number };
    close: () => void;
    chainId?: number;
  }) => React.ReactNode;
};

export const DirectSignGasInfoUI = ({
  label = 'Gas Fee',
  leftIcon,
  loading,
  empty,
  emptyText = '-',
  levelText,
  valueText,
  chainId,
  textColor,
  valueColor,
  style,
  listItemStyle,
  listItemInnerStyle,
  onOpenChange,
  autoOpenSignal = 0,
  renderModal,
}: DirectSignGasInfoUIProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const triggerRef = useRef<View>(null);
  const lastValidLayoutRef = useRef<TriggerLayout>(EMPTY_LAYOUT);
  const lastHandledAutoOpenSignalRef = useRef(0);
  const [visible, setVisible] = useState(false);
  const [layout, setLayout] = useState<TriggerLayout>(EMPTY_LAYOUT);

  const updateLayout = useCallback((nextLayout: TriggerLayout) => {
    lastValidLayoutRef.current = nextLayout;
    setLayout(prev => {
      if (
        prev.x === nextLayout.x &&
        prev.y === nextLayout.y &&
        prev.width === nextLayout.width &&
        prev.height === nextLayout.height
      ) {
        return prev;
      }

      return nextLayout;
    });
  }, []);

  const setModalVisible = useCallback(
    (next: boolean) => {
      setVisible(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const closeModal = useCallback(() => {
    setVisible(false);
    onOpenChange?.(false);
  }, [onOpenChange]);

  const measureTriggerOnce = useCallback(() => {
    return new Promise<TriggerLayout | null>(resolve => {
      const trigger = triggerRef.current;

      if (!trigger) {
        resolve(null);
        return;
      }

      requestAnimationFrame(() => {
        trigger.measureInWindow((x, y, width, height) => {
          const nextLayout = { x, y, width, height };

          if (isValidTriggerLayout(nextLayout)) {
            resolve(nextLayout);
            return;
          }

          resolve(null);
        });
      });
    });
  }, []);

  const getFallbackLayout = useCallback(
    () =>
      isValidTriggerLayout(lastValidLayoutRef.current)
        ? lastValidLayoutRef.current
        : null,
    [],
  );

  const measureTrigger = useCallback(async () => {
    const firstMeasuredLayout = await measureTriggerOnce();
    if (isValidTriggerLayout(firstMeasuredLayout)) {
      updateLayout(firstMeasuredLayout);
      return firstMeasuredLayout;
    }

    const retryMeasuredLayout = await measureTriggerOnce();
    if (isValidTriggerLayout(retryMeasuredLayout)) {
      updateLayout(retryMeasuredLayout);
      return retryMeasuredLayout;
    }

    return getFallbackLayout();
  }, [getFallbackLayout, measureTriggerOnce, updateLayout]);

  const openModal = useCallback(() => {
    setModalVisible(true);
  }, [setModalVisible]);

  const handleTriggerPress = useCallback(() => {
    openModal();
  }, [openModal]);

  const handleTriggerLayout = useCallback(() => {
    void measureTrigger();
  }, [measureTrigger]);

  useEffect(() => {
    if (
      !autoOpenSignal ||
      autoOpenSignal === lastHandledAutoOpenSignalRef.current ||
      visible
    ) {
      return;
    }

    lastHandledAutoOpenSignalRef.current = autoOpenSignal;
    const task = InteractionManager.runAfterInteractions(() => {
      openModal();
    });

    return () => {
      task.cancel();
    };
  }, [autoOpenSignal, openModal, visible]);

  return (
    <View style={style}>
      <ListItem
        name={<>{label}</>}
        style={listItemStyle}
        innerStyle={listItemInnerStyle}
        LeftIcon={leftIcon}>
        {!loading && !empty ? (
          <TouchableOpacity
            ref={triggerRef}
            activeOpacity={0.7}
            hitSlop={8}
            style={styles.triggerButton}
            onPress={handleTriggerPress}
            onLayout={handleTriggerLayout}>
            <View style={styles.quoteContainer}>
              <Text
                style={[
                  styles.levelTag,
                  textColor && {
                    color: textColor,
                  },
                  textColor && {
                    backgroundColor: colors2024['brand-light-1'],
                  },
                ]}>
                {levelText}
              </Text>

              <Text
                style={[
                  styles.valueText,
                  {
                    color:
                      valueColor || textColor || colors2024['brand-default'],
                  },
                ]}>
                {valueText}
              </Text>
              <Animated.View
                style={{
                  transform: [{ rotate: visible ? '-90deg' : '90deg' }],
                }}>
                <RcIconBluePolygon
                  style={styles.arrowIcon}
                  color={valueColor || textColor || colors2024['brand-default']}
                />
              </Animated.View>
            </View>
          </TouchableOpacity>
        ) : !loading && empty ? (
          <Text style={styles.noQuotePlaceholder}>{emptyText}</Text>
        ) : (
          <CustomSkeleton style={styles.skeletonPill} />
        )}
      </ListItem>
      {renderModal?.({
        visible,
        layout,
        close: closeModal,
        chainId,
      })}
    </View>
  );
};

function ListItem({
  name,
  style,
  innerStyle,
  children,
  LeftIcon,
}: {
  name: React.ReactNode;
  style?: RNViewProps['style'];
  innerStyle?: RNViewProps['style'];
  children: React.ReactNode;
  LeftIcon?: React.ReactNode;
}) {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={[styles.listItemContainer, style]}>
      <View style={[styles.listItemInner, innerStyle]}>
        <Text style={styles.listItemText}>{name}</Text>
        {LeftIcon}
      </View>
      <View style={styles.flexRow}>{children}</View>
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  listItemText: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
  },
  flexRow: { flexDirection: 'row', justifyContent: 'space-between' },
  listItemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quoteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 24,
  },
  triggerButton: {
    paddingHorizontal: 4,
    paddingVertical: 6,
    marginHorizontal: -4,
    marginVertical: -6,
    justifyContent: 'center',
  },
  noQuotePlaceholder: {
    color: colors2024['neutral-foot'],
    fontSize: 12,
  },
  skeletonPill: {
    width: 131,
    height: 24,
    borderRadius: 100,
  },
  arrowIcon: {
    transform: [{ rotate: '-90deg' }],
  },
  levelTag: {
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 16,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: colors2024['brand-light-1'],
    overflow: 'hidden',
  },
  valueText: {
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 18,
  },
}));
