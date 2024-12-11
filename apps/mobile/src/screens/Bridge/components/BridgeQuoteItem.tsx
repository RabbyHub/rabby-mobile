import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import BigNumber from 'bignumber.js';
import {
  SelectedBridgeQuote,
  useSetQuoteVisible,
  useSetSettingVisible,
} from '../hooks';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { AssetAvatar, Tip } from '@/components';
import { QuoteLogo } from './QuoteLogo';
import { createGetStyles, createGetStyles2024 } from '@/utils/styles';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { formatTokenAmount, formatUsdValue } from '@/utils/number';
import RcIconGasCC from '@/assets/icons/swap/gas-cc.svg';
import RcIconLock from '@/assets2024/icons/bridge/IconLock.svg';
import RcIconDurationCC from '@/assets/icons/bridge/duration.svg';
import RcIcHelp from '@/assets2024/icons/bridge/IcHelp.svg';
import RcIconInfoCC from '@/assets/icons/swap/info-outline-cc.svg';
// const ImgLock = require('@/assets/icons/swap/lock.svg');

interface QuoteItemProps extends SelectedBridgeQuote {
  payAmount: string;
  payToken: TokenItem;
  receiveToken: TokenItem;
  isBestQuote?: boolean;
  bestQuoteUsd: string;
  sortIncludeGasFee: boolean;
  setSelectedBridgeQuote?: (quote?: SelectedBridgeQuote) => void;
  onlyShow?: boolean;
  loading?: boolean;
  inSufficient?: boolean;
}

export const bridgeQuoteEstimatedValueBn = (
  quote: SelectedBridgeQuote,
  receiveToken: TokenItem,
  sortIncludeGasFee: boolean,
) => {
  return new BigNumber(quote.to_token_amount)
    .times(receiveToken.price || 1)
    .minus(sortIncludeGasFee ? quote.gas_fee.usd_value : 0);
};

export const BridgeQuoteItem: React.FC<QuoteItemProps> = props => {
  const { styles, colors, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const openBridgeQuote = useSetQuoteVisible();

  const openFeePopup = useSetSettingVisible();

  const diffPercent = React.useMemo(() => {
    if (props.onlyShow || props.isBestQuote) {
      return '';
    }

    const percent = bridgeQuoteEstimatedValueBn(
      props,
      props.receiveToken,
      props.sortIncludeGasFee,
    )
      .minus(props.bestQuoteUsd)
      .div(props.bestQuoteUsd)
      .abs()
      .times(100)
      .toFixed(2, 1)
      .toString();
    return `-${percent}%`;
  }, [props]);

  const handleClick = async () => {
    if (props.inSufficient) {
      return;
    }
    openBridgeQuote(false);
    props?.setSelectedBridgeQuote?.({ ...props, manualClick: true });
  };

  const containerStyle = StyleSheet.flatten([
    styles.container,
    !props.inSufficient && styles.enabledAggregator,
    props.onlyShow
      ? styles.onlyShow
      : props.inSufficient
      ? styles.insufficient
      : styles.normal,
  ]);

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={handleClick}
      disabled={props.inSufficient || props.onlyShow}>
      <View style={styles.topRow}>
        <View style={styles.leftSection}>
          <QuoteLogo
            logo={props.aggregator.logo_url}
            bridgeLogo={props.bridge.logo_url}
            isLoading={props.onlyShow ? false : props.loading}
          />
          <Text style={styles.aggregatorName}>{props.aggregator.name}</Text>
          <Text
            style={styles.bridgeName}
            numberOfLines={1}
            ellipsizeMode="tail">
            {t('page.bridge.via-bridge', { bridge: props.bridge.name })}
          </Text>
          {props.shouldApproveToken && (
            <Tip content={t('page.bridge.need-to-approve-token-before-bridge')}>
              <RcIconLock
                color={colors2024['neutral-foot']}
                style={styles.icon}
              />
              {/* <Image source={RcIconLock} style={styles.icon} /> */}
            </Tip>
          )}
        </View>
        <View style={styles.rightSection}>
          <AssetAvatar size={20} logo={props.payToken.logo_url} />
          <Text
            style={styles.tokenAmount}
            numberOfLines={1}
            ellipsizeMode="tail">
            {formatTokenAmount(props.to_token_amount)}
          </Text>
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.feeSection}>
          <RcIconGasCC style={styles.icon} color={colors['neutral-foot']} />
          <Text style={styles.feeText}>
            {formatUsdValue(props.gas_fee.usd_value)}
          </Text>

          <RcIconDurationCC
            color={colors['neutral-foot']}
            style={[styles.icon, styles.durationIcon]}
          />
          <Text style={styles.feeText}>
            {t('page.bridge.duration', {
              duration: Math.ceil(props.duration / 60),
            })}
          </Text>
        </View>
        <View
          style={styles.estimatedValueSection}
          onStartShouldSetResponder={() => true}>
          <Text
            style={[styles.estimatedValueText, { flex: 1 }]}
            numberOfLines={1}>
            {'≈ '}
            {formatUsdValue(
              new BigNumber(props.to_token_amount)
                .times(props.receiveToken.price)
                .toString(),
            )}
          </Text>
          <TouchableOpacity
            onPress={e => {
              e.stopPropagation();
              openFeePopup(true);
            }}>
            <RcIcHelp color={colors2024['neutral-info']} />
            {/* <RcIconInfoCC
              style={styles.infoIcon}
              color={colors['neutral-foot']}
            /> */}
          </TouchableOpacity>
        </View>
      </View>

      {!props.onlyShow && (
        <View
          style={[
            styles.badge,
            props.isBestQuote ? styles.bestBadge : styles.diffBadge,
          ]}>
          <Text
            style={
              props.isBestQuote ? styles.bestQuoteText : styles.otherQuoteText
            }>
            {props.isBestQuote ? t('page.bridge.best') : diffPercent}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors, colors2024 }) => ({
  container: {
    flexDirection: 'column',
    justifyContent: 'center',
    borderRadius: 24,
    padding: 16,
    paddingTop: 20,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    height: 116,
  },
  enabledAggregator: {},
  onlyShow: {
    // backgroundColor: 'transparent',
    height: 'auto',
    padding: 0,
    paddingTop: 0,
  },
  insufficient: {
    // backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors['neutral-line'],
  },
  normal: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderWidth: 1,
    borderColor: colors['neutral-line'],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'flex-end',
    flexShrink: 1,
  },
  aggregatorName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors['neutral-title1'],
  },
  bridgeName: {
    fontSize: 13,
    color: colors['neutral-foot'],
    flexShrink: 0,
  },
  icon: {
    width: 16,
    height: 16,
  },
  tokenAmount: {
    fontSize: 16,
    fontWeight: '500',
    color: colors['neutral-title1'],
    flexShrink: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    marginTop: 12,
  },
  feeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  feeText: {
    fontSize: 13,
    color: colors['neutral-foot'],
    marginLeft: 4,
  },
  durationIcon: {
    marginLeft: 8,
  },
  estimatedValueSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 1,
    justifyContent: 'flex-end',
  },
  estimatedValueText: {
    textAlign: 'right',
    fontSize: 13,
    color: colors['neutral-foot'],
  },

  infoIcon: {
    width: 14,
    height: 14,
    tintColor: colors['neutral-foot'],
  },
  badge: {
    position: 'absolute',
    top: -1,
    left: 24,
    borderRadius: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  bestBadge: {
    backgroundColor: colors2024['green-light-4'],
  },
  diffBadge: {
    backgroundColor: colors2024['red-light-1'],
  },

  bestQuoteText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    color: colors['green-default'],
  },
  otherQuoteText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    color: colors['red-default'],
  },
}));
