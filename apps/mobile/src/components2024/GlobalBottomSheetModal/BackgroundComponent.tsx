import { BottomSheetBackgroundProps } from '@gorhom/bottom-sheet';
import React from 'react';
import {
  LinearGradientContainer,
  LinearGradientContainerProps,
} from '../ScreenContainer/LinearGradientContainer';

export const BackgroundComponent: React.FC<
  BottomSheetBackgroundProps & { type?: LinearGradientContainerProps['type'] }
> = props => {
  return (
    <LinearGradientContainer
      {...props}
      type={props.type ?? 'linear'}
      accessible={true}
      accessibilityRole="adjustable"
      accessibilityLabel="Bottom Sheet"
      inBottomSheet
    />
  );
};
