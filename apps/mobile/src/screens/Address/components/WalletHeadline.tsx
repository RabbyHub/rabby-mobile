import { Text } from '@/components';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgProps } from 'react-native-svg';

const styles = StyleSheet.create({
  headline: {
    color: 'white',
    fontSize: 13,
    fontStyle: 'normal',
    fontWeight: '500',
  },
  icon: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  view: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
});

export const WalletHeadline: React.FC<{
  children: string;
  Icon?: React.FC<SvgProps>;
}> = ({ children, Icon }) => {
  const colors = useThemeColors();

  return (
    <View style={styles.view}>
      {Icon ? (
        <Icon
          width={20}
          height={20}
          style={styles.icon}
          color={colors['neutral-body']}
        />
      ) : null}
      <Text
        style={[
          styles.headline,
          {
            color: colors['neutral-body'],
          },
        ]}>
        {children}
      </Text>
    </View>
  );
};
