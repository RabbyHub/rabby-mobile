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
  const collectionName = token.contract_name || token?.collection?.name || '';

  const TokenDetailHeaderArea = useMemoizedFn(() => {
    return (
      <View style={styles.headerArea}>
        <AssetAvatar
          logo={token?.content}
          logoStyle={styles.assetIcon}
          size={40}
          chain={token?.chain}
          chainSize={16}
        />
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

  const price = useMemo(() => {
    if (token?.usd_price) {
      return `$${new BigNumber(token?.usd_price).toFormat(2, 4)}`;
    }
    return 'Unable to get price';
  }, [token?.usd_price]);

  const date = useMemo(
    () =>
      token?.pay_token?.time_at
        ? dayjs(token?.pay_token?.time_at * 1000).format('YYYY-MM-DD')
        : 'Unable to get Date',

    [token?.pay_token?.time_at],
  );

  const handleSend = useCallback(() => {
    navigate(RootNames.StackTransaction, {
      screen: RootNames.SendNFT,
      params: {
        collectionName,
        nftItem: token,
      },
    });
  }, [collectionName, token]);

  return (
    <NormalScreenContainer2024 type="bg1" overwriteStyle={styles.container}>
      <ScrollView style={styles.scrollContainer}>
        <Media
          failedPlaceholder={<IconDefaultNFT width={'100%'} height={360} />}
          type={token?.content_type}
          src={token?.content}
          style={styles.images}
          mediaStyle={styles.innerImages}
          playable={true}
          poster={token?.content}
        />
        <View style={styles.bottom}>
          <View style={styles.titleView}>
            <Text style={styles.title} numberOfLines={1}>
              {token?.name || 'Unable to get NFT name'}
            </Text>
            {token?.amount > 1 ? (
              <View style={styles.subtitle}>
                <IconNumberNFT color={colors['neutral-title-1']} width={15} />
                <View>
                  <Text style={styles.numbernft}>
                    {'Number of NFTs '}{' '}
                    <Text
                      style={{
                        color: colors['neutral-title-1'],
                      }}>
                      {token.amount}
                    </Text>
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
          <ListItem title="Collection" value={collectionName} showBorderTop />
          <ListItem
            title="Chain"
            value={
              getCHAIN_ID_LIST().get(token?.chain || CHAINS_ENUM.ETH)?.name
            }
          />
          <ListItem title="Purchase Date" value={date} />
          <ListItem title="Last Price" value={price} />
        </View>
      </ScrollView>
      <View
        style={[
          styles.buttonContainer,
          {
            paddingBottom: Math.max(bottom, 50),
          },
        ]}>
        <Button
          onPress={handleSend}
          title={t('page.sendNFT.sendButton')}
          titleStyle={styles.btnTitle}
        />
      </View>
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
  buttonContainer: {
    height: 140,
    width: '100%',
    padding: 20,
  },
  btnTitle: {
    color: colors['neutral-title-2'],
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
