import React, { useCallback, useMemo } from 'react';
import dayjs from 'dayjs';
import { Dimensions, StyleSheet, TextStyle, View } from 'react-native';
import BigNumber from 'bignumber.js';

import { getCHAIN_ID_LIST } from '@/constant/projectLists';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { Button, Text } from '@/components';
import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { Media } from '@/components/Media';
import { IconDefaultNFT, IconNumberNFT } from '@/assets/icons/nft';
import { CHAINS_ENUM } from '@/constant/chains';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import AutoLockView from '@/components/AutoLockView';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';

const ListItem = (props: {
  title: string;
  titleStyle?: TextStyle;
  value?: string;
  showBorderTop?: boolean;
}) => {
  const { title, titleStyle, value, showBorderTop } = props;
  const colors = useThemeColors();
  const styles = getStyle(colors);
  return (
    <View style={[styles.listItem, showBorderTop && styles.borderTop]}>
      <View style={styles.left}>
        <Text style={[styles.itemLabel, titleStyle]}>{title}</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.itemValue} numberOfLines={1} ellipsizeMode="tail">
          {value}
        </Text>
      </View>
    </View>
  );
};

const LAYOUT = {
  footerHeight: 112,
};

function FooterComponent({
  collectionName,
  token,
  onPressSend,
}: Pick<NFTDetailPopupProps, 'collectionName' | 'token'> & {
  onPressSend: () => void;
}) {
  const { styles } = useThemeStyles(getFooterStyle);
  // const navigation = useRabbyAppNavigation();

  // const handlePress = useCallback(() => {
  //   onPressSend?.();

  //   navigation.push(RootNames.StackTransaction, {
  //     screen: RootNames.SendNFT,
  //     params: {
  //       nftToken: token,
  //     },
  //   })
  // }, [onPressSend]);

  return (
    <View style={styles.footerContainer}>
      <Button
        type="primary"
        title="Send"
        onPress={onPressSend}
        titleStyle={[styles.footerText]}
        disabledTitleStyle={[styles.disabledFooterText]}
        containerStyle={[styles.footerButtonContainer]}
      />
    </View>
  );
}

const getFooterStyle = createGetStyles(colors => ({
  footerContainer: {
    borderTopWidth: 0.5,
    borderTopStyle: 'solid',
    borderTopColor: colors['neutral-line'],
    backgroundColor: colors['neutral-bg1'],
    paddingVertical: 20,
    paddingHorizontal: 20,
    height: LAYOUT.footerHeight,
    flexShrink: 0,

    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    alignItems: 'center',
  },
  footerButtonContainer: {
    minWidth: 248,
    height: 52,
    width: '100%',
  },
  footerText: {
    color: colors['neutral-title2'],
  },
  disabledFooterText: {
    color: colors['neutral-title2'],
  },
}));

export type NFTDetailPopupProps = {
  token: NFTItem;
  collectionName?: string;
};

const LAYOUT_INNER_PX = 20;
const CONTENT_W = Dimensions.get('window').width - LAYOUT_INNER_PX * 2;
export const NFTDetailPopupInner = ({
  token,
  collectionName,
}: NFTDetailPopupProps) => {
  const { t } = useTranslation();
  const { colors, styles } = useThemeStyles(getStyle);

  const price = useMemo(() => {
    if (token.usd_price) {
      return `$${new BigNumber(token.usd_price).toFormat(2, 4)}`;
    }
    return '-';
  }, [token.usd_price]);

  const date = useMemo(
    () =>
      token.pay_token?.time_at
        ? dayjs(token.pay_token?.time_at * 1000).format('YYYY-MM-DD')
        : '-',

    [token.pay_token?.time_at],
  );

  return (
    <AutoLockView as="BottomSheetView" style={styles.container}>
      <BottomSheetScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContentContainer}>
        <View style={styles.imageView}>
          <Media
            failedPlaceholder={
              <IconDefaultNFT width={CONTENT_W} height={CONTENT_W} />
            }
            type={token.content_type}
            src={token.content}
            style={styles.images}
            mediaStyle={styles.images}
            playable={true}
            poster={token.content}
          />
          {token.amount > 1 && (
            <View style={styles.nftCountContainer}>
              <Text style={styles.nftCount}>x{token.amount}</Text>
            </View>
          )}
        </View>
        <View style={styles.details}>
          <View style={styles.titleView}>
            <Text style={styles.title}>{token.name || '-'}</Text>
            {/* {token.amount > 1 ? (
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
            ) : null} */}
          </View>
          <ListItem
            title={t('component.NFTDetailModal.FieldLabel.Collection')}
            titleStyle={{ width: 70 }}
            value={collectionName}
            showBorderTop
          />
          <ListItem
            title={t('component.NFTDetailModal.FieldLabel.Chain')}
            value={getCHAIN_ID_LIST().get(token.chain || CHAINS_ENUM.ETH)?.name}
          />
          <ListItem
            title={t('component.NFTDetailModal.FieldLabel.PurschaseDate')}
            value={date}
          />
          <ListItem
            title={t('component.NFTDetailModal.FieldLabel.LastPrice')}
            value={price}
          />
        </View>
      </BottomSheetScrollView>
    </AutoLockView>
  );
};

NFTDetailPopupInner.FooterComponent = FooterComponent;

const getStyle = createGetStyles(colors => ({
  container: {
    flex: 1,
    height: '100%',
    backgroundColor: colors['neutral-bg-1'],
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  scrollView: { width: '100%' },
  scrollViewContentContainer: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: LAYOUT_INNER_PX,
    paddingBottom: LAYOUT.footerHeight + 20,
  },
  imageView: {
    width: CONTENT_W,
    height: CONTENT_W,
    position: 'relative',
    marginBottom: 10,
  },
  images: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
    resizeMode: 'cover',
  },
  nftCountContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.30)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  nftCount: {
    color: colors['neutral-title2'],
    fontSize: 15,
    fontWeight: '600',
  },
  details: {
    width: '100%',
  },
  titleView: {
    paddingTop: 0,
    paddingBottom: 8,
    width: '100%',
  },
  title: {
    color: colors['neutral-title-1'],
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: 8,
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
    justifyContent: 'space-between',
    paddingTop: 8,
    width: '100%',
    // maxWidth: Dimensions.get('window').width - LAYOUT_INNER_PX * 2,
    // ...makeDebugBorder('red'),
  },
  itemLabel: {
    flexShrink: 0,
    color: colors['neutral-title-1'],
    fontSize: 14,
    fontWeight: '400',
    width: 120,
    // ...makeDebugBorder(),
  },
  itemValue: {
    flexShrink: 1,
    color: colors['neutral-title-1'],
    fontSize: 14,
    fontWeight: '500',
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    alignContent: 'flex-end',
    textAlign: 'right',
    // ...makeDebugBorder('yellow'),
  },
  borderTop: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors['neutral-line'],
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
