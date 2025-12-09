import { KeyringAccountWithAlias } from '@/hooks/account';
import { AddressItemEntry } from '../../AddressItem';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

export const AddressEntry = ({
  data,
  onSelect,
  isManageMode,
}: {
  data: KeyringAccountWithAlias & {
    changPercent?: string;
    isLoss?: boolean;
  };
  onSelect?: () => void;
  isManageMode?: boolean;
}) => {
  const { styles } = useTheme2024({ getStyle });

  return (
    <AddressItemEntry
      style={styles.root}
      account={data}
      changePercent={data.changPercent}
      onSelect={onSelect}
      isLoss={data.isLoss}
      isManageMode={isManageMode}
    />
  );
};
const getStyle = createGetStyles2024(() => ({
  root: {
    height: 78,
  },
}));
