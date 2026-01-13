/* eslint-disable react-native/no-inline-styles */
import React, { useCallback, useMemo, useState } from 'react';
import { TouchableOpacity, View, Text } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

import IconBridgeTo from '@/assets2024/icons/search/IconBridgeTo.svg';
import IconOrigin from '@/assets2024/icons/search/IconOrigin.svg';
import RcIconJumpCC from '@/assets2024/icons/history/IconJumpCC.svg';
import RcIconRightCC from '@/assets2024/icons/history/IconRightArrowCC.svg';
import { AssetAvatar } from '@/components';
import { useTranslation } from 'react-i18next';
import { getTokenSymbol, tokenItemToITokenItem } from '@/utils/token';
import { TokenEntityDetail } from '@rabby-wallet/rabby-api/dist/types';
import { openExternalUrl } from '@/core/utils/linking';
import { Skeleton } from '@rneui/themed';
import { LoadingLinear } from './TokenPriceChart/LoadingLinear';
import { ellipsisOverflowedText } from '@/utils/text';
import { RootNames } from '@/constant/layout';
import { naviPush } from '@/utils/navigation';
import { KeyringAccountWithAlias } from '@/hooks/account';

interface Props {
  tokenEntity?: TokenEntityDetail;
  entityLoading: boolean;
  account?: KeyringAccountWithAlias | null;
}

const DomainUrlLink = ({
  url,
  name,
  logo_url,
}: {
  url: string;
  name: string;
  logo_url?: string;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const handlePress = useCallback(() => {
    url && openExternalUrl(url);
  }, [url]);

  return (
    <TouchableOpacity style={styles.externalLink} onPress={handlePress}>
      {logo_url && <AssetAvatar logo={logo_url} size={16} />}
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

const ExpandableDescription = ({
  description,
  entityLoading,
  tags,
}: {
  description: string;
  entityLoading: boolean;
  tags?: string[];
}) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldTruncate, setShouldTruncate] = useState(false);
  const [textToShow, setTextToShow] = useState(description);
  const [hasCalculated, setHasCalculated] = useState(false);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  // When description changes, reset the calculation state
  React.useEffect(() => {
    setHasCalculated(false);
    setTextToShow(description);
    setShouldTruncate(false);
  }, [description]);

  // Handle text layout, detect if it exceeds 2 lines
  const handleTextLayout = useCallback(
    (event: any) => {
      // Avoid duplicate calculations
      if (hasCalculated) {
        return;
      }

      const { lines } = event.nativeEvent;
      if (lines.length > 2) {
        setShouldTruncate(true);
        // Use the first two lines of text, and leave space for the "Show more" button
        const firstTwoLinesText = lines
          .slice(0, 2)
          .map((line: any) => line.text)
          .join('');
        // Leave space for the "Show more" button at the end of the second line
        const showMoreSpace = 15;
        const truncatedLength = Math.max(
          firstTwoLinesText.length - showMoreSpace,
          0,
        );
        setTextToShow(description.substring(0, truncatedLength) + '...');
      } else {
        setShouldTruncate(false);
        setTextToShow(description);
      }
      setHasCalculated(true);
    },
    [description, hasCalculated],
  );

  const tagNamesContent = useMemo(() => {
    return tags?.length && tags?.length > 0 ? (
      <View style={[styles.tagContainer, { marginTop: description ? 16 : 0 }]}>
        {tags?.map(item => {
          return (
            <Text style={styles.tagText} key={item}>
              {item}
            </Text>
          );
        })}
      </View>
    ) : null;
  }, [description, styles.tagContainer, styles.tagText, tags]);

  const hasData = useMemo(() => {
    return description || (tags?.length && tags?.length > 0);
  }, [description, tags]);

  // If the outer layer is loading, display the title and skeleton
  if (entityLoading && !hasData) {
    return null;
    // return (
    //   <>
    //     <View style={styles.header}>
    //       <Text style={styles.headerTitle}>
    //         {t('page.tokenDetail.Introduction')}
    //       </Text>
    //     </View>
    //     <Skeleton
    //       width={'100%'}
    //       height={68}
    //       style={styles.skeleton}
    //       LinearGradientComponent={LoadingLinear}
    //     />
    //   </>
    // );
  }

  if (!hasData) {
    return null;
  }

  if (hasData && !description) {
    return (
      <>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {t('page.tokenDetail.Introduction')}
          </Text>
        </View>
        <View style={{ ...styles.itemCard, ...styles.tagsContainer }}>
          {tagNamesContent}
        </View>
      </>
    );
  }

  if (isExpanded) {
    return (
      <>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {t('page.tokenDetail.Introduction')}
          </Text>
        </View>
        <View style={{ ...styles.itemCard, ...styles.descriptionContainer }}>
          <Text style={styles.introductionText}>
            {description}
            <Text
              style={styles.moreButtonText}
              onPress={toggleExpanded}
              suppressHighlighting={true}>
              {' '}
              {t('page.tokenDetail.Fold')}
            </Text>
          </Text>
          {tagNamesContent}
          <View
            style={{
              ...styles.horizontalLine,
              backgroundColor: isLight
                ? colors2024['neutral-bg-2']
                : colors2024['neutral-line'],
            }}
          />
          <Text style={styles.contentBottomText}>
            {t('page.tokenDetail.ContentGeneratedByAI')}
          </Text>
        </View>
      </>
    );
  }

  // Calculated show loading
  if (!hasCalculated && !isExpanded) {
    return (
      <>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {t('page.tokenDetail.Introduction')}
          </Text>
        </View>
        <View style={{ ...styles.itemCard, ...styles.descriptionContainer }}>
          {/* Hidden measurement text */}
          <Text
            style={[
              styles.introductionText,
              { opacity: 0, position: 'absolute' },
            ]}
            onTextLayout={handleTextLayout}>
            {description}
          </Text>
          {/* Loading placeholder */}
          <View style={styles.loadingPlaceholder} />
        </View>
      </>
    );
  }

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {t('page.tokenDetail.Introduction')}
        </Text>
      </View>
      <View style={{ ...styles.itemCard, ...styles.descriptionContainer }}>
        <Text style={styles.introductionText}>
          {isExpanded ? description : textToShow}
          {shouldTruncate && !isExpanded && (
            <Text
              style={styles.moreButtonText}
              onPress={toggleExpanded}
              suppressHighlighting={true}>
              {' Show more'}
            </Text>
          )}
        </Text>
        {tagNamesContent}
      </View>
    </>
  );
};

export const IssuerAndListSite: React.FC<Props> = ({
  tokenEntity,
  entityLoading,
  account,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const isBridgeDomain =
    tokenEntity?.bridge_ids && tokenEntity.bridge_ids.length > 0;
  const isVerified = tokenEntity?.is_domain_verified;

  return (
    <View style={styles.container}>
      <ExpandableDescription
        description={(tokenEntity as any)?.description ?? ''}
        entityLoading={entityLoading}
        tags={tokenEntity?.tag_ids}
      />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('page.tokenDetail.IssuedBy')}</Text>
      </View>
      {entityLoading && !tokenEntity ? (
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
                      <Text style={styles.itemIssuerText}>
                        {t('page.tokenDetail.BridgeIssue')}
                      </Text>
                      <IconBridgeTo />
                      <View style={styles.horizontalLine} />
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.itemIssuerContainer,
                        { justifyContent: 'center' },
                      ]}>
                      <View style={styles.horizontalLine} />
                      <Text style={styles.itemIssuerText}>
                        {t('page.tokenDetail.OriginIssue')}
                      </Text>
                      <IconOrigin />
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
                  url={`https://${tokenEntity?.domain_id}`}
                  name={tokenEntity?.domain_id}
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
                        token: tokenItemToITokenItem(
                          tokenEntity.origin_token!,
                          '',
                        ),
                        account: account,
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
      {entityLoading && !tokenEntity ? (
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
      {entityLoading && !tokenEntity ? (
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
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    alignItems: 'center',
    width: '100%',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },

  headerTitle: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
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
    width: '100%',
    marginTop: 12,
    marginBottom: 8,
    flex: 1,
    height: 1,
    backgroundColor: colors2024['neutral-line'],
    // marginHorizontal: 4,
  },
  itemIssuerText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
  },
  introductionText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  contentBottomText: {
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
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
    borderRadius: 8,
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
  descriptionContainer: {
    width: '100%',
    paddingVertical: 16,
    gap: 0,
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  tagsContainer: {
    alignItems: 'flex-start',
    width: '100%',
  },
  moreButton: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 8,
  },
  moreButtonText: {
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  textWithMoreContainer: {
    position: 'relative',
    width: '100%',
  },
  inlineMoreButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    paddingLeft: 4,
  },
  loadingPlaceholder: {
    width: '100%',
    height: 40,
  },
  loadingLine1: {
    height: 14,
    backgroundColor: colors2024['neutral-line'],
    borderRadius: 4,
    marginBottom: 8,
    width: '100%',
  },
  loadingLine2: {
    height: 14,
    backgroundColor: colors2024['neutral-line'],
    borderRadius: 4,
    width: '75%',
  },
  tagContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    width: '100%',
    flexWrap: 'wrap',
  },
  tagText: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    backgroundColor: colors2024['neutral-bg-5'],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
}));
