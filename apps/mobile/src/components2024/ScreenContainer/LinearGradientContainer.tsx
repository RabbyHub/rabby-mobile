import { makeTxPageBackgroundColors } from '@/constant/layout';
import { getTheme2024, useTheme2024 } from '@/hooks/theme';
import { useBottomSheetOpenEnd } from '@/hooks/useBottomSheetOpenEnd';
import React from 'react';
import { View } from 'react-native';
import LinearGradient, {
  LinearGradientProps,
} from 'react-native-linear-gradient';

export type LinearGradientContainerProps = {
  type?:
    | 'linear'
    | 'bg0'
    | 'bg1'
    | 'bg2'
    | 'classical:bg2'
    | 'linear-bg2'
    | 'tx-page';
  inBottomSheet?: boolean;
} & Omit<LinearGradientProps, 'colors'>;

function makeTxPageColors({
  isLight,
  colors2024,
}: Parameters<typeof makeTxPageBackgroundColors>[0]) {
  const bg = makeTxPageBackgroundColors({ isLight, colors2024 });

  return bg;
}

export function resolveBgColorByType(
  type: NonNullable<LinearGradientContainerProps['type']>,
  theme: Pick<
    ReturnType<typeof useTheme2024>,
    'isLight' | 'colors' | 'colors2024'
  > = getTheme2024(),
) {
  const { isLight, colors, colors2024 } = theme;
  switch (type) {
    case 'bg1':
      return colors2024['neutral-bg-1'];
    case 'bg2':
      return colors2024['neutral-bg-2'];
    case 'classical:bg2':
      return colors['neutral-bg-2'];
    case 'linear-bg2':
      return colors2024['neutral-bg-1'];
    case 'tx-page':
      return makeTxPageColors({ isLight, colors2024 });
    case 'bg0':
      return colors2024['neutral-bg-0'];
    default:
      return colors2024['neutral-bg-2'];
  }
}

export const LinearGradientContainer: React.FC<
  LinearGradientContainerProps
> = ({ type, inBottomSheet, ...props }) => {
  const theme2024 = useTheme2024();
  const { colors2024 } = theme2024;
  const [showLinearGradient, setShowLinearGradient] =
    React.useState<boolean>(false);

  useBottomSheetOpenEnd(() => {
    setShowLinearGradient(true);
  });

  if (type === 'linear') {
    if (inBottomSheet) {
      return (
        <View {...props}>
          {showLinearGradient ? (
            <LinearGradient
              colors={[colors2024['neutral-bg-1'], colors2024['neutral-bg-3']]}
              // eslint-disable-next-line react-native/no-inline-styles
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            />
          ) : null}
          {props.children}
        </View>
      );
    }
    return (
      <LinearGradient
        colors={[colors2024['neutral-bg-1'], colors2024['neutral-bg-3']]}
        {...props}
      />
    );
  }

  return (
    <View
      {...props}
      style={[
        props.style,
        {
          backgroundColor: resolveBgColorByType(type!, theme2024),
        },
      ]}
    />
  );
};
