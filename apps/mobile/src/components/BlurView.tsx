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
export const BlurView = forwardRef(
  (
    props: Omit<BlurViewProps, 'blurType'> & {
      blurType?: BlurViewProps['blurType'];
    },
    ref: LegacyRef<typeof OriginBlurView>,
  ) => {
    const { blurAmount = 80, blurRadius = 30, ...otherProps } = props;
    const theme = useGetBinaryMode();
    return (
      <Component
        {...otherProps}
        blurAmount={blurAmount}
        blurRadius={blurRadius}
        ref={ref}
        blurType={theme ?? undefined}
      />
    );
  },
);
