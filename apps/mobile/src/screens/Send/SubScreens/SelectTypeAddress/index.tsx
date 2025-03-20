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

const SelectTypeScreenScreen = ({
  isForWhitelist,
}: {
  isForWhitelist: boolean;
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { type } = useNavigationState(
    s =>
      s.routes.find(
        r =>
          r.name ===
          (isForWhitelist
            ? RootNames.TypeAddress2Whitelist
            : RootNames.SelectTypeAddress),
      )?.params,
  ) as {
    type: 'watch' | 'safe';
  };
  const { accounts } = useAccounts();
  const { isAddrOnWhitelist } = useWhitelist();
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
        data={accounts
          .filter(
            acc =>
              acc.type ===
              (type === 'watch' ? KEYRING_CLASS.WATCH : KEYRING_CLASS.GNOSIS),
          )
          .sort((a, b) => (b.balance || 0) - (a.balance || 0))}
        keyExtractor={item => `${item.address}-${item.type}-${item.brandName}`}
        style={styles.listContainer}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <WhiteListItem
              account={item}
              inWhiteList={isAddrOnWhitelist(item.address)}
              isForWhitelist={isForWhitelist}
            />
          </View>
        )}
        ListEmptyComponent={EmptyWhiteListHolder}
      />
    </NormalScreenContainer2024>
  );
};

SelectTypeScreenScreen.ForWhitelist = () => {
  return <SelectTypeScreenScreen isForWhitelist />;
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
  item: {
    marginBottom: 12,
  },
  listContainer: {
    flex: 1,
    paddingTop: 16,
  },
}));
