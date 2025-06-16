import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { ButtonProps, Button } from '../Button';

export type FootButtonProps = React.PropsWithChildren<
  ButtonProps & {
    width?: number;
    footerStyle?: StyleProp<ViewStyle>;
  }
>;

const getStyles = createGetStyles(colors => ({
  footer: {
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    paddingBottom: 35,
  },

  disabledTitle: {
    color: colors['neutral-title-2'],
  },
  buttonShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
    // box-shadow: 0px 4px 16px 0px rgba(112, 132, 255, 0.30);
    shadowColor: colors['blue-default'],
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 4,
  },
}));

export const FooterButton: React.FC<FootButtonProps> = props => {
  const { width, footerStyle } = props;
  const { styles } = useThemeStyles(getStyles);

  return (
    <View
      style={[
        styles.footer,
        footerStyle,
        width
          ? // eslint-disable-next-line react-native/no-inline-styles
            {
              alignItems: 'center',
            }
          : {},
      ]}>
      <View>
        {!props.disabled && <View style={[styles.buttonShadow]} />}
        <Button buttonStyle={[{ width }]} {...props} />
      </View>
      {props.children}
    </View>
  );
};
