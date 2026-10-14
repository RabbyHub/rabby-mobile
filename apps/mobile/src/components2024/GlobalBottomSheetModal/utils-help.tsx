import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { AppColors2024Variants } from '@/constant/theme';
import type { BottomSheetModalProps } from '@gorhom/bottom-sheet';
import React from 'react';
import { StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
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
      case MODAL_NAMES.SELECT_CHAIN_WITH_SUMMARY:
      case MODAL_NAMES.IMPORT_MORE_ADDRESS: {
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

  return createParams?.name === MODAL_NAMES.REMOVE_TOKEN_CONFIRM
    ? { ...baseProps, ...getRemoveTokenConfirmModalProps(colors) }
    : baseProps;
}

function getRemoveTokenConfirmModalProps(
  colors2024: AppColors2024Variants,
): Pick<
  BottomSheetModalProps,
  'handleStyle' | 'handleIndicatorStyle' | 'backgroundComponent'
> {
  return {
    handleStyle: {
      height: 36,
      paddingTop: 18,
      backgroundColor: 'transparent',
    },
    handleIndicatorStyle: {
      width: 50,
      height: 6,
      backgroundColor: colors2024['neutral-sheet-handle'],
    },
    backgroundComponent: props => (
      <LinearGradient
        style={props.style}
        colors={[colors2024['neutral-bg-1'], colors2024['neutral-bg-3']]}
        locations={[0.07453, 0.22418]}
      />
    ),
  };
}
