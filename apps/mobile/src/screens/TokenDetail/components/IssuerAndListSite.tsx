/* eslint-disable react-native/no-inline-styles */
import React, { useCallback } from 'react';
import { TouchableOpacity, View } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

import IconBridgeTo from '@/assets2024/icons/search/IconBridgeTo.svg';
import IconOrigin from '@/assets2024/icons/search/IconOrigin.svg';
import RcIconJumpCC from '@/assets2024/icons/history/IconJumpCC.svg';
import RcIconRightCC from '@/assets2024/icons/history/IconRightArrowCC.svg';
import { AssetAvatar, Text } from '@/components';
import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { ellipsisAddress } from '@/utils/address';
import { findChain } from '@/utils/chain';
import { openTxExternalUrl } from '@/utils/transaction';
import Clipboard from '@react-native-clipboard/clipboard';
import { useMemoizedFn } from 'ahooks';
import { useTranslation } from 'react-i18next';
import { getTokenSymbol } from '@/utils/token';
import { TokenEntityDetail } from '@rabby-wallet/rabby-api/dist/types';
import { formatUsdValue } from '@/utils/number';
import { openExternalUrl } from '@/core/utils/linking';
import { Skeleton } from '@rneui/themed';
import { LoadingLinear } from './TokenPriceChart/LoadingLinear';
import { ellipsisOverflowedText } from '@/utils/text';
import { RootNames } from '@/constant/layout';
import { navigate, naviPush } from '@/utils/navigation';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';

interface Props {
  token: AbstractPortfolioToken;
  tokenEntity?: TokenEntityDetail;
  entityLoading: boolean;
}

const DomainUrlLink = ({
  url,
  name,
  logo_url,
}: {
  url: string;
  name: string;
  logo_url: string;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const handlePress = useCallback(() => {
    url && openExternalUrl(url);
  }, [url]);

  return (
    <TouchableOpacity style={styles.externalLink} onPress={handlePress}>
      <AssetAvatar logo={logo_url} size={16} />
      <Text style={styles.urlText}>{name}</Text>
      <RcIconJumpCC
        style={styles.icon}
        width={12}
        height={12}
        color={colors2024['neutral-secondary']}
      />
    </TouchableOpacity>
  );
};

export const IssuerAndListSite: React.FC<Props> = ({
  token,
  tokenEntity,
  entityLoading,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  console.log('tokenEntity', tokenEntity);
  const isBridgeDomain =
    tokenEntity?.bridge_ids && tokenEntity.bridge_ids.length > 0;
  const isVerified = tokenEntity?.is_domain_verified;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('page.tokenDetail.IssuedBy')}</Text>
      </View>
      {entityLoading ? (
        <Skeleton
          width={'100%'}
          height={68}
          style={styles.skeleton}
          LinearGradientComponent={LoadingLinear}
        />
      ) : (
        <View style={styles.itemCard}>
          {tokenEntity?.domain_id ? (
            <>
              {isVerified && (
                <View
                  style={[
                    styles.itemIssuerContainer,
                    styles.itemIssuePadding,
                    { marginBottom: 12 },
                  ]}>
                  {isBridgeDomain ? (
                    <View
                      style={[
                        styles.itemIssuerContainer,
                        { justifyContent: 'center' },
                      ]}>
                      <View style={styles.horizontalLine} />
                      <IconBridgeTo />
                      <Text style={styles.itemIssuerText}>
                        {t('page.tokenDetail.BridgeIssue')}
                      </Text>
                      <View style={styles.horizontalLine} />
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.itemIssuerContainer,
                        { justifyContent: 'center' },
                      ]}>
                      <View style={styles.horizontalLine} />
                      <IconOrigin />
                      <Text style={styles.itemIssuerText}>
                        {t('page.tokenDetail.OriginIssue')}
                      </Text>
                      <View style={styles.horizontalLine} />
                    </View>
                  )}
                </View>
              )}
              <View style={[styles.itemContainer, styles.itemIssuePadding]}>
                <Text style={styles.itemIssuerTitle}>
                  {isBridgeDomain
                    ? t('page.tokenDetail.BridgeProvider')
                    : t('page.tokenDetail.IssuerWebsite')}
                </Text>
                <DomainUrlLink
                  url={`https://www.${tokenEntity?.domain_id}`}
                  name={tokenEntity?.domain_id}
                  logo_url={token?.logo_url}
                />
              </View>
              {isBridgeDomain && tokenEntity.origin_token && (
                <View style={[styles.itemContainer, styles.itemIssuePadding]}>
                  <Text style={styles.itemIssuerTitle}>
                    {t('page.tokenDetail.OriginalToken')}
                  </Text>
                  <TouchableOpacity
                    style={styles.externalLink}
                    onPress={() => {
                      naviPush(RootNames.TokenDetail, {
                        token: ensureAbstractPortfolioToken(
                          tokenEntity.origin_token!,
                        ),
                        needUseCacheToken: true,
                      });
                    }}>
                    <AssetAvatar
                      logo={tokenEntity.origin_token?.logo_url}
                      // style={mediaStyle}
                      size={18}
                      chain={tokenEntity.origin_token?.chain}
                      chainSize={8}
                    />
                    <Text
                      style={styles.urlText}
                      numberOfLines={1}
                      ellipsizeMode="tail">
                      {ellipsisOverflowedText(
                        getTokenSymbol(tokenEntity.origin_token),
                        10,
                      )}
                    </Text>
                    <RcIconRightCC
                      width={13}
                      height={13}
                      color={colors2024['neutral-secondary']}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : (
            <View style={[styles.itemIssuerContainer, styles.itemIssuePadding]}>
              <View style={styles.horizontalLine} />
              <Text style={styles.itemIssuerText}>
                {t('page.tokenDetail.NoIssuer')}
              </Text>
              <View style={styles.horizontalLine} />
            </View>
          )}
        </View>
      )}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('page.tokenDetail.ListedBy')}</Text>
      </View>
      {entityLoading ? (
        <Skeleton
          width={'100%'}
          height={68}
          style={styles.skeleton}
          LinearGradientComponent={LoadingLinear}
        />
      ) : (
        <View style={styles.itemCard}>
          {!tokenEntity?.listed_sites?.length ? (
            <View style={[styles.itemIssuerContainer, styles.itemIssuePadding]}>
              <View style={styles.horizontalLine} />
              <Text style={styles.itemIssuerText}>
                {t('page.tokenDetail.NoListedSite')}
              </Text>
              <View style={styles.horizontalLine} />
            </View>
          ) : (
            <View style={styles.flexWrap}>
              {tokenEntity?.listed_sites?.map((item, index) => {
                return (
                  <View style={styles.itemContainerLink} key={index}>
                    <DomainUrlLink
                      url={item.url}
                      name={item.name}
                      logo_url={item.logo_url}
                    />
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {t('page.tokenDetail.SupportedExchanges')}
        </Text>
      </View>
      {entityLoading ? (
        <Skeleton
          width={'100%'}
          height={68}
          style={styles.skeleton}
          LinearGradientComponent={LoadingLinear}
        />
      ) : (
        <View style={styles.itemCard}>
          {!tokenEntity?.cex_list?.length ? (
            <View style={[styles.itemIssuerContainer, styles.itemIssuePadding]}>
              <View style={styles.horizontalLine} />
              <Text style={styles.itemIssuerText}>
                {t('page.tokenDetail.NoSupportedExchanges')}
              </Text>
              <View style={styles.horizontalLine} />
            </View>
          ) : (
            <View style={styles.flexWrap}>
              {tokenEntity?.cex_list?.map((item, index) => {
                return (
                  <View style={[styles.itemContainerLink]} key={index}>
                    <DomainUrlLink
                      url={item.site_url}
                      name={item.name}
                      logo_url={item.logo_url}
                    />
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    // marginLeft: 0,
    marginHorizontal: 20,
    marginTop: 20,
    gap: 12,
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    // width: '100%',
  },
  skeleton: {
    borderRadius: 8,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  itemCard: {
    // marginTop: 12,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderRadius: 16,
    // borderColor: ctx.colors2024['neutral-line'],
    // borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    alignItems: 'center',
    width: '100%',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },

  headerTitle: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },

  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
    // marginBottom: 4,
  },
  itemContainer: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    paddingVertical: 6,
    justifyContent: 'space-between',
  },
  itemContainerLink: {
    alignItems: 'center',
    flexShrink: 1,
    paddingVertical: 6,
  },
  flexWrap: {
    flexWrap: 'wrap',
    width: '100%',
    flexDirection: 'row',
    columnGap: 12,
    alignItems: 'flex-start',
  },
  itemIssuePadding: {
    paddingVertical: 0,
  },
  itemIssuerContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
    alignItems: 'center',
  },
  horizontalLine: {
    // width: 1,
    flex: 1,
    height: 1,
    backgroundColor: colors2024['neutral-line'],
    // marginHorizontal: 4,
  },
  itemIssuerText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
  },
  itemIssuerTitle: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  token: {
    // display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tokenSymbol: {
    flexShrink: 1,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    flexWrap: 'nowrap',
  },
  contract: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,

    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  titleTexet: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  contentText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  externalLink: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-1'],
    borderRadius: 64,
    padding: 8,
    paddingHorizontal: 10,
  },
  urlText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  icon: {
    width: 14,
    height: 14,
  },
  iconJump: {
    // marginLeft: 6,
  },
}));
