import { useCallback, useMemo } from 'react';
import { View, TextInput, TextInputProps, StyleSheet } from 'react-native';

import { RcSearchCC, RcIconCloseCC } from '@/assets/icons/common';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import TouchableView from '../Touchable/TouchableView';

const getInputStyles = createGetStyles(colors => {
  return {
    inputContainer: {
      borderRadius: 4,
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: colors['neutral-line'],
      overflow: 'hidden',
      position: 'relative',

      flexDirection: 'row',
      alignItems: 'center',
      paddingRight: 8,
    },
    activeInputContainer: {
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: colors['blue-default'],
      backgroundColor: colors['blue-light1'],
    },
    searchIconWrapper: {
      // position: 'absolute',
      paddingLeft: 16,
      paddingRight: 8,
    },
    searchIcon: {
      width: 20,
      height: 20,
    },
    closeIconWrapper: {
      paddingLeft: 16,
      paddingRight: 8,
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      // ...makeDebugBorder('red'),
    },
    closeIcon: {
      width: 20,
      height: 20,
    },
    input: {
      fontSize: 15,
      paddingVertical: 12,
      flexShrink: 1,
      width: '100%',
      color: colors['neutral-title1'],

      // // leave here for debug
      // borderColor: 'blue',
      // borderWidth: 1,
    },
  };
});

export function SearchInput({
  containerStyle,
  isActive,
  inputStyle,
  inputProps,
  searchIconStyle,
  searchIcon: _searchIcon,
  searchIconWrapperStyle,
  clearable,
  ...viewProps
}: React.PropsWithoutRef<
  RNViewProps & {
    isActive?: boolean;
    containerStyle?: React.ComponentProps<typeof View>['style'];
    inputStyle?: React.ComponentProps<typeof TextInput>['style'];
    searchIconStyle?: React.ComponentProps<typeof View>['style'];
    searchIconWrapperStyle?: React.ComponentProps<typeof View>['style'];
    inputProps?: TextInputProps;
    searchIcon?: React.ReactNode;
    clearable?: boolean;
  }
>) {
  const colors = useThemeColors();
  const styles = getInputStyles(colors);

  const searchIcon = useMemo(() => {
    if (_searchIcon === undefined) {
      return (
        <RcSearchCC
          style={[styles.searchIcon, searchIconStyle]}
          color={colors['neutral-foot']}
        />
      );
    }

    return _searchIcon || null;
  }, [_searchIcon, styles.searchIcon, searchIconStyle, colors]);

  const closeIcon = useMemo(() => {
    return (
      <RcIconCloseCC style={styles.closeIcon} color={colors['neutral-foot']} />
    );
  }, [styles.closeIcon, colors]);

  const onPressClose = useCallback(() => {
    if (clearable) {
      inputProps?.onChangeText?.('');
    }
  }, [clearable, inputProps]);

  return (
    <View
      {...viewProps}
      style={[
        styles.inputContainer,
        containerStyle,
        viewProps?.style,
        isActive && styles.activeInputContainer,
      ]}>
      <View
        style={StyleSheet.flatten([
          styles.searchIconWrapper,
          searchIconWrapperStyle,
        ])}>
        {searchIcon}
      </View>
      <TextInput {...inputProps} style={[styles.input, inputStyle]} />
      {inputProps?.value && clearable && (
        <TouchableView
          disabled={!clearable}
          style={styles.closeIconWrapper}
          onPress={onPressClose}>
          {closeIcon}
        </TouchableView>
      )}
    </View>
  );
}
