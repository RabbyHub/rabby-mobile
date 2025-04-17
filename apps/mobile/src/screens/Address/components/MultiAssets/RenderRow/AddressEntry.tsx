import { KeyringAccountWithAlias } from '@/hooks/account';
import { AddressItemEntry } from '../../AddressItem';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

export const AddressEntry = ({
  data,
}: {
  data: KeyringAccountWithAlias & {
    changPercent?: string;
    isLoss?: boolean;
  };
}) => {
  const { styles } = useTheme2024({ getStyle });

  return (
    // <View style={styles.root}>
    <AddressItemEntry
      style={styles.root}
      account={data}
      changePercent={data.changPercent}
      disableMenu
      isLoss={data.isLoss}
    />
    // </View>
  );
};
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    height: 78,
  },
}));
