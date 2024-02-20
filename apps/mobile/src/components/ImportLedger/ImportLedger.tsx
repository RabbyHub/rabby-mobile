import { RootNames } from '@/constant/layout';
import { AppColorsVariants } from '@/constant/theme';
import { apiLedger } from '@/core/apis';
import { useThemeColors } from '@/hooks/theme';
import { navigate } from '@/utils/navigation';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppBottomSheetModalTitle } from '../customized/BottomSheet';
import { Text } from '../Text';
import { toast } from '../Toast';

const STEP_COUNT = 5;

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    root: {
      height: '100%',
      position: 'relative',
    },
    main: {
      flex: 1,
    },
    item: {
      padding: 15,
      backgroundColor: colors['neutral-card-2'],
      borderRadius: 8,
    },
    itemText: {
      fontSize: 12,
    },
  });

export const ImportLedger: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [startNo, setStartNo] = React.useState(0);
  const [accounts, setAccounts] = React.useState<
    {
      address: string;
      index: number;
    }[]
  >([]);
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [loading, setLoading] = React.useState(false);

  const handleLoadAddress = React.useCallback(async () => {
    setLoading(true);
    const res = await apiLedger.getAddresses(startNo, startNo + STEP_COUNT);

    setAccounts(
      res.map(addr => ({
        address: addr.address,
        index: addr.index,
      })),
    );
    setLoading(false);
  }, [startNo]);

  const handleSelectIndex = async (address, index) => {
    try {
      await apiLedger.importAddress(index - 1);
      onDone();
      navigate(RootNames.StackAddress, {
        screen: RootNames.ImportSuccess,
        params: {
          address: address,
          brandName: KEYRING_CLASS.HARDWARE.LEDGER,
        },
      });
    } catch (err: any) {
      console.error(err);
      toast.show(err.message);
    }
  };

  React.useEffect(() => {
    handleLoadAddress();
  }, [handleLoadAddress]);

  return (
    <BottomSheetView style={styles.root}>
      <AppBottomSheetModalTitle title="Import Ledger" />
      <View style={styles.main}>
        {accounts.map(({ address, index }) => (
          <TouchableOpacity
            onPress={() => handleSelectIndex(address, index)}
            style={styles.item}
            key={address}>
            <Text style={styles.itemText}>{address}</Text>
          </TouchableOpacity>
        ))}
        <Text>{loading ? 'Loading...' : ''}</Text>
      </View>
    </BottomSheetView>
  );
};
