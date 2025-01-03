import React, { useCallback, useMemo } from 'react';
import dayjs from 'dayjs';
import { StyleSheet, View, ScrollView } from 'react-native';
import BigNumber from 'bignumber.js';
import { getCHAIN_ID_LIST } from '@/constant/projectLists';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { AssetAvatar, Text } from '@/components';
import { AppColorsVariants } from '@/constant/theme';
import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { Media } from '@/components/Media';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { IconDefaultNFT, IconNumberNFT } from '@/assets/icons/nft';
import { CHAINS_ENUM } from '@/constant/chains';
import { RootNames } from '@/constant/layout';
import { useNavigationState } from '@react-navigation/native';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { ellipsisOverflowedText } from '@/utils/text';
import { createGetStyles2024 } from '@/utils/styles';
import { Button } from '@/components2024/Button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { navigate } from '@/utils/navigation';
import { useMemoizedFn } from 'ahooks';
import FastImage from 'react-native-fast-image';
import {
  KeyringAccountWithAlias,
  useCurrentAccount,
  useMyAccounts,
} from '@/hooks/account';
import { useSortAddressList } from '../Address/useSortAddressList';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { useAssetsMap } from '../Home/hooks/store';

const ListItem = (props: {
  title: string;
  value?: string;
  showBorderTop?: boolean;
}) => {
  const { title, value, showBorderTop } = props;
  const { styles, colors2024 } = useTheme2024({ getStyle });

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

export const NFTDetailScreen = () => {
  const { styles, colors2024, colors } = useTheme2024({ getStyle });
  const { bottom } = useSafeAreaInsets();
  const { t } = useTranslation();
  const { navigation, setNavigationOptions } = useSafeSetNavigationOptions();
  const { token } = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.NftDetail)?.params,
  ) as {
    token: NFTItem;
  };
  const chain = getCHAIN_ID_LIST().get(token.chain);
  const isSvgURL = token?.content?.endsWith('.svg');
  const iconUri = chain?.logo;
  // const collectionName = token.contract_name || token?.collection?.name || '';

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
              src={isSvgURL ? '' : token?.thumbnail_url}
              thumbnail={isSvgURL ? '' : token?.thumbnail_url}
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
          {ellipsisOverflowedText(token?.name, 20)}
        </Text>
      </View>
    );
  });

  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: TokenDetailHeaderArea,
      headerTitleAlign: 'center',
    });
  }, [TokenDetailHeaderArea, setNavigationOptions]);

  const calPrice = useCallback((iToken: NFTItem) => {
    if (iToken?.usd_price) {
      return `$${new BigNumber(iToken?.usd_price).toFormat(2, 4)}`;
    }
    return 'Unable to get price';
  }, []);

  const calDate = useCallback(
    (iToken: NFTItem) =>
      iToken?.pay_token?.time_at
        ? dayjs(iToken?.pay_token?.time_at * 1000).format('YYYY-MM-DD')
        : 'Unable to get Date',
    [],
  );

  const handleSend = useCallback((iToken: NFTItem, address: string) => {
    navigate(RootNames.StackTransaction, {
      screen: RootNames.SendNFT,
      params: {
        collectionName: iToken.contract_name || iToken?.collection?.name || '',
        nftItem: iToken,
        address,
      },
    });
  }, []);

  const [asssest] = useAssetsMap();
  const { accounts } = useMyAccounts();
  const sortedAccounts = useSortAddressList(accounts);

  const itemList = useMemo(() => {
    const resList: {
      data: NFTItem;
      address: string;
      index: number;
    }[] = [];

    Object.keys(asssest).map((address, index) => {
      const { nfts } = asssest[address];

      nfts?.map(item => {
        if (
          item.id === token.id &&
          item.chain === token.chain &&
          item.contract_id === token.contract_id
        ) {
          resList.push({
            data: item,
            address,
            index,
          });
        }
      });
    });
    console.log('relateNFTList length:', resList.length);
    return resList;
  }, [asssest, token]);

  const renderAccountHeader = useCallback(
    (selectAccount: KeyringAccountWithAlias) => {
      return (
        <View style={styles.accountBox}>
          <View className="relative">
            <WalletIcon
              type={selectAccount?.type as KEYRING_TYPE}
              width={styles.walletIcon.width}
              height={styles.walletIcon.height}
              style={styles.walletIcon}
            />
          </View>
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.titleText}>
            {selectAccount?.aliasName || selectAccount?.brandName}
          </Text>
        </View>
      );
    },
    [styles.accountBox, styles.titleText, styles.walletIcon],
  );

  const renderSingeleNft = useCallback(
    ({ address, iToken }: { address: string; iToken: NFTItem }) => {
      const selectAccount = sortedAccounts.find(a =>
        isSameAddress(a.address, address),
      );
      if (!selectAccount) {
        return null;
      }

      return (
        <View key={`${address}-${iToken.id}`}>
          {renderAccountHeader(selectAccount)}
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
                {iToken?.name || 'Unable to get NFT name'}
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
          <View style={[styles.buttonContainer]}>
            <Button
              onPress={() => handleSend(iToken, address)}
              title={t('page.sendNFT.sendButton')}
              titleStyle={styles.btnTitle}
            />
          </View>
        </View>
      );
    },
    [
      calDate,
      calPrice,
      renderAccountHeader,
      t,
      handleSend,
      colors,
      styles,
      sortedAccounts,
    ],
  );

  return (
    <NormalScreenContainer2024 type="bg1" overwriteStyle={styles.container}>
      <ScrollView style={styles.scrollContainer}>
        {itemList.map(({ data, address }) =>
          renderSingeleNft({ address, iToken: data }),
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
