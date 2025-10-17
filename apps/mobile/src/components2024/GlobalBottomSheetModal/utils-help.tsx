import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { AppColors2024Variants } from '@/constant/theme';
import React from 'react';
import { StyleSheet } from 'react-native';
import { BackgroundComponent } from './BackgroundComponent';
import { CreateParams, MODAL_NAMES } from './types';

export function makeBottomSheetProps({
  colors,
  createParams,
  linearGradientType: _linearGradientType,
}: {
  createParams?: Partial<CreateParams>;
  linearGradientType?: (CreateParams['bottomSheetModalProps'] &
    object)['linearGradientType'];
  colors: AppColors2024Variants;
}): Partial<React.ComponentProps<typeof AppBottomSheetModal>> {
  const inputProps = createParams?.bottomSheetModalProps;
  const linearGradientType =
    _linearGradientType ??
    createParams?.bottomSheetModalProps?.linearGradientType;

  const { handleBgColor } = (() => {
    switch (createParams?.name) {
      case MODAL_NAMES.SELECT_CHAIN_WITH_SUMMARY: {
        return {
          // neutral-bg-0 only for light theme
          handleBgColor: colors['neutral-bg-0'] || colors['neutral-bg-1'],
        };
      }
      default: {
        return {
          handleBgColor:
            linearGradientType === 'linear' || !linearGradientType
              ? colors['neutral-bg-1']
              : linearGradientType === 'bg1'
              ? colors['neutral-bg-1']
              : linearGradientType === 'bg0'
              ? colors['neutral-bg-0']
              : colors['neutral-bg-2'],
        };
      }
    }
  })();

  const baseProps: Partial<React.ComponentProps<typeof AppBottomSheetModal>> = {
    style: StyleSheet.flatten([
      {
        overflow: 'hidden',
        borderRadius: 32,
      },
      inputProps?.style,
    ]),
    handleStyle: StyleSheet.flatten([
      {
        backgroundColor: handleBgColor,
        paddingTop: 10,
        height: 36,
      },
      inputProps?.handleStyle,
    ]),
    handleIndicatorStyle: StyleSheet.flatten([
      {
        backgroundColor: colors['neutral-line'],
        height: 6,
        width: 50,
      },
      inputProps?.handleIndicatorStyle,
    ]),
    ...(inputProps?.backdropComponent === undefined && {
      backgroundComponent: props => (
        <BackgroundComponent {...props} type={linearGradientType} />
      ),
    }),
  };

  return baseProps;
}
