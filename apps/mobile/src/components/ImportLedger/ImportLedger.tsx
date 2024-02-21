import { RootNames } from '@/constant/layout';
import { AppColorsVariants } from '@/constant/theme';
import { apiLedger } from '@/core/apis';
import { useThemeColors } from '@/hooks/theme';
import { navigate } from '@/utils/navigation';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { ButtonGroup } from '@rneui/themed';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppBottomSheetModalTitle } from '../customized/BottomSheet';
import { Text } from '../Text';
import { toast } from '../Toast';

const STEP_COUNT = 5;

export const LedgerHDPathTypeLabel = {
  [LedgerHDPathType.LedgerLive]: 'Ledger Live',
  [LedgerHDPathType.BIP44]: 'BIP44',
  [LedgerHDPathType.Legacy]: 'Ledger Legacy',
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    root: {
      height: '100%',
      position: 'relative',
    },
    main: {
      flex: 1,
      alignItems: 'center',
    },
    item: {
      padding: 15,
      backgroundColor: colors['neutral-card-2'],
      borderRadius: 8,
    },
    itemText: {
      fontSize: 12,
    },
    list: {
      rowGap: 12,
      marginTop: 20,
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
  const [selectedHdPathTypeIndex, setSelectedHdPathTypeIndex] =
    React.useState(0);
  const [hdPathType, setHdPathType] = React.useState<LedgerHDPathType>();

  const handleLoadAddress = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiLedger.getAddresses(startNo, startNo + STEP_COUNT);
      setAccounts(
        res.map(addr => ({
          address: addr.address,
          index: addr.index,
        })),
      );
    } catch (e: any) {
      toast.show(e.message);
    }

    setLoading(false);
  }, [startNo]);

  const handleSelectIndex = React.useCallback(
    async (address, index) => {
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
    },
    [onDone],
  );

  const handleSelectHdPathType = React.useCallback(
    async (index: number) => {
      switch (index) {
        case 0:
          setHdPathType(LedgerHDPathType.BIP44);
          apiLedger.setHDPathType(LedgerHDPathType.BIP44);
          break;
        case 1:
          setHdPathType(LedgerHDPathType.LedgerLive);
          apiLedger.setHDPathType(LedgerHDPathType.LedgerLive);
          break;
        default:
          setHdPathType(LedgerHDPathType.Legacy);
          apiLedger.setHDPathType(LedgerHDPathType.Legacy);
          break;
      }
      setSelectedHdPathTypeIndex(index);
      setAccounts([]);
      handleLoadAddress();
    },
    [handleLoadAddress],
  );

  React.useEffect(() => {
    handleLoadAddress();
    apiLedger.getCurrentUsedHDPathType().then(setHdPathType);
  }, [handleLoadAddress]);

  return (
    <BottomSheetView style={styles.root}>
      <AppBottomSheetModalTitle title="Import Ledger" />
      <View style={styles.main}>
        <ButtonGroup
          buttons={[
            LedgerHDPathTypeLabel.BIP44,
            LedgerHDPathTypeLabel.LedgerLive,
            LedgerHDPathTypeLabel.Legacy,
          ]}
          selectedIndex={selectedHdPathTypeIndex}
          onPress={handleSelectHdPathType}
        />
        <View style={styles.list}>
          {accounts.map(({ address, index }) => (
            <TouchableOpacity
              onPress={() => handleSelectIndex(address, index)}
              style={styles.item}
              key={address}>
              <Text style={styles.itemText}>{address}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text>{loading ? 'Loading...' : ''}</Text>
      </View>
    </BottomSheetView>
  );
};
