import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  TouchableOpacity,
  View,
  ViewProps as RNViewProps,
} from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { Text } from '@/components/Typography';
import { CustomSkeleton } from '@/components2024/CustomSkeleton';
import RcIconBluePolygon from '@/assets2024/icons/bridge/IconBluePolygon.svg';

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
  const lastHandledAutoOpenSignalRef = useRef(0);
  const [visible, setVisible] = useState(false);
  const [layout, setLayout] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  const setModalVisible = useCallback(
    (next: boolean) => {
      setVisible(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const measureTrigger = useCallback((afterMeasure?: () => void) => {
    if (!triggerRef.current) {
      afterMeasure?.();
      return;
    }

    requestAnimationFrame(() => {
      triggerRef.current?.measureInWindow((x, y, width, height) => {
        setLayout({ x, y, width, height });
        afterMeasure?.();
      });
    });
  }, []);

  const openModal = useCallback(() => {
    if (!triggerRef.current) {
      setModalVisible(true);
      return;
    }

    measureTrigger(() => {
      setModalVisible(true);
    });
  }, [measureTrigger, setModalVisible]);

  useEffect(() => {
    if (
      !autoOpenSignal ||
      autoOpenSignal === lastHandledAutoOpenSignalRef.current ||
      visible
    ) {
      return;
    }

    lastHandledAutoOpenSignalRef.current = autoOpenSignal;
    openModal();
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
            onPress={() => {
              openModal();
            }}
            onLayout={() => {
              measureTrigger();
            }}>
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
        close: () => setModalVisible(false),
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
