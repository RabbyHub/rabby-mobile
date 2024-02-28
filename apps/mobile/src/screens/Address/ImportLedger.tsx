import { RootNames } from '@/constant/layout';
import { AppColorsVariants } from '@/constant/theme';
import { apiLedger } from '@/core/apis';
import { useThemeColors } from '@/hooks/theme';
import { navigate } from '@/utils/navigation';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
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
import { useAtom } from 'jotai';
import { settingAtom } from '@/components/HDSetting/MainContainer';

export const MAX_ACCOUNT_COUNT = 50;

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

export const ImportLedgerScreen = () => {
  const [accounts, setAccounts] = React.useState<LedgerAccount[]>([]);
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [loading, setLoading] = React.useState(true);
  const [setting] = useAtom(settingAtom);
  const stoppedRef = React.useRef(true);

  const loadAddress = React.useCallback(async (index: number) => {
    const res = await apiLedger.getAddresses(index, index + 1);
    if (stoppedRef.current) {
      return;
    }
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
      stoppedRef.current = false;
      setLoading(true);
      let i = start;
      try {
        for (; i < start + MAX_ACCOUNT_COUNT; ) {
          if (stoppedRef.current) {
            break;
          }
          await loadAddress(i);
          i++;
        }
      } catch (e: any) {
        toast.show(e.message);
      }
      stoppedRef.current = true;

      if (i !== start + MAX_ACCOUNT_COUNT) {
        handleLoadAddress(start);
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

  React.useEffect(() => {
    setAccounts([]);
    if (stoppedRef.current) {
      handleLoadAddress(setting?.startNumber || 0);
    } else {
      stoppedRef.current = true;
    }
  }, [handleLoadAddress, setting]);

  React.useEffect(() => {
    return () => {
      stoppedRef.current = true;
    };
  }, []);

  return (
    <RootScreenContainer hideBottomBar style={styles.root}>
      <ScrollView style={styles.main}>
        <View style={styles.list}>
          {accounts.map(({ address, index }) => (
            <TouchableOpacity
              onPress={() => handleSelectIndex(address, index)}
              style={styles.item}
              key={address}>
              <Text style={styles.itemText}>
                {index}.{address}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text>{loading ? 'Loading...' : ''}</Text>
      </ScrollView>
    </RootScreenContainer>
  );
};
