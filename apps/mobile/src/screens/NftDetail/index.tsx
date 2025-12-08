/* eslint-disable react-native/no-inline-styles */
import React, { useCallback, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import { StyleSheet, View, ScrollView } from 'react-native';
import BigNumber from 'bignumber.js';
import { getCHAIN_ID_LIST } from '@/constant/projectLists';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import { Text } from '@/components';
import { NFTItem, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { Media } from '@/components/Media';
import { IconDefaultNFT, IconNumberNFT } from '@/assets/icons/nft';
import { CHAINS_ENUM } from '@/constant/chains';
import { RootNames } from '@/constant/layout';
import { StackActions, useRoute } from '@react-navigation/native';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { GetRootScreenRouteProp } from '@/navigation-type';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { ellipsisOverflowedText } from '@/utils/text';
import { createGetStyles2024 } from '@/utils/styles';
import { Button } from '@/components2024/Button';
import { useTranslation } from 'react-i18next';
import { navigate, naviPush } from '@/utils/navigation';
import { useMemoizedFn } from 'ahooks';
import FastImage from 'react-native-fast-image';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { useMyAccounts } from '@/hooks/account';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { useLoadAssets } from '../Search/useAssets';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { ellipsisAddress } from '@/utils/address';
import { DropDownMenuView } from '@/components2024/DropDownMenu';
import { DisplayNftItem } from '../Home/types';
import { useTriggerTagAssets } from '../Home/hooks/refresh';
import { trigger } from 'react-native-haptic-feedback';
import { preferenceService } from '@/core/services';
import { RcIconMore } from '@/assets/icons/home';
import { toast } from '@/components2024/Toast';
import { MenuAction } from '@/components2024/ContextMenuView/ContextMenuView';
import { GetRootScreensParamsList } from '@/navigation-type';
import { useSendRoutes } from '@/hooks/useSendRoutes';

const ListItem = (props: {
  title: string;
  value?: string;
  showBorderTop?: boolean;
}) => {
  const { title, value, showBorderTop } = props;
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={[styles.listItem, showBorderTop && styles.borderTop]}>
      <View style={styles.left}>
        <Text style={styles.price}>{title}</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.value} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
};

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

const RightMore: React.FC<{
  nft: DisplayNftItem;
  refreshTags: () => void;
}> = ({ nft, refreshTags }) => {
  const isDarkTheme = useGetBinaryMode() === 'dark';
  const { t } = useTranslation();

  const menuActions = React.useMemo(() => {
    return [
      {
        title: nft._isFold
          ? t('page.tokenDetail.action.unfold')
          : t('page.tokenDetail.action.fold'),
        icon: nft._isFold
          ? isDarkTheme
            ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_unfold_dark.png')
            : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_unfold.png')
          : isDarkTheme
          ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_fold_dark.png')
          : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_fold.png'),
        androidIconName: nft._isFold
          ? 'ic_rabby_menu_unfold'
          : 'ic_rabby_menu_fold',
        key: 'fold',
        action() {
          if (nft._isFold) {
            preferenceService.manualUnFoldNft({
              chain: nft.chain,
              id: nft.id,
            });
            toast.success(t('page.tokenDetail.actionsTips.unfold_success'));
          } else {
            preferenceService.manualFoldNft({
              chain: nft.chain,
              id: nft.id,
            });
            toast.success(t('page.tokenDetail.actionsTips.fold_success'));
          }
          nft._isFold = !nft._isFold;
          refreshTags();
        },
      },
    ] as MenuAction[];
  }, [nft, t, isDarkTheme, refreshTags]);

  return (
    <DropDownMenuView
      menuConfig={{
        menuActions: menuActions,
      }}
      triggerProps={{ action: 'press' }}>
      <CustomTouchableOpacity hitSlop={hitSlop}>
        <RcIconMore width={24} height={24} />
      </CustomTouchableOpacity>
    </DropDownMenuView>
  );
};

export const NFTDetailScreen = () => {
  const { styles, colors } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { setNavigationOptions } = useSafeSetNavigationOptions();
  const route = useRoute<GetRootScreenRouteProp<'NftDetail'>>();
  const { token, isSingleAddress, account: routeAccount } = route.params || {};
  type NonListType = Exclude<typeof token, TokenItem[]>;

  const chain = getCHAIN_ID_LIST().get((token as NonListType).chain);
  const isSvgURL = (token as NonListType)?.content?.endsWith('.svg');
  const iconUri = chain?.logo;
  const { nftRefresh, singleNFTRefresh } = useTriggerTagAssets();

  const refreshTag = useCallback(() => {
    if (isSingleAddress) {
      singleNFTRefresh();
    } else {
      nftRefresh();
    }
  }, [isSingleAddress, nftRefresh, singleNFTRefresh]);
  const getHeaderRight = useMemoizedFn(() => {
    return <RightMore nft={token as DisplayNftItem} refreshTags={refreshTag} />;
  });

  const TokenDetailHeaderArea = useMemoizedFn(() => {
    return (
      <View style={styles.headerArea}>
        <View style={styles.avator}>
          <View
            style={StyleSheet.flatten([
              styles.imagesView,
              {
                width: 40,
                height: 40,
              },
            ])}>
            <Media
              failedPlaceholder={<IconDefaultNFT width="100%" height="100%" />}
              type="image_url"
              src={isSvgURL ? '' : (token as NFTItem)?.thumbnail_url}
              thumbnail={isSvgURL ? '' : (token as NFTItem)?.thumbnail_url}
              mediaStyle={styles.imagesAvatar}
              style={styles.imagesAvatar}
              playIconSize={36}
            />
          </View>
          {iconUri ? (
            <FastImage
              source={{
                uri: iconUri,
              }}
              style={styles.chainIcon}
            />
          ) : null}
        </View>
        <Text style={styles.tokenSymbol} numberOfLines={1} ellipsizeMode="tail">
          {/* {token?.name} */}
          {ellipsisOverflowedText(
            (token as NFTItem)?.name || t('global.unknownNFT'),
            20,
          )}
        </Text>
      </View>
    );
  });

  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: TokenDetailHeaderArea,
      headerRight: getHeaderRight,
      headerTitleAlign: 'center',
    });
  }, [TokenDetailHeaderArea, getHeaderRight, setNavigationOptions]);

  const calPrice = useCallback((iToken: NFTItem) => {
    if (iToken?.usd_price) {
      return `$${new BigNumber(iToken?.usd_price).toFormat(2, 4)}`;
    }
    return '-';
  }, []);

  const calDate = useCallback(
    (iToken: NFTItem) =>
      iToken?.pay_token?.time_at
        ? dayjs(iToken?.pay_token?.time_at * 1000).format('YYYY-MM-DD')
        : '-',
    [],
  );

  // todo check this
  const currentAccount = preferenceService.getFallbackAccount();
  const { accounts } = useMyAccounts({
    disableAutoFetch: true,
  });
  const finalAccount = useMemo(
    () => routeAccount || currentAccount,
    [routeAccount, currentAccount],
  );

  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();

  const handleSend = useCallback(
    async (iToken: NFTItem, address: string, accountType: KEYRING_TYPE) => {
      const foundRet = {
        matched: null as null | (typeof accounts)[number],
        onlyMatchedAddress: null as null | (typeof accounts)[number],
      };

      for (const acc of accounts) {
        if (isSameAddress(acc.address, address)) {
          foundRet.onlyMatchedAddress = acc;

          if (acc.type === accountType) {
            foundRet.matched = acc;
            foundRet.onlyMatchedAddress = null;
            break;
          }
        }
      }
      const fromAccount = foundRet.matched || foundRet.onlyMatchedAddress;
      if (!fromAccount) return;

      await switchSceneCurrentAccount('SendNFT', fromAccount);
      naviPush(RootNames.StackTransaction, {
        screen: RootNames.SendNFT,
        params: {
          collectionName:
            iToken.contract_name || iToken?.collection?.name || '',
          nftItem: iToken,
          fromAccount,
        },
      });
    },
    [accounts, switchSceneCurrentAccount],
  );

  const { nftsMap, getCacheTop10Assets } = useLoadAssets();

  type ItemBase = {
    data: NFTItem;
    address: string;
    index: number;
    type?: KEYRING_TYPE;
    aliasName?: string;
  };
  const itemList = useMemo(() => {
    const resList: ItemBase[] = [];
    if (isSingleAddress && finalAccount) {
      console.debug('relateNFTList isSingleAddress');
      resList.push({
        data: token as NFTItem,
        index: 0,
        type: finalAccount.type,
        address: finalAccount.address,
        aliasName:
          finalAccount.aliasName || ellipsisAddress(finalAccount.address),
      });
      return resList;
    }

    const tempList: ItemBase[] = [];

    Object.keys(nftsMap).map((address, index) => {
      const nfts = nftsMap[address];

      nfts?.map(item => {
        if (
          item.id === (token as NFTItem).id &&
          item.chain === (token as NFTItem).chain &&
          item.contract_id === (token as NFTItem).contract_id
        ) {
          tempList.push({
            data: item,
            address,
            index,
          });
        }
      });
    });

    accounts.map(account => {
      const idx = tempList.findIndex(
        item =>
          isSameAddress(item.address, account.address) &&
          account.type !== KEYRING_TYPE.WatchAddressKeyring,
      );
      if (idx > -1) {
        resList.push({
          ...tempList[idx],
          type: account.type,
          aliasName: account.aliasName || ellipsisAddress(account.address),
          index: idx,
        });
      }
    });
    console.log('relateNFTList length:', resList.length);
    return resList.length
      ? resList
      : [
          {
            data: token,
            index: 0,
          } as ItemBase,
        ];
  }, [nftsMap, token, accounts, finalAccount, isSingleAddress]);

  useEffect(() => {
    const id = setTimeout(() => {
      getCacheTop10Assets({
        disableToken: true,
        disableDefi: true,
      });
    }, 200);
    return () => {
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderAccountHeader = useCallback(
    (type: KEYRING_TYPE, aliasName: string, address?: string) => {
      return (
        <View style={styles.accountBox}>
          <View className="relative">
            <WalletIcon
              type={type as KEYRING_TYPE}
              address={address}
              width={styles.walletIcon.width}
              height={styles.walletIcon.height}
              style={styles.walletIcon}
            />
          </View>
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.titleText}>
            {aliasName}
          </Text>
        </View>
      );
    },
    [styles.accountBox, styles.titleText, styles.walletIcon],
  );

  const renderSingeleNft = useCallback(
    ({
      address,
      iToken,
      type,
      aliasName,
    }: {
      address?: string;
      type?: KEYRING_TYPE;
      aliasName?: string;
      iToken: NFTItem;
    }) => {
      return (
        <View key={`${address}-${iToken.id}`}>
          {type && aliasName
            ? renderAccountHeader(type, aliasName, address)
            : null}
          <Media
            failedPlaceholder={<IconDefaultNFT width={'100%'} height={360} />}
            type={iToken?.content_type}
            src={iToken?.content}
            style={styles.images}
            mediaStyle={styles.innerImages}
            playable={true}
            poster={iToken?.content}
          />
          <View style={styles.bottom}>
            <View style={styles.titleView}>
              <Text style={styles.title} numberOfLines={1}>
                {iToken?.name || '-'}
              </Text>
              {iToken?.amount > 1 ? (
                <View style={styles.subtitle}>
                  <IconNumberNFT color={colors['neutral-title-1']} width={15} />
                  <View>
                    <Text style={styles.numbernft}>
                      {'Number of NFTs '}{' '}
                      <Text
                        style={{
                          color: colors['neutral-title-1'],
                        }}>
                        {iToken.amount}
                      </Text>
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
            <ListItem
              title="Collection"
              value={iToken.contract_name || iToken?.collection?.name || ''}
              showBorderTop
            />
            <ListItem
              title="Chain"
              value={
                getCHAIN_ID_LIST().get(iToken?.chain || CHAINS_ENUM.ETH)?.name
              }
            />
            <ListItem title="Purchase Date" value={calDate(iToken)} />
            <ListItem title="Last Price" value={calPrice(iToken)} />
          </View>
          {!!address && (
            <View style={[styles.buttonContainer]}>
              <Button
                onPress={() =>
                  address && type && handleSend(iToken, address, type)
                }
                title={t('page.sendNFT.sendButton')}
                titleStyle={styles.btnTitle}
              />
            </View>
          )}
        </View>
      );
    },
    [calDate, calPrice, renderAccountHeader, t, handleSend, colors, styles],
  );

  return (
    <NormalScreenContainer2024 type="bg1" overwriteStyle={styles.container}>
      <ScrollView style={styles.scrollContainer}>
        {itemList.map(({ data, address, type, aliasName }) =>
          renderSingeleNft({ address, iToken: data, type, aliasName }),
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </NormalScreenContainer2024>
  );
};

const getStyle = createGetStyles2024(({ colors2024, colors }) => ({
  scrollContainer: {
    flex: 1,
    width: '100%',
    marginTop: 8,
    // backgroundColor: colors2024['neutral-bg-4'],
  },
  accountBox: {
    flexDirection: 'row',
    marginLeft: 25,
    gap: 4,
    marginTop: 10,
    marginBottom: 8,
  },
  titleText: {
    flexShrink: 1,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    flexWrap: 'nowrap',
  },
  walletIcon: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  buttonContainer: {
    height: 100,
    width: '100%',
    padding: 20,
  },
  btnTitle: {
    color: colors['neutral-title-2'],
  },
  imagesView: {
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 0,
  },
  headerArea: {
    width: '100%',
    height: 'auto',
    marginLeft: 8,
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  assetIcon: {
    borderRadius: 8,
  },
  tokenSymbol: {
    flexShrink: 1,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    flexWrap: 'nowrap',
  },
  container: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  innerImages: {
    borderRadius: 16,
    // width: '100%',
    // height: 'auto',
  },
  avator: {
    width: 40,
    height: 40,
    borderColor: 'red',
    position: 'relative',
  },
  chainIcon: {
    width: 16,
    height: 16,
    borderRadius: 16,
    position: 'absolute',
    bottom: -2,
    right: -2,
  },
  imagesAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  images: {
    width: '100%',
    height: 360,
    // flex: 1,
    paddingHorizontal: 16,
    borderRadius: 0,
    resizeMode: 'cover',
    backgroundColor: 'transparent',
  },
  titleView: {
    paddingTop: 16,
    paddingBottom: 16,
    width: '100%',
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
  },
  subtitle: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: 16,
  },
  numbernft: {
    fontSize: 15,
    fontWeight: '500',
    color: colors['neutral-title-1'],
    lineHeight: 17,
    marginLeft: 8,
  },
  listItem: {
    flexDirection: 'row',
    paddingTop: 16,
    justifyContent: 'space-between',
  },
  price: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  value: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    alignContent: 'flex-end',
    maxWidth: 227,
    marginLeft: 24,
    textAlign: 'right',
  },
  borderTop: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors['neutral-line'],
  },
  bottom: {
    paddingHorizontal: 20,
    width: '100%',
  },
  left: {
    alignSelf: 'flex-start',
  },
  right: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
    flexWrap: 'wrap',
    alignContent: 'flex-end',
  },
}));
