import { useMemo } from 'react';
import { View, TextInput, TextInputProps } from 'react-native';

import { RcSearchCC } from '@/assets/icons/common';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';

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
    searchIcon: {},
    input: {
      fontSize: 15,
      paddingVertical: 12,
      flexShrink: 1,
      width: '100%',

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
  searchIcon: _searchIcon,
  ...viewProps
}: React.PropsWithoutRef<
  RNViewProps & {
    isActive?: boolean;
    containerStyle?: React.ComponentProps<typeof View>['style'];
    inputStyle?: React.ComponentProps<typeof TextInput>['style'];
    inputProps?: TextInputProps;
    searchIcon?: React.ReactNode;
  }
>) {
  const colors = useThemeColors();
  const styles = getInputStyles(colors);

  const searchIcon = useMemo(() => {
    if (_searchIcon === undefined) {
      return (
        <RcSearchCC style={styles.searchIcon} color={colors['neutral-foot']} />
      );
    }

    return searchIcon || null;
  }, [_searchIcon, styles.searchIcon, colors]);

  return (
    <View
      {...viewProps}
      style={[
        styles.inputContainer,
        containerStyle,
        viewProps?.style,
        isActive && styles.activeInputContainer,
      ]}>
      <View style={styles.searchIconWrapper}>{searchIcon}</View>
      <TextInput {...inputProps} style={[styles.input, inputStyle]} />
    </View>
  );
}
