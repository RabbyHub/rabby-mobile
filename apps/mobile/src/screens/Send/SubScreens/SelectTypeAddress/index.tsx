import { useTheme2024 } from '@/hooks/theme';
import React from 'react';
import { FlatList, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { WhiteListItem } from '../../components/WhiteListItem';
import EmptyWhiteListHolder from '../../components/EmptyWhiteListHolder';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { useNavigationState } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { useAccounts } from '@/hooks/account';
import { useWhitelist } from '@/hooks/whitelist';
import HeaderTitleText2024 from '@/components2024/ScreenHeader/HeaderTitleText';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils/src/types';

const SelectTypeScreenScreen = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { type } = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.SelectTypeAddress)?.params,
  ) as {
    type: 'watch' | 'safe';
  };
  const { accounts } = useAccounts();
  const { whitelist } = useWhitelist();
  const { setNavigationOptions } = useSafeSetNavigationOptions();

  const getHeaderTitle = React.useCallback(() => {
    return (
      <HeaderTitleText2024 style={styles.headerTitleStyle}>
        Select {type === 'watch' ? 'Watch-Only' : 'Safe'} Address
      </HeaderTitleText2024>
    );
  }, [styles.headerTitleStyle, type]);

  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: getHeaderTitle,
    });
  }, [setNavigationOptions, getHeaderTitle]);

  return (
    <NormalScreenContainer2024 overwriteStyle={styles.root}>
      <FlatList
        data={accounts.filter(
          acc =>
            acc.type ===
            (type === 'watch' ? KEYRING_CLASS.WATCH : KEYRING_CLASS.GNOSIS),
        )}
        keyExtractor={item => `${item.address}-${item.type}-${item.brandName}`}
        style={styles.listContainer}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <WhiteListItem
              account={item}
              inWhiteList={whitelist.includes(item.address)}
              hiddenArrow
            />
          </View>
        )}
        ListEmptyComponent={EmptyWhiteListHolder}
      />
    </NormalScreenContainer2024>
  );
};

export default SelectTypeScreenScreen;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  root: {
    position: 'relative',
    paddingHorizontal: 16,
  },
  headerTitleStyle: {
    color: colors2024['neutral-title-1'],
    fontWeight: '800',
    fontSize: 20,
    fontFamily: 'SF Pro Rounded',
  },
  input: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 10,
    display: 'flex',
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 56,
  },
  item: {
    marginBottom: 8,
  },
  placeHolder: {
    color: colors2024['neutral-secondary'],
    fontSize: 18,
    fontFamily: 'SF Pro Rounded',
  },
  listContainer: {
    flex: 1,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerText: {
    fontSize: 18,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  footer: {
    marginTop: 12,
  },
  footerGap: {
    height: 150,
  },
}));
