import { apiCustomRPC } from '@/core/apis';
import { useThemeColors } from '@/hooks/theme';
import { useCustomRPC } from '@/hooks/useCustomRPC';
import { createGetStyles } from '@/utils/styles';
import { CHAINS_ENUM } from '@debank/common';
import { useRequest } from 'ahooks';
import React, { useMemo } from 'react';
import { View, ViewStyle } from 'react-native';

export interface RPCStatusBadgeProps {
  size?: number;
  children?: React.ReactNode;
  style?: ViewStyle;
  chainEnum?: CHAINS_ENUM;
  badgeStyle?: ViewStyle;
  badgeSize?: number;
}
export const RPCStatusBadge = ({
  size,
  children,
  style,
  chainEnum,
  badgeStyle,
  badgeSize,
}: RPCStatusBadgeProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { customRPCStore } = useCustomRPC();
  const hasCustomRPC = useMemo(() => {
    return chainEnum && customRPCStore[chainEnum]?.enable;
  }, [chainEnum, customRPCStore]);

  const { data: RPCStatus } = useRequest(
    async () => {
      if (!chainEnum || !hasCustomRPC) {
        return;
      }
      const isAvailable = await apiCustomRPC.pingCustomRPC(chainEnum);
      return isAvailable ? 'success' : 'error';
    },
    {
      refreshDeps: [chainEnum, hasCustomRPC],
    },
  );

  return (
    <View
      style={[
        styles.container,
        size
          ? {
              width: size,
              height: size,
            }
          : {},
        style,
      ]}>
      {children}
      {RPCStatus ? (
        <View
          style={[
            styles.badge,
            RPCStatus === 'error' ? styles.badgeError : null,
            badgeStyle,
            badgeSize ? { width: badgeSize, height: badgeSize } : null,
          ]}
        />
      ) : null}
    </View>
  );
};

const getStyles = createGetStyles(colors => {
  return {
    container: {
      position: 'relative',
    },
    badge: {
      position: 'absolute',
      top: -4,
      right: -4,
      borderRadius: 1000,
      width: 12,
      height: 12,
      backgroundColor: colors['green-default'],
      borderWidth: 1,
      borderColor: colors['neutral-title-2'],
    },
    badgeError: {
      backgroundColor: colors['red-default'],
    },
  };
});
