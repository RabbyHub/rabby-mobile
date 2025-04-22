import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

export interface IPorps {
  onSelect?: () => void;
}
const SelectCex = ({}: IPorps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View style={[styles.screen]}>
      <Text style={styles.modalTitle}>Select Exchange Source</Text>
    </View>
  );
};

export default SelectCex;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  modalTitle: {
    color: colors2024['neutral-title-1'],
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    paddingTop: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  screen: {
    paddingHorizontal: 20,
    backgroundColor: colors2024['neutral-bg-1'],
  },
}));
