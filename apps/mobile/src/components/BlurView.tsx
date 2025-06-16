import { forwardRef, LegacyRef } from 'react';
import { Platform, View } from 'react-native';
import { useGetBinaryMode } from '@/hooks/theme';
import {
  BlurView as OriginBlurView,
  BlurViewProps,
} from '@react-native-community/blur';

const Component = (
  Platform.OS === 'android' ? View : OriginBlurView
) as typeof OriginBlurView;

type Props = Omit<BlurViewProps, 'blurType'> & {
  /** @description only valid for android */
  blurRadius?: number;
  blurType?: BlurViewProps['blurType'];
};
/**
 * @description A wrapper for the BlurView component that sets the blurType based on the current theme.
 *
 * Blur Effect is only supported on IOS.
 */
export const BlurView = forwardRef<typeof OriginBlurView, Props>(
  (props, ref) => {
    const { blurAmount = 80, blurRadius = 30, ...otherProps } = props;
    const theme = useGetBinaryMode();
    return (
      <Component
        {...otherProps}
        blurAmount={blurAmount}
        blurRadius={blurRadius}
        ref={ref as any}
        blurType={theme ?? undefined}
      />
    );
  },
);
