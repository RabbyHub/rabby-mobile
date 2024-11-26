import { useTheme2024 } from '@/hooks/theme';
import React from 'react';
import LinearGradient, {
  LinearGradientProps,
} from 'react-native-linear-gradient';

export type LinearGradientContainerProps = {
  type: 'linear' | 'bg1' | 'bg2';
} & Omit<LinearGradientProps, 'colors'>;

export const LinearGradientContainer: React.FC<
  LinearGradientContainerProps
> = ({ type, ...props }) => {
  const { colors2024 } = useTheme2024();

  return (
    <LinearGradient
      {...props}
      colors={
        type === 'linear'
          ? [colors2024['neutral-bg-1'], colors2024['neutral-bg-3']]
          : type === 'bg1'
          ? [colors2024['neutral-bg-1'], colors2024['neutral-bg-1']]
          : [colors2024['neutral-bg-2'], colors2024['neutral-bg-2']]
      }
    />
  );
};
