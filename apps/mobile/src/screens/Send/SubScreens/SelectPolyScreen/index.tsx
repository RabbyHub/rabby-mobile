import { useTheme2024 } from '@/hooks/theme';
import React, { useCallback, useEffect } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { WhiteListItem } from '../../components/WhiteListItem';
import EmptyWhiteListHolder from '../../components/EmptyWhiteListHolder';
import { OtherAddressNav } from '@/screens/Address/AddressListScreen';
import ScannerCC from '@/assets2024/icons/common/scanner-cc.svg';
import { useWhiteListAddress } from '../../hooks/useWhiteListAddress';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { StackActions } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { RcIconAddWhiteList } from '@/assets2024/icons/whitelist';
import { useAccounts } from '@/hooks/account';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useRecentSend } from '../../hooks/useRecentSend';
import { RecentSendItem } from './RecentSendItem';
import { SendHeaderRight } from './HeaderRight';
import { filterMyAccounts } from '@/utils/account';
import SendInputScreen from '../SendInput';
import { useInputSwitch } from '../SendInput/useInputSwitch';
import { SendHeaderLeft } from './HeaderLeft';
import { navigate } from '@/utils/navigation';
import { useSendRoutes } from '@/hooks/useSendRoutes';
import { usePollSendPendingCount } from '../../hooks/useSendPendingCount';

interface IHeaderProps {
  gotoAddWhitelist: () => void;
  hideIcon?: boolean;
}
const WhiteListHeader = ({ hideIcon, gotoAddWhitelist }: IHeaderProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  return (
    <View style={styles.header}>
      <Text style={styles.headerText}>{t('page.sendPoly.whitelistTitle')}</Text>
      {hideIcon ? null : (
        <Pressable hitSlop={10} onPress={gotoAddWhitelist}>
          <RcIconAddWhiteList style={styles.addIcon} />
        </Pressable>
      )}
    </View>
  );
};

const SendPolyScreen = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const { list, findAccountWithoutBalance } = useWhiteListAddress();
  const { navigation, setNavigationOptions } = useSafeSetNavigationOptions();
  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });
  const {
    isInputAddress,
    toggle: toggleInput,
    clean: cleanInput,
  } = useInputSwitch();
  const { recentHistory } = useRecentSend({ useAllHistory: true });
  const { isSingleAddress } = useSendRoutes();

  const Header = useCallback(
    () => <SendHeaderRight isForMultipleAddress={!isSingleAddress} />,
    [isSingleAddress],
  );
  const HeaderLeft = useCallback(
    () => <SendHeaderLeft isInputAddress={isInputAddress} clean={cleanInput} />,
    [cleanInput, isInputAddress],
  );
  useEffect(() => {
    setNavigationOptions({
      headerRight: Header,
      headerLeft: HeaderLeft,
    });
  }, [Header, HeaderLeft, setNavigationOptions]);

  usePollSendPendingCount({
    isForMultipleAddress: !isSingleAddress,
  });

  const handleGotoInputAddress = useCallback(
    (autoScan: boolean) => {
      toggleInput();
      if (autoScan) {
        navigate(RootNames.Scanner);
      }
    },
    [toggleInput],
  );
  const handleGotoImportedAddress = useCallback(() => {
    navigation.dispatch(
      StackActions.push(RootNames.StackTransaction, {
        screen: RootNames.SelectImportAddress,
        params: {},
      }),
    );
  }, [navigation]);
  const handleGotoAddWhitelist = useCallback(() => {
    navigation.dispatch(
      StackActions.push(RootNames.StackTransaction, {
        screen: RootNames.WhitelistInput,
        params: {},
      }),
    );
  }, [navigation]);

  const renderHeader = useCallback(
    () => (
      <View>
        <View style={styles.input}>
          <Pressable
            style={styles.placeHolderWrapper}
            onPress={() => handleGotoInputAddress(false)}>
            <Text style={styles.placeHolder}>
              {t('page.sendPoly.enterAddress')}
            </Text>
          </Pressable>
          <Pressable onPress={() => handleGotoInputAddress(true)}>
            <ScannerCC color={colors2024['neutral-title-1']} />
          </Pressable>
        </View>
        <View>
          {!!recentHistory.length && (
            <Text style={styles.recentHeader}>{t('page.sendPoly.recent')}</Text>
          )}
          {/* less than 3 history */}
          <View style={styles.recentList}>
            {recentHistory?.map(item => {
              const { account, inWhitelist } = findAccountWithoutBalance(
                item.toAddress,
              );
              return (
                <RecentSendItem
                  key={item.time}
                  account={account}
                  timeStamp={item.time}
                  inWhiteList={inWhitelist}
                />
              );
            })}
          </View>
        </View>
        <WhiteListHeader gotoAddWhitelist={handleGotoAddWhitelist} />
      </View>
    ),
    [
      colors2024,
      findAccountWithoutBalance,
      handleGotoAddWhitelist,
      handleGotoInputAddress,
      recentHistory,
      styles.input,
      styles.placeHolder,
      styles.placeHolderWrapper,
      styles.recentHeader,
      styles.recentList,
      t,
    ],
  );

  const renderEmpty = useCallback(
    () => <EmptyWhiteListHolder gotoAddWhitelist={handleGotoAddWhitelist} />,
    [handleGotoAddWhitelist],
  );

  const renderFooter = useCallback(
    () => (
      <View style={styles.footer}>
        <OtherAddressNav
          onPress={handleGotoImportedAddress}
          text={t('page.sendPoly.sendToImportedAddress')}
        />
        <View style={styles.footerGap} />
      </View>
    ),
    [handleGotoImportedAddress, styles.footer, styles.footerGap, t],
  );
  if (isInputAddress) {
    return <SendInputScreen cleanInput={cleanInput} />;
  }
  return (
    <NormalScreenContainer2024 overwriteStyle={styles.root}>
      <FlatList
        data={list}
        keyExtractor={item => `${item.address}-${item.type}-${item.brandName}`}
        style={styles.listContainer}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <WhiteListItem
              account={item}
              inWhiteList
              isMyImported={filterMyAccounts(accounts).some(i =>
                isSameAddress(i.address, item.address),
              )}
            />
          </View>
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
      />
    </NormalScreenContainer2024>
  );
};

export default SendPolyScreen;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  root: {
    position: 'relative',
    paddingHorizontal: 20,
  },
  input: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 16,
    display: 'flex',
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 8,
    marginHorizontal: 4,
    height: 58,
  },
  item: {
    marginBottom: 12,
  },
  placeHolderWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  placeHolder: {
    color: colors2024['neutral-secondary'],
    fontSize: 17,
    lineHeight: 58,
    fontWeight: '400',
    flex: 1,
    fontFamily: 'SF Pro Rounded',
  },
  listContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginTop: 24,
    marginBottom: 4,
  },
  headerText: {
    color: colors2024['neutral-secondary'],
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
  addIcon: {
    width: 17,
    height: 19,
  },
  footer: {
    marginTop: 16,
  },
  footerGap: {
    height: 150,
  },
  recentHeader: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    marginBottom: 12,
    marginTop: 20,
    paddingHorizontal: 4,
  },
  recentList: {
    gap: 12,
  },
}));
