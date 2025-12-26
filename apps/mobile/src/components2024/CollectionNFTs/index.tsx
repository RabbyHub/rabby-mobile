import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, ScrollView } from 'react-native';
import { CollectionList, NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import AutoLockView from '@/components/AutoLockView';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { useFindChain } from '@/hooks/useFindChain';
import { Item } from './NFTItem';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { AccountOverview } from '@/screens/Home/components/AccountOverview';

interface Props {
  data: CollectionList;
  titleText?: string;
  onPressItem: (item: NFTItem) => void;
  /** @deprecated */
  onClose?: () => void;
  account?: KeyringAccountWithAlias;
}

export const CollectionNFTs: React.FC<Props> = ({
  data,
  titleText,
  onPressItem,
  account,
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const chainInfo = useFindChain({
    serverId: data.chain || null,
  });

  return (
    <AutoLockView
      style={{
        ...styles.container,
        backgroundColor: colors2024['neutral-bg-2'],
      }}>
      <BottomSheetHandlableView>
        <View style={{ ...styles.titleView, ...styles.titleViewWithText }}>
          <View style={styles.titleTextWrapper}>
            {!!titleText && <Text style={styles.titleText}>{titleText}</Text>}
            {account ? (
              <AccountOverview
                account={account}
                logoSize={18}
                textStyle={styles.accountOverviewText}
              />
            ) : null}
          </View>
        </View>
      </BottomSheetHandlableView>

      <View style={[styles.chainListWrapper]}>
        <View style={styles.textContainer}>
          <ChainIconImage size={16} chainEnum={chainInfo?.enum} />
          <Text style={styles.footerPriceText}>
            <Text>{chainInfo?.name}</Text>
            {data.floor_price !== 0 ? (
              <>
                <Text>
                  {' '}
                  {t('page.singleHome.nft.floorPrice')} {data.floor_price}{' '}
                  {data.native_token?.symbol}
                </Text>
              </>
            ) : null}
          </Text>
        </View>
        <View style={styles.nftListContainer}>
          <ScrollView
            horizontal={false}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            {data.nft_list.map(nft => (
              <Item item={nft} key={nft.id} onPress={() => onPressItem(nft)} />
            ))}
          </ScrollView>
        </View>
      </View>
    </AutoLockView>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    height: '100%',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  titleText: {
    color: colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
    lineHeight: 24,
  },
  accountOverviewText: {
    fontSize: 16,
    lineHeight: 20,
  },
  titleTextWrapper: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },

  chainListWrapper: {
    flexShrink: 1,
    height: '100%',
    maxHeight: 281,
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },

  titleView: {
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    // marginBottom: 12,
  },

  titleViewWithText: {
    marginBottom: 20,
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerPriceText: {
    color: colors2024['neutral-title-1'],
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  nftListContainer: {
    flex: 1,
    height: 200,
  },
  scrollContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
}));
