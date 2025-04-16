import { KeyringAccountWithAlias } from '@/hooks/account';
import { AddressItemEntry } from '../../AddressItem';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { View } from 'react-native';

export const AddressEntry = ({ data }: { data: KeyringAccountWithAlias }) => {
  const { styles } = useTheme2024({ getStyle });

  return (
    // <View style={styles.root}>
    <AddressItemEntry style={styles.root} account={data} />
    // </View>
  );
};
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    height: 78,
  },
}));
