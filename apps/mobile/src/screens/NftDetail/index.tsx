import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import { StyleSheet, View } from 'react-native';
import BigNumber from 'bignumber.js';
import { getCHAIN_ID_LIST } from '@/constant/projectLists';
import { useThemeColors } from '@/hooks/theme';
import { Text } from '@/components';
import { AppColorsVariants } from '@/constant/theme';
import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { Media } from '@/components/Media';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { IconDefaultNFT, IconNumberNFT } from '@/assets/icons/nft';
import { CHAINS_ENUM } from '@/constant/chains';
import { RootNames } from '@/constant/layout';
import { useNavigationState } from '@react-navigation/native';

const ListItem = (props: {
  title: string;
  value?: string;
  showBorderTop?: boolean;
}) => {
  const { title, value, showBorderTop } = props;
  const colors = useThemeColors();
  const styles = getStyle(colors);
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
  const colors = useThemeColors();
  const styles = getStyle(colors);
  const { token, collectionName } = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.NftDetail)?.params,
  ) as {
    token: NFTItem;
    collectionName: string;
  };

  const price = useMemo(() => {
    if (token?.usd_price) {
      return new BigNumber(token?.usd_price).toFormat(2, 4);
    }
    return 'Unable to get price';
  }, [token?.usd_price]);

  const date = useMemo(
    () =>
      token?.pay_token?.time_at
        ? dayjs(token?.pay_token?.time_at * 1000).format('YYYY / MM / DD')
        : 'Unable to get Date',

    [token?.pay_token?.time_at],
  );

  return (
    <NormalScreenContainer>
      <Media
        failedPlaceholder={<IconDefaultNFT width={'100%'} height={390} />}
        type={token?.content_type}
        src={token?.content}
        style={styles.images}
        mediaStyle={styles.images}
        playable={true}
        poster={token?.content}
      />
      <View style={styles.bottom}>
        <View style={styles.titleView}>
          <Text style={styles.title}>
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
        <ListItem title="Last Price" value={price} showBorderTop />
        <ListItem title="Collection" value={collectionName} />
        <ListItem
          title="Chain"
          value={getCHAIN_ID_LIST().get(token?.chain || CHAINS_ENUM.ETH)?.name}
        />
        <ListItem title="Purchase Date" value={date} />
      </View>
    </NormalScreenContainer>
  );
};

const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors['neutral-bg-1'],
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
    },
    images: {
      width: '100%',
      height: 375,
      borderRadius: 0,
      resizeMode: 'cover',
    },
    titleView: {
      paddingTop: 24,
      paddingBottom: 26,
      width: '100%',
    },
    title: {
      color: colors['neutral-title-1'],
      fontSize: 25,
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
      paddingTop: 24,
      justifyContent: 'space-between',
    },
    price: {
      color: colors['neutral-title-1'],
      fontSize: 15,
      fontWeight: '600',
    },
    value: {
      color: colors['neutral-title-1'],
      fontSize: 15,
      fontWeight: '600',
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
  });
