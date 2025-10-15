import React from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Text, View } from 'react-native';
import { FormatReserveUSDResponse } from '@aave/math-utils';
import { ReserveDataHumanized } from '@aave/contract-helpers';

interface IProps {
  data: (FormatReserveUSDResponse & ReserveDataHumanized)[];
}
const SupplyPoolList = (props: IProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      {props.data.map((item, index) => (
        <View style={styles.item} key={index}>
          <Text>{item.symbol}</Text>
          <Text>{item.supplyAPY}</Text>
          <Text>{item.variableBorrowAPY}</Text>
        </View>
      ))}
    </View>
  );
};

export default SupplyPoolList;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    color: colors2024['red-default'],
  },
  item: {
    borderWidth: 1,
  },
}));
