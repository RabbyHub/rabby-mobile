import { RootNames } from '@/constant/layout';
import { AppColorsVariants } from '@/constant/theme';
import { apiLedger } from '@/core/apis';
import { useThemeColors } from '@/hooks/theme';
import { navigate } from '@/utils/navigation';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { ButtonGroup } from '@rneui/themed';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { toast } from '@/components/Toast';
import RootScreenContainer from '@/components/ScreenContainer/RootScreenContainer';

type LedgerAccount = {
  address: string;
  index: number;
};

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
    list: {
      rowGap: 12,
      marginTop: 20,
    },
  });

export const ImportLedgerScreen: React.FC = () => {
  const [startNo, setStartNo] = React.useState(0);
  const [accounts, setAccounts] = React.useState<LedgerAccount[]>([]);
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [loading, setLoading] = React.useState(true);
  const [selectedHdPathTypeIndex, setSelectedHdPathTypeIndex] =
    React.useState(0);
  const [hdPathType, setHdPathType] = React.useState<LedgerHDPathType>();

  const loadAddress = React.useCallback(async (index: number) => {
    const res = await apiLedger.getAddresses(index, index + 1);
    setAccounts(prev => {
      return [
        ...prev,
        {
          address: res[0].address,
          index: res[0].index,
        },
      ];
    });
  }, []);

  const handleLoadAddress = React.useCallback(
    async (start: number) => {
      setLoading(true);
      try {
        for (let i = start; i < start + 50; i++) {
          await loadAddress(i);
        }
      } catch (e: any) {
        toast.show(e.message);
      }

      setLoading(false);
    },
    [loadAddress],
  );

  const handleSelectIndex = React.useCallback(async (address, index) => {
    try {
      await apiLedger.importAddress(index - 1);
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
  }, []);

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
      handleLoadAddress(startNo);
    },
    [handleLoadAddress, startNo],
  );

  React.useEffect(() => {
    apiLedger
      .getCurrentUsedHDPathType()
      .then(setHdPathType)
      .then(() => handleLoadAddress(0));
  }, [handleLoadAddress]);

  return (
    <RootScreenContainer hideBottomBar style={styles.root}>
      <ScrollView style={styles.main}>
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
      </ScrollView>
    </RootScreenContainer>
  );
};
