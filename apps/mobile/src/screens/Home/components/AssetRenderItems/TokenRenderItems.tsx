import React, { memo, ReactNode, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

import RcFoldCC from '@/assets2024/icons/common/fold.svg';
import RcUnFoldCC from '@/assets2024/icons/common/unfold.svg';
import RcTipCC from '@/assets2024/icons/common/warning-circle-cc.svg';
import RcNextRightCC from '@/assets/icons/common/arrow-right-cc.svg';
import { AssetAvatar } from '@/components/AssetAvatar';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeTriangleStyle } from '@/utils/styles';
import { AbstractPortfolioToken } from '../../types';
import {
  ContextMenuView,
  MenuAction,
} from '@/components2024/ContextMenuView/ContextMenuView';
import { trigger } from 'react-native-haptic-feedback';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { TextBadge } from '@/screens/Address/components/PinBadge';
import { ASSETS_SECTION_HEADER } from '@/constant/layout';
import { IS_ANDROID } from '@/core/native/utils';
import { getTokenSymbol } from '@/utils/token';
import {
  TokenItem,
  TokenItemWithEntity,
} from '@rabby-wallet/rabby-api/dist/types';
import { formatPrice, formatTokenAmount, formatUsdValue } from '@/utils/number';
import { formatUsdValueKMB } from '../../utils/price';
import { ellipsisAddress } from '@/utils/address';
import { ExchangeLogos } from './ExchangeLogos';
import { useCexSupportList } from '@/hooks/useCexSupportList';
import { formatNetworth } from '@/utils/math';
import BigNumber from 'bignumber.js';
import { useCurrency } from '@/hooks/useCurrency';
import { StyleProp } from 'react-native';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { AccountOverview } from '../AccountOverview';
import { formatAmount } from '@/utils/number';
import { ITokenItem } from '@/store/tokens';
import { isLpToken } from '@/utils/lpToken';
import LpTokenIcon from '../LpTokenIcon';
import LpTokenSwitch from '../LpTokenSwitch';

export const formatPercentage = (x: number) => {
  if (Math.abs(x) < 0.00001) {
    return '0%';
  }
  const percentage = (x * 100).toFixed(2);
  return `${x >= 0 ? '+' : ''}${percentage}%`;
};

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

export const TokenRow = memo(
  ({
    data,
    style,
    logoSize = 40,
    chainLogoSize = 16,
    logoStyle,
    getMenuActions,
    onTokenPress,
    hideFoldTag,
    disableMenu,
    account,
  }: {
    data: AbstractPortfolioToken;
    style?: ViewStyle;
    logoStyle?: ViewStyle;
    logoSize?: number;
    chainLogoSize?: number;
    getMenuActions?: (token: AbstractPortfolioToken) => MenuAction[];
    hideFoldTag?: boolean;
    disableMenu?: boolean;
    onTokenPress?(token: AbstractPortfolioToken): void;
    account?: KeyringAccountWithAlias;
  }) => {
    const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
    const { t } = useTranslation();
    const [showContextMenu, setShowContextMenu] = React.useState(IS_ANDROID);
    const { currency } = useCurrency();
    const showAccount = !!account;
    const percentColor = useMemo(() => {
      if (
        !data?.price_24h_change ||
        Math.abs(Number(data.price_24h_change)) < 0.00001
      ) {
        return colors2024['neutral-secondary'];
      }
      if (Number(data.price_24h_change) > 0) {
        return colors2024['green-default'];
      }
      return colors2024['red-default'];
    }, [colors2024, data.price_24h_change]);

    const mediaStyle = useMemo(
      () => StyleSheet.flatten([styles.tokenRowLogo, logoStyle]),
      [logoStyle, styles.tokenRowLogo],
    );

    const onPressToken = useCallback(() => {
      return onTokenPress?.(data);
    }, [data, onTokenPress]);

    const handleShowExcludeTips = useCallback(() => {
      const modalId = createGlobalBottomSheetModal2024({
        name: MODAL_NAMES.DESCRIPTION,
        title: t('page.tokenDetail.excludeBalanceTips'),
        sections: [],
        bottomSheetModalProps: {
          enableContentPanningGesture: true,
          enablePanDownToClose: true,
          enableDismissOnClose: true,
          snapPoints: ['40%'],
        },
        nextButtonProps: {
          title: (
            <Text style={styles.modalNextButtonText}>
              {t('page.tokenDetail.excludeBalanceTipsButton')}
            </Text>
          ),
          titleStyle: StyleSheet.flatten([styles.modalNextButtonText]),
          onPress: () => {
            removeGlobalBottomSheetModal2024(modalId);
          },
        },
      });
    }, [styles.modalNextButtonText, t]);
    const children = useMemo(() => {
      const amountContent = data._priceStr ? (
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={styles.amountStr}>{`${data._amountStr} ${data.symbol}`}</Text>
      ) : null;

      return (
        <TouchableOpacity
          style={StyleSheet.flatten([styles.tokenRowWrap, style])}
          delayLongPress={200}
          onLongPress={() => {
            if (disableMenu) {
              return;
            }
            setShowContextMenu(true);
            trigger('impactLight', {
              enableVibrateFallback: true,
              ignoreAndroidSystemSettings: false,
            });
          }}
          onPress={onPressToken}>
          <View style={styles.tokenRowTokenWrap}>
            <View>
              <AssetAvatar
                logo={data?.logo_url}
                chain={data?.chain}
                style={mediaStyle}
                size={logoSize}
                chainSize={chainLogoSize}
              />
            </View>
            <View style={styles.tokenRowTokenInner}>
              <View style={styles.tokenHeader}>
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={styles.tokenSymbol}>
                  {data.symbol}
                </Text>
                {!hideFoldTag && data._isManualFold && (
                  <TextBadge type="folded" />
                )}
              </View>

              {showAccount ? (
                <AccountOverview account={account} />
              ) : (
                amountContent
              )}
            </View>
          </View>

          <View style={styles.tokenRowUsdValueWrap}>
            <Text
              style={[
                data._amountStr
                  ? styles.tokenRowAmount
                  : styles.tokenRowUsdValue,
                data._isExcludeBalance &&
                  (data._usdValue || 0) > 0 &&
                  styles.exclude,
              ]}>
              {formatNetworth(
                new BigNumber(data._usdValue || 0)
                  .times(currency.usd_rate)
                  .toNumber(),
                false,
                currency.symbol,
              )}
            </Text>
            {showAccount ? (
              <Text
                style={StyleSheet.compose(styles.percent, {
                  ...(data._isExcludeBalance && (data._usdValue || 0) > 0
                    ? styles.exclude
                    : {}),
                  color: percentColor,
                })}>
                {formatPercentage(Number(data.price_24h_change) || 0)}
              </Text>
            ) : data._isExcludeBalance && (data._usdValue || 0) > 0 ? (
              <TouchableOpacity
                hitSlop={hitSlop}
                onPress={handleShowExcludeTips}>
                <RcTipCC
                  style={styles.tips}
                  color={colors2024['neutral-info']}
                />
              </TouchableOpacity>
            ) : data._amountStr ? (
              <Text
                style={StyleSheet.compose(styles.percent, {
                  ...(data._isExcludeBalance && (data._usdValue || 0) > 0
                    ? styles.exclude
                    : {}),
                  color: percentColor,
                })}>
                {formatPercentage(Number(data.price_24h_change) || 0)}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
      );
    }, [
      data._priceStr,
      data._amountStr,
      data.symbol,
      data?.logo_url,
      data?.chain,
      data._isManualFold,
      data._isExcludeBalance,
      data._usdValue,
      data.price_24h_change,
      styles,
      style,
      onPressToken,
      mediaStyle,
      logoSize,
      chainLogoSize,
      hideFoldTag,
      showAccount,
      account,
      currency.usd_rate,
      currency.symbol,
      handleShowExcludeTips,
      colors2024,
      percentColor,
      disableMenu,
    ]);
    if (disableMenu) {
      return children;
    }

    return (
      <ContextMenuView
        menuConfig={{
          menuActions:
            showContextMenu && getMenuActions ? getMenuActions(data) : [],
        }}
        preViewBorderRadius={12}
        triggerProps={{ action: 'longPress' }}>
        {children}
      </ContextMenuView>
    );
  },
);

export const TokenRowV2 = memo(
  ({
    data,
    style,
    logoSize = 40,
    chainLogoSize = 16,
    logoStyle,
    onTokenPress,
    account,
    scene = 'default',
  }: {
    data: ITokenItem;
    style?: ViewStyle;
    logoStyle?: ViewStyle;
    logoSize?: number;
    chainLogoSize?: number;
    getMenuActions?: (token: ITokenItem) => MenuAction[];
    hideFoldTag?: boolean;
    disableMenu?: boolean;
    onTokenPress?(token: ITokenItem): void;
    account?: KeyringAccountWithAlias;
    scene?: 'default' | 'portfolio'; // portfolio 适用于展示用户拥有的资产，比如资产页、用户持有 token 的选择器
  }) => {
    const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
    const { t } = useTranslation();
    const { currency } = useCurrency();
    const showAccount = !!account;
    const percentColor = useMemo(() => {
      if (
        !data?.price_24h_change ||
        Math.abs(Number(data.price_24h_change)) < 0.00001
      ) {
        return colors2024['neutral-secondary'];
      }
      if (Number(data.price_24h_change) > 0) {
        return colors2024['green-default'];
      }
      return colors2024['red-default'];
    }, [colors2024, data.price_24h_change]);

    const mediaStyle = useMemo(
      () => StyleSheet.flatten([styles.tokenRowLogo, logoStyle]),
      [logoStyle, styles.tokenRowLogo],
    );

    const onPressToken = useCallback(() => {
      return onTokenPress?.(data);
    }, [data, onTokenPress]);

    const handleShowExcludeTips = useCallback(() => {
      const modalId = createGlobalBottomSheetModal2024({
        name: MODAL_NAMES.DESCRIPTION,
        title: t('page.tokenDetail.excludeBalanceTips'),
        sections: [],
        bottomSheetModalProps: {
          enableContentPanningGesture: true,
          enablePanDownToClose: true,
          enableDismissOnClose: true,
          snapPoints: ['40%'],
        },
        nextButtonProps: {
          title: (
            <Text style={styles.modalNextButtonText}>
              {t('page.tokenDetail.excludeBalanceTipsButton')}
            </Text>
          ),
          titleStyle: StyleSheet.flatten([styles.modalNextButtonText]),
          onPress: () => {
            removeGlobalBottomSheetModal2024(modalId);
          },
        },
      });
    }, [styles.modalNextButtonText, t]);

    const amountContent = (
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={styles.amountStr}>{`${formatAmount(data.amount)} ${
        data.symbol
      }`}</Text>
    );

    return (
      <TouchableOpacity
        style={StyleSheet.flatten([styles.tokenRowWrap, style])}
        delayLongPress={200}
        onPress={onPressToken}>
        <View style={styles.tokenRowTokenWrap}>
          <View>
            <AssetAvatar
              logo={data?.logo_url}
              chain={data?.chain}
              style={mediaStyle}
              size={logoSize}
              chainSize={chainLogoSize}
            />
          </View>
          <View style={styles.tokenRowTokenInner}>
            <View style={styles.tokenHeader}>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={styles.tokenSymbol}>
                {data.symbol}
              </Text>
              {isLpToken(data) && (
                <LpTokenIcon protocolId={data.protocol_id || ''} />
              )}
            </View>
            {showAccount ? (
              <AccountOverview account={account} />
            ) : (
              amountContent
            )}
          </View>
        </View>

        <View style={styles.tokenRowUsdValueWrap}>
          <Text
            style={[
              styles.tokenRowAmount,
              scene === 'portfolio' && !data.is_core ? styles.exclude : null,
            ]}>
            {formatNetworth(
              new BigNumber(data.usd_value || 0)
                .times(currency.usd_rate)
                .toNumber(),
              false,
              currency.symbol,
            )}
          </Text>
          {showAccount ? (
            <View style={styles.priceInfo}>
              <Text style={styles.price}>{`@$${formatPrice(data.price)}`}</Text>
              <Text
                style={StyleSheet.compose(styles.percent, {
                  ...(!data.is_core && (data.usd_value || 0) > 0
                    ? styles.exclude
                    : {}),
                  color: percentColor,
                })}>
                {formatPercentage(Number(data.price_24h_change) || 0)}
              </Text>
            </View>
          ) : scene === 'portfolio' ? (
            <View style={styles.priceInfo}>
              <Text style={styles.price}>{`@$${formatPrice(data.price)}`}</Text>
              <Text
                style={StyleSheet.compose(styles.percent, {
                  ...(!data.is_core && (data.usd_value || 0) > 0
                    ? styles.exclude
                    : {}),
                  color: percentColor,
                })}>
                {formatPercentage(Number(data.price_24h_change) || 0)}
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  },
);

const Container = ({
  touchable,
  children,
  ...props
}: {
  touchable: boolean;
  children: ReactNode;
  style?: ViewStyle;
  delayLongPress?: number;
  onPress(): void;
}) => {
  if (touchable) {
    return <TouchableOpacity {...props}>{children}</TouchableOpacity>;
  }
  return <View {...props}>{children}</View>;
};

export const ExternalTokenRow = memo(
  ({
    data,
    style,
    logoSize = 40,
    chainLogoSize = 18,
    logoStyle,
    onTokenPress,
    touchable = true,
    decimalPrecision = false,
    rightSlot,
    onPressRightIcon,
    afterNode,
  }: {
    data: ITokenItem | TokenItem | TokenItemWithEntity;
    style?: StyleProp<ViewStyle>;
    logoStyle?: ViewStyle;
    fold?: boolean;
    logoSize?: number;
    chainLogoSize?: number;
    onTokenPress?(token: ITokenItem | TokenItem | TokenItemWithEntity): void;
    touchable?: boolean;
    decimalPrecision?: boolean;
    rightSlot?: ReactNode;
    onPressRightIcon?(): void;
    afterNode?: ReactNode;
  }) => {
    const { t } = useTranslation();
    const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

    const mediaStyle = useMemo(
      () => StyleSheet.flatten([styles.tokenRowLogo, logoStyle]),
      [logoStyle, styles.tokenRowLogo],
    );

    const isGasToken = useMemo(() => data.id === data.chain, [data]);
    const { list: cexList } = useCexSupportList();

    const onPressToken = useCallback(() => {
      return onTokenPress?.(data);
    }, [data, onTokenPress]);

    const fdv = useMemo(() => {
      const d = data as TokenItemWithEntity;
      if (d.identity?.fdv) {
        return d.identity?.fdv;
      }
      return data.fdv || 0;
    }, [data]);

    const ExtraContent = useMemo(() => {
      const notVerified = data.is_verified === false;
      const isSuspicious = data.is_suspicious;
      return (
        <Pressable
          onPress={e => {
            if (onPressRightIcon) {
              e.stopPropagation();
              onPressRightIcon?.();
            } else {
              onPressToken?.();
            }
          }}
          style={styles.searchTokenExtraInfo}>
          <View style={styles.bubbleArrow} />
          <View style={styles.leftSection}>
            {isGasToken ? (
              <View style={styles.gasBadgeTextRoot}>
                <Text style={styles.gasBadgeText}>{'Gas Token'}</Text>
              </View>
            ) : (
              <Text
                style={styles.searchSubText}
                numberOfLines={1}
                ellipsizeMode="tail">
                {'FDV'}
                <Text style={styles.fdvValue}>
                  {':'}
                  {fdv ? formatUsdValueKMB(fdv || 0) : ' -'}
                </Text>
              </Text>
            )}
            {!isGasToken &&
              Boolean(
                (data as TokenItemWithEntity)?.identity?.token_id || data.id,
              ) && <View style={styles.verticalLine} />}
            {!isGasToken &&
              Boolean(
                (data as TokenItemWithEntity)?.identity?.token_id || data.id,
              ) && (
                <View style={styles.tokenRowContent}>
                  <Text style={styles.caValue}>
                    {'CA'}
                    <Text style={styles.caValueText}>
                      {':'}
                      {ellipsisAddress(
                        (data as TokenItemWithEntity)?.identity?.token_id ||
                          data.id,
                      )}
                    </Text>
                  </Text>
                </View>
              )}
          </View>
          <View style={styles.rightSection}>
            {!!(notVerified || isSuspicious) && (
              <View>
                <RcTipCC
                  style={styles.tips}
                  color={
                    notVerified
                      ? colors2024['red-default']
                      : colors2024['orange-default']
                  }
                />
              </View>
            )}
            <View>
              <RcNextRightCC
                width={14}
                height={14}
                style={styles.tips}
                color={
                  notVerified
                    ? colors2024['red-default']
                    : isSuspicious
                    ? colors2024['orange-default']
                    : colors2024['neutral-title-1']
                }
              />
            </View>
          </View>
        </Pressable>
      );
    }, [
      data,
      styles.searchTokenExtraInfo,
      styles.bubbleArrow,
      styles.leftSection,
      styles.gasBadgeTextRoot,
      styles.gasBadgeText,
      styles.searchSubText,
      styles.fdvValue,
      styles.verticalLine,
      styles.tokenRowContent,
      styles.caValue,
      styles.caValueText,
      styles.rightSection,
      styles.tips,
      isGasToken,
      fdv,
      colors2024,
      onPressRightIcon,
      onPressToken,
    ]);
    const isPositive = useMemo(
      () => (data.price_24h_change || 0) >= 0,
      [data.price_24h_change],
    );

    return (
      <Container
        style={StyleSheet.flatten([styles.tokenRowWrap, style])}
        touchable={touchable}
        delayLongPress={200}
        onPress={onPressToken}>
        <View style={styles.serachTokenRowTokenWrap}>
          <View style={styles.serachTokenContent}>
            <AssetAvatar
              logo={data?.logo_url}
              chain={data?.chain}
              style={mediaStyle}
              size={logoSize}
              chainSize={chainLogoSize}
              innerChainStyle={styles.chainLogo}
            />
            <View style={styles.searchTokenRowTokenInner}>
              <View style={[styles.colContent, styles.leftColContent]}>
                <View style={styles.tokenHeader}>
                  <Text
                    style={styles.tokenSymbol}
                    numberOfLines={1}
                    ellipsizeMode="tail">
                    {getTokenSymbol(data)}
                  </Text>
                  {isLpToken(data) && (
                    <View style={styles.lpTokenIconContainer}>
                      <LpTokenIcon protocolId={data?.protocol_id || ''} />
                    </View>
                  )}
                  <ExchangeLogos
                    logos={
                      data.cex_ids?.length
                        ? data.cex_ids
                            .map(
                              id =>
                                cexList.find(item => item.id === id)
                                  ?.logo_url || '',
                            )
                            .filter(i => !!i) || []
                        : (data as TokenItemWithEntity).identity?.cex_list?.map(
                            item => item.logo_url,
                          ) || []
                    }
                  />
                </View>
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[
                    styles.tokenHeaderAmount,
                    // isExcludeBalanceShowTips && styles.textSecondary,
                  ]}>
                  {formatTokenAmount(data.amount)} {data.symbol}
                </Text>
              </View>
              <View style={styles.colContent}>
                <Text style={styles.tokenRowAmount}>
                  {formatNetworth(data.usd_value || 0)}
                </Text>
                <View style={styles.priceInfo}>
                  <Text style={styles.usdValue}>
                    @{decimalPrecision ? '$' : ''}
                    {(decimalPrecision ? formatPrice : formatUsdValue)(
                      data.price || 0,
                    )}
                  </Text>
                  {typeof data.price_24h_change === 'number' && (
                    <Text
                      style={StyleSheet.flatten([
                        styles.changeText,
                        !isPositive && styles.changeTextPositive,
                      ])}>
                      {formatPercentage(Number(data.price_24h_change) || 0)}
                    </Text>
                  )}
                </View>
              </View>
            </View>
            {rightSlot}
          </View>

          {ExtraContent}

          {afterNode || null}
        </View>
      </Container>
    );
  },
);

export const TokenRowSectionHeader = memo(
  ({
    str,
    fold,
    style,
    buttonStyle,
    onPressFold,
  }: {
    str?: string | null;
    fold?: boolean;
    style?: ViewStyle;
    buttonStyle?: ViewStyle;
    onPressFold?(): void;
  }) => {
    const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
    const { t } = useTranslation();

    return (
      <View style={[styles.tokenSectionHeader, style]}>
        <View style={styles.tokenRowTokenWrap}>
          <View style={styles.tokenRowTokenInner}>
            <TouchableOpacity
              onPress={onPressFold}
              style={[styles.tokenRowTokenInnerSmallToken, buttonStyle]}>
              <Text style={styles.actionText}>
                {fold
                  ? t('page.tokenDetail.action.all')
                  : t('page.tokenDetail.action.less')}
              </Text>
              {fold ? (
                <RcUnFoldCC
                  style={styles.arrow}
                  color={colors2024['neutral-secondary']}
                />
              ) : (
                <RcFoldCC
                  style={styles.arrow}
                  color={colors2024['neutral-secondary']}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.tokenRowUsdValueWrap}>
          <Text style={styles.tokenRowUsdValue}>{str}</Text>
        </View>
      </View>
    );
  },
);

export const TokenRowSectionLpTokenHeader = memo(
  ({
    str,
    isEnabled,
    onValueChange,
    fold,
    style,
    buttonStyle,
    onPressFold,
  }: {
    str?: string | null;
    isEnabled: boolean;
    onValueChange: (value: boolean) => void;
    fold?: boolean;
    style?: ViewStyle;
    buttonStyle?: ViewStyle;
    onPressFold?(): void;
  }) => {
    const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
    const { t } = useTranslation();

    return (
      <View style={[styles.tokenSectionHeader, style]}>
        <View style={styles.tokenRowTokenWrap}>
          <View style={styles.tokenRowTokenInner}>
            <TouchableOpacity
              onPress={onPressFold}
              style={[styles.tokenRowTokenInnerSmallToken, buttonStyle]}>
              <Text style={styles.actionText}>
                {fold
                  ? t('page.tokenDetail.action.all')
                  : t('page.tokenDetail.action.less')}
              </Text>
              {fold ? (
                <RcUnFoldCC
                  style={styles.arrow}
                  color={colors2024['neutral-secondary']}
                />
              ) : (
                <RcFoldCC
                  style={styles.arrow}
                  color={colors2024['neutral-secondary']}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
        {fold ? (
          <View style={styles.tokenRowUsdValueWrap}>
            <Text style={styles.tokenRowUsdValue}>{str}</Text>
          </View>
        ) : (
          <LpTokenSwitch isEnabled={isEnabled} onValueChange={onValueChange} />
        )}
      </View>
    );
  },
);

const getStyles = createGetStyles2024(ctx => ({
  tokenRowWrap: {
    // height: ASSETS_ITEM_HEIGHT_NEW,
    width: '100%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-1']
      : ctx.colors2024['neutral-bg-2'],
    borderRadius: 16,
    paddingLeft: 12,
    paddingRight: 16,
  },
  tokenSectionHeader: {
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: ASSETS_SECTION_HEADER,
    paddingRight: 16 + 8,
    paddingLeft: 16,
  },
  serachTokenContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  chainLogo: {
    borderWidth: 1.5,
    borderColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-1']
      : ctx.colors2024['neutral-bg-2'],
  },
  serachTokenRowTokenWrap: {
    flexShrink: 1,
    // flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
    // paddingLeft: 12,
    // paddingRight: 16,
    // height: '100%',
    width: '100%',
  },
  tokenRowTokenWrap: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    maxWidth: '70%',
  },
  tokenHeader: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
    // overflow: 'hidden',
  },
  tokenSymbol: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    maxWidth: 150,
    // ...makeDebugBorder(),
  },
  lpTokenIconContainer: {
    marginLeft: 0,
    flexShrink: 0,
    justifyContent: 'flex-start',
  },
  priceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  usdValue: {
    color: ctx.colors2024['neutral-secondary'],
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
  tokenRowLogo: {
    marginRight: 12,
  },
  smallTokenRowLogo: {
    marginRight: 12,
    width: 40,
    height: 40,
  },
  tokenRowTokenInner: {
    flexShrink: 1,
    justifyContent: 'center',
    gap: 2,
  },
  searchTokenExtraInfo: {
    flex: 1,
    justifyContent: 'space-between',
    flexDirection: 'row',
    width: '100%',
    padding: 8,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-2']
      : ctx.colors2024['neutral-bg-1'],
    borderRadius: 8,
    // marginTop: 12,
    position: 'relative',
  },
  bubbleArrow: {
    position: 'absolute',
    top: -12,
    left: 44,
    ...makeTriangleStyle({
      dir: 'up',
      size: 6.5,
      color: ctx.isLight
        ? ctx.colors2024['neutral-bg-2']
        : ctx.colors2024['neutral-bg-1'],
      backgroundColor: 'transparent',
    }),
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchTokenRowTokenInner: {
    // flexShrink: 1,
    flex: 1,
    justifyContent: 'space-between',
    flexDirection: 'row',
    width: '100%',
    // gap: 8,
  },
  colContent: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 0,
    flex: 0,
  },
  tokenHeaderAmount: {
    color: ctx.colors2024['neutral-secondary'],
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    width: '100%',
    maxWidth: '100%',
    fontFamily: 'SF Pro Rounded',
  },
  leftColContent: {
    maxWidth: '70%',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    flex: 1,
    overflow: 'hidden',
  },
  verticalLine: {
    width: 1,
    height: 12,
    backgroundColor: ctx.colors2024['neutral-secondary'],
    marginHorizontal: 4,
  },
  siteList: {
    gap: 4,
    flexDirection: 'row',
  },
  gasBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    color: ctx.colors2024['brand-default'],
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  gasBadgeTextRoot: {
    // flexShrink: 1,
    width: 70,
    marginTop: 2,
    borderRadius: 6,
    backgroundColor: ctx.colors2024['brand-light-1'],
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
    flexWrap: 'nowrap',
  },
  tokenRowTokenInnerSmallToken: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 36,
    width: 100,
    justifyContent: 'center',
    borderRadius: 100,
    display: 'flex',
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-1']
      : ctx.colors2024['neutral-bg-2'],
  },
  actionText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-body'],
  },
  amountStr: {
    marginTop: 2,
    color: ctx.colors2024['neutral-secondary'],
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
  },
  searchSubText: {
    color: ctx.colors2024['neutral-secondary'],
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
  },
  fdvValue: {
    color: ctx.colors2024['neutral-title-1'],
  },
  tokenRowUsdValueWrap: {
    flexShrink: 0,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  tokenRowAmount: {
    marginBottom: 2,
    textAlign: 'right',
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  searchAmountStr: {
    color: ctx.colors2024['neutral-secondary'],
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    marginTop: 2,
    textAlign: 'right',
    maxWidth: 100,
  },
  searchTokenIssuedby: {
    color: ctx.colors2024['neutral-secondary'],
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
  searchTokenDomain: {
    color: ctx.colors2024['neutral-body'],
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
  searchTokenWarningText: {
    color: ctx.colors2024['orange-default'],
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
  },
  searchTokenDangerText: {
    color: ctx.colors2024['red-default'],
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
  },
  tokenRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  caValue: {
    color: ctx.colors2024['neutral-secondary'],
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
  },
  caValueText: {
    color: ctx.colors2024['neutral-title-1'],
  },
  searchTokenDanger: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
    width: '100%',
    padding: 8,
    backgroundColor: ctx.colors2024['red-light-1'],
    borderRadius: 8,
    marginTop: 12,
  },
  searchTokenWarning: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
    width: '100%',
    padding: 8,
    backgroundColor: ctx.colors2024['orange-light-1'],
    borderRadius: 8,
    marginTop: 12,
  },
  highlightText: {
    color: ctx.colors2024['brand-default'],
  },
  exclude: {
    color: ctx.colors2024['neutral-info'],
  },
  tokenRowUsdValue: {
    textAlign: 'right',
    color: ctx.colors2024['neutral-foot'],
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
  tips: {
    width: 14,
    height: 14,
  },
  price: {
    color: ctx.colors2024['neutral-secondary'],
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
  percent: {
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
  },
  smallTokenSymbol: {
    color: ctx.colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    width: 'auto',
  },
  arrow: {
    width: 10,
    height: 8,
  },
  modalNextButtonText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
    color: ctx.colors2024['neutral-InvertHighlight'],
    backgroundColor: ctx.colors2024['brand-default'],
  },
  changeText: {
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 18,
    color: ctx.colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
  changeTextPositive: {
    color: ctx.colors2024['red-default'],
  },
}));
