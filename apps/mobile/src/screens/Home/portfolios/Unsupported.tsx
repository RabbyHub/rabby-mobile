import React from 'react';
import { StyleSheet, Text, ViewStyle } from 'react-native';

import { Card } from '@/components';

import { PortfolioHeader } from '../components/PortfolioDetail';
import { IProtocolPortfolio } from '@/store/protocols';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';

export default React.memo(
  ({
    name,
    data,
    style,
  }: {
    name: string;
    data: IProtocolPortfolio;
    style?: ViewStyle;
  }) => {
    const colors = useThemeColors();
    const styles = getStyle(colors);

    return (
      <Card style={style}>
        <PortfolioHeader data={data} name={name} showDescription />
        <Text style={styles.unsupported}>Unsupported pool type</Text>
      </Card>
    );
  },
);

const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    unsupported: {
      marginTop: 10,
      fontSize: 12,
      fontWeight: '500',
      color: colors['neutral-line'],
      textAlign: 'center',
    },
  });
