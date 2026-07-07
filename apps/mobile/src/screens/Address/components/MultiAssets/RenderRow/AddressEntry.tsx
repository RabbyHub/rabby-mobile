import { KeyringAccountWithAlias } from '@/hooks/account';
import { AddressItemEntry } from '../../AddressItem';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

export const AddressEntry = ({
  data,
  onSelect,
  showMarkIfNewlyAdded,
}: {
  data: KeyringAccountWithAlias & {
    changPercent?: string;
    isLoss?: boolean;
  };
  showMarkIfNewlyAdded?: React.ComponentProps<
    typeof AddressItemEntry
  >['showMarkIfNewlyAdded'];
  onSelect?: () => void;
}) => {
  const { styles } = useTheme2024({ getStyle });

  return (
    <AddressItemEntry
      showMarkIfNewlyAdded={showMarkIfNewlyAdded}
      style={styles.root}
      account={data}
      changePercent={data.changPercent}
      onSelect={onSelect}
      isLoss={data.isLoss}
    />
  );
};
const getStyle = createGetStyles2024(() => ({
  root: {
    height: 78,
  },
}));
