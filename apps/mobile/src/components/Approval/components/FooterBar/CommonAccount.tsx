import React from 'react';
import clsx from 'clsx';
import { SvgProps } from 'react-native-svg';
import { Signal } from '@/components/Signal';
import { Text, View } from 'react-native';

export interface Props {
  icon: React.FC<SvgProps>;
  signal?: 'CONNECTED' | 'DISCONNECTED';
  customSignal?: React.ReactNode;
  tip?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}

export const CommonAccount: React.FC<Props> = ({
  icon,
  tip,
  signal,
  customSignal,
  children,
  footer,
}) => {
  const bgColor = React.useMemo(() => {
    switch (signal) {
      case 'DISCONNECTED':
        return 'gray';

      default:
      case 'CONNECTED':
        return 'green';
    }
  }, [signal]);

  const Icon = icon;

  return (
    <View>
      <View className={clsx('space-x-6 flex items-start flex-row', 'relative')}>
        <View className="relative">
          <Icon className="w-[20px] h-[20px]" />
          <View>{customSignal}</View>
          {signal && <Signal isBadge color={bgColor} />}
        </View>
        <Text className="text-13 w-full text-r-neutral-foot">{tip}</Text>
        {children}
      </View>
      {footer}
    </View>
  );
};
