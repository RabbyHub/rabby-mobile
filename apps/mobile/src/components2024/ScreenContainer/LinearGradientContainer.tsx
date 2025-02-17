import { makeTxPageBackgroundColors } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import React from 'react';
import LinearGradient, {
  LinearGradientProps,
} from 'react-native-linear-gradient';

export type LinearGradientContainerProps = {
  type?: 'linear' | 'bg1' | 'bg2' | 'classical:bg2' | 'linear-bg2' | 'tx-page';
} & Omit<LinearGradientProps, 'colors'>;

function makeTxPageColors({
  isLight,
  colors2024,
}: Parameters<typeof makeTxPageBackgroundColors>[0]) {
  const bg = makeTxPageBackgroundColors({ isLight, colors2024 });

  return [bg, bg];
}

export const LinearGradientContainer: React.FC<
  LinearGradientContainerProps
> = ({ type, ...props }) => {
  const { colors, isLight, colors2024 } = useTheme2024();

  return (
    <LinearGradient
      colors={
        type === 'linear'
          ? [colors2024['neutral-bg-1'], colors2024['neutral-bg-3']]
          : type === 'bg1'
          ? [colors2024['neutral-bg-1'], colors2024['neutral-bg-1']]
          : type === 'linear-bg2'
          ? [colors2024['neutral-bg-1'], colors2024['neutral-bg-2']]
          : type === 'classical:bg2'
          ? [colors['neutral-bg-2'], colors['neutral-bg-2']]
          : type === 'tx-page'
          ? makeTxPageColors({ isLight, colors2024 })
          : // bg2
            [colors2024['neutral-bg-2'], colors2024['neutral-bg-2']]
      }
      {...props}
    />
  );
};
