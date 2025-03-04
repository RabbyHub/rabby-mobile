import { useTheme2024 } from '@/hooks/theme';
import React from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { WhiteListItem } from '../../components/WhiteListItem';
import EmptyWhiteListHolder from '../../components/EmptyWhiteListHolder';
import { OtherAddressNav } from '@/screens/Address/AddressListScreen';
import ScannerCC from '@/assets2024/icons/common/scanner-cc.svg';
import { trigger } from 'react-native-haptic-feedback';
import { useWhiteListAddress } from '../../hooks/useWhiteListAddress';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { StackActions } from '@react-navigation/native';
import { AppRootName, RootNames } from '@/constant/layout';
import { RcIconAddWhiteList } from '@/assets2024/icons/whitelist';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';

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
        <Pressable onPress={gotoAddWhitelist}>
          <RcIconAddWhiteList style={styles.addIcon} />
        </Pressable>
      )}
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

  const handleGotoInputAddress = (autoScan: boolean) => {
    triggerLight();
    navigation.dispatch(
      StackActions.push(RootNames.StackTransaction, {
        screen: RootNames.SendInput,
        params: {
          autoScan,
        },
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
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.ADD_WHITELIST_SELECT_METHOD,
      onDone: () => {
        removeGlobalBottomSheetModal2024(id);
      },
      navigateTo: (screen: AppRootName, params?: object) => {
        navigation.dispatch(
          StackActions.push(RootNames.StackTransaction, {
            screen,
            params,
          }),
        );
      },
    });
  };

  return (
    <NormalScreenContainer2024 overwriteStyle={styles.root}>
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
          <WhiteListHeader
            gotoAddWhitelist={handleGotoAddWhitelist}
            hideIcon={list.length === 0}
          />
        )}
        ListEmptyComponent={() => (
          <EmptyWhiteListHolder gotoAddWhitelist={handleGotoAddWhitelist} />
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            <OtherAddressNav
              onPress={handleGotoImportedAddress}
              text={t('page.sendPoly.sendToImportedAddress')}
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
    paddingHorizontal: 20,
  },
  input: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 10,
    display: 'flex',
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 8,
    marginHorizontal: 4,
    height: 56,
  },
  item: {
    marginBottom: 8,
  },
  placeHolderWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  placeHolder: {
    color: colors2024['neutral-secondary'],
    fontSize: 16,
    lineHeight: 56,
    fontWeight: '500',
    flex: 1,
    fontFamily: 'SF Pro Rounded',
  },
  listContainer: {
    flex: 1,
    paddingTop: 36,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
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
    marginTop: 12,
  },
  footerGap: {
    height: 150,
  },
}));
