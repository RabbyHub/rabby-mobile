import { useTheme2024 } from '@/hooks/theme';
import React from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import WhiteListItem from '../../components/WhiteListItem';
import EmptyWhiteListHolder from '../../components/EmptyWhiteListHolder';
import { OtherAddressNav } from '@/screens/Address/AddressListScreen';
import ScannerCC from '@/assets2024/icons/common/scanner-cc.svg';
import { trigger } from 'react-native-haptic-feedback';
import { useWhiteListAddress } from '../../hooks/useWhiteListAddress';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { StackActions } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';

interface IHeaderProps {
  gotoAddWhitelist: () => void;
}
const WhiteListHeader = ({ gotoAddWhitelist }: IHeaderProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View style={styles.header}>
      <Text style={styles.headerText}>Whitelist Addresses</Text>
      <Pressable onPress={gotoAddWhitelist}>
        <Text>icon</Text>
      </Pressable>
    </View>
  );
};

const triggerLight = () => {
  trigger('impactLight', {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  });
};

const SendPolyScreen = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const { list } = useWhiteListAddress();
  const { navigation } = useSafeSetNavigationOptions();

  const handleGotoInputAddress = () => {
    triggerLight();
    navigation.dispatch(
      StackActions.push(RootNames.StackTransaction, {
        screen: RootNames.SendInput,
        params: {},
      }),
    );
  };
  const handleGotoImportedAddress = () => {
    triggerLight();
    navigation.dispatch(
      StackActions.push(RootNames.StackTransaction, {
        screen: RootNames.SelectImportAddress,
        params: {},
      }),
    );
  };
  const handleGotoAddWhitelist = () => {
    triggerLight();
    console.log('🔍 CUSTOM_LOGGER:=>: handleGotoAddWhitelist');
  };

  return (
    <NormalScreenContainer2024 overwriteStyle={styles.root}>
      <Pressable style={styles.input} onPress={handleGotoInputAddress}>
        <Text style={styles.placeHolder}>Enter Address</Text>
        <ScannerCC color={colors2024['neutral-title-1']} />
      </Pressable>
      <FlatList
        data={list}
        keyExtractor={item => `${item.address}-${item.type}-${item.brandName}`}
        style={styles.listContainer}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <WhiteListItem account={item} inWhiteList hiddenArrow />
          </View>
        )}
        ListHeaderComponent={() => (
          <WhiteListHeader gotoAddWhitelist={handleGotoAddWhitelist} />
        )}
        ListEmptyComponent={EmptyWhiteListHolder}
        ListFooterComponent={
          <View style={styles.footer}>
            <OtherAddressNav
              onPress={handleGotoImportedAddress}
              text={'Send to Imported Addresses'}
            />
            <View style={styles.footerGap} />
          </View>
        }
      />
    </NormalScreenContainer2024>
  );
};

export default SendPolyScreen;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  root: {
    position: 'relative',
    paddingHorizontal: 16,
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
