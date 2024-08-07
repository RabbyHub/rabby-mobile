import React, { useCallback, useMemo } from 'react';
import dayjs from 'dayjs';
import { StyleSheet, View } from 'react-native';
import BigNumber from 'bignumber.js';

import { getCHAIN_ID_LIST } from '@/constant/projectLists';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { Button, Text } from '@/components';
import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { Media } from '@/components/Media';
import { IconDefaultNFT, IconNumberNFT } from '@/assets/icons/nft';
import { CHAINS_ENUM } from '@/constant/chains';
import { createGetStyles } from '@/utils/styles';
import AutoLockView from '@/components/AutoLockView';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { RootNames } from '@/constant/layout';

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
        <Text style={styles.itemLabel}>{title}</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.itemValue} numberOfLines={2}>
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
export const NFTDetailPopupInner = ({
  token,
  collectionName,
}: NFTDetailPopupProps) => {
  const colors = useThemeColors();
  const styles = getStyle(colors);

  const price = useMemo(() => {
    if (token.usd_price) {
      return new BigNumber(token.usd_price).toFormat(2, 4);
    }
    return '-';
  }, [token.usd_price]);

  const date = useMemo(
    () =>
      token.pay_token?.time_at
        ? dayjs(token.pay_token?.time_at * 1000).format('YYYY / MM / DD')
        : '-',

    [token.pay_token?.time_at],
  );

  return (
    <AutoLockView as="BottomSheetView" style={styles.container}>
      <BottomSheetScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContentContainer}>
        <Media
          failedPlaceholder={<IconDefaultNFT width={'100%'} height={390} />}
          type={token.content_type}
          src={token.content}
          style={styles.images}
          mediaStyle={styles.images}
          playable={true}
          poster={token.content}
        />
        <View style={styles.details}>
          <View style={styles.titleView}>
            <Text style={styles.title}>
              {token.name || 'Unable to get NFT name'}
            </Text>
            {token.amount > 1 ? (
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
            value={getCHAIN_ID_LIST().get(token.chain || CHAINS_ENUM.ETH)?.name}
          />
          <ListItem title="Last Price" value={price} />
          <ListItem title="Purchase Date" value={date} />
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
    // flex: 1,
    // ...makeDebugBorder(),
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 20,
    paddingBottom: LAYOUT.footerHeight + 20,
  },
  images: {
    width: '100%',
    height: 353,
    maxHeight: 353,
    borderRadius: 6,
    resizeMode: 'cover',
    marginBottom: 20,
  },
  details: {
    width: '100%',
  },
  titleView: {
    paddingTop: 0,
    paddingBottom: 16,
    width: '100%',
  },
  title: {
    color: colors['neutral-title-1'],
    fontSize: 18,
    fontWeight: '500',
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
    justifyContent: 'space-between',
    paddingTop: 16,
  },
  itemLabel: {
    color: colors['neutral-title-1'],
    fontSize: 15,
    fontWeight: '400',
  },
  itemValue: {
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
