import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import BigNumber from 'bignumber.js';
import { SelectedBridgeQuote, useSetQuoteVisible } from '../hooks';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { AssetAvatar, Tip } from '@/components';
import { QuoteLogo } from './QuoteLogo';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { formatTokenAmount, formatUsdValue } from '@/utils/number';
// import RcIconGasCC from '@/assets/icons/swap/gas-cc.svg';
import RcIconLock from '@/assets2024/icons/bridge/IconLock.svg';
// import RcIconDurationCC from '@/assets/icons/bridge/duration.svg';
import { Text } from '@/components/Typography';

interface QuoteItemProps extends SelectedBridgeQuote {
  payAmount: string;
  payToken: TokenItem;
  receiveToken: TokenItem;
  isBestQuote?: boolean;
  isTopAmount?: boolean;
  bestQuoteUsd: string;
  setSelectedBridgeQuote?: (quote?: SelectedBridgeQuote) => void;
  onlyShow?: boolean;
  loading?: boolean;
  inSufficient?: boolean;
  currentSelectedQuote?: SelectedBridgeQuote;
}

export const bridgeQuoteEstimatedValueBn = (
  quote: SelectedBridgeQuote,
  receiveToken: TokenItem,
) => {
  return new BigNumber(quote.to_token_amount)
    .times(receiveToken.price || 1)
    .minus(quote.gas_fee.usd_value);
};

/**
 * Best 评分公式：score = amount_usd - gas_fee_usd - time_cost_usd
 * 耗时成本每分钟 = amount_usd / 100K，上限 1 美金
 */
export const bridgeQuoteScore = (
  quote: SelectedBridgeQuote,
  receiveToken: TokenItem,
) => {
  const amountUsd = new BigNumber(quote.to_token_amount).times(
    receiveToken.price || 1,
  );
  const gasFeeUsd = new BigNumber(quote.gas_fee.usd_value);
  const durationMinutes = Math.ceil(quote.duration / 60);
  const timeCostUsd = BigNumber.min(
    amountUsd.div(100000).times(durationMinutes),
    1,
  );
  return amountUsd.minus(gasFeeUsd).minus(timeCostUsd);
};

export const BridgeQuoteItem: React.FC<QuoteItemProps> = props => {
  const { currentSelectedQuote, ...others } = props;
  const { styles, colors, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const openBridgeQuote = useSetQuoteVisible();

  const { isTopAmount, diffPercent } = React.useMemo(() => {
    if (props.onlyShow) {
      return { isTopAmount: false, diffPercent: '' };
    }
    if (props.isTopAmount) {
      return { isTopAmount: true, diffPercent: '0.00%' };
    }

    const currentUsd = bridgeQuoteEstimatedValueBn(props, props.receiveToken);
    const bestUsd = new BigNumber(props.bestQuoteUsd);

    if (bestUsd.isZero()) {
      return { isTopAmount: true, diffPercent: '0.00%' };
    }

    const percent = currentUsd
      .minus(bestUsd)
      .div(bestUsd)
      .abs()
      .times(100)
      .toFixed(2, 1)
      .toString();
    return { isTopAmount: false, diffPercent: `-${percent}%` };
  }, [props]);

  const handleClick = async () => {
    if (props.inSufficient) {
      return;
    }
    openBridgeQuote(false);
    props?.setSelectedBridgeQuote?.({ ...others, manualClick: true });
  };

  const isActive =
    !!currentSelectedQuote &&
    others.approve_contract_id === currentSelectedQuote.approve_contract_id &&
    others.aggregator.id === currentSelectedQuote.aggregator.id &&
    others.bridge_id === currentSelectedQuote.bridge_id;

  const containerStyle = StyleSheet.flatten([
    styles.container,
    !props.inSufficient && styles.enabledAggregator,
    props.onlyShow
      ? styles.onlyShow
      : props.inSufficient
      ? styles.insufficient
      : isActive
      ? styles.active
      : styles.normal,
  ]);

  const durationColor = useMemo(() => {
    const mins = Math.ceil(props.duration / 60);
    if (mins > 10) {
      return colors2024['red-default'];
    }
    if (mins > 3) {
      return colors2024['orange-default'];
    }
    return colors2024['brand-default'];
  }, [colors2024, props.duration]);

  const disabled = props.inSufficient || props.onlyShow;

  return (
    <TouchableOpacity
      onPress={handleClick}
      style={{ opacity: disabled ? 0.5 : 1 }}
      disabled={disabled}>
      <View style={containerStyle}>
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
              <Tip
                content={t('page.bridge.need-to-approve-token-before-bridge')}>
                <RcIconLock
                  color={colors2024['neutral-foot']}
                  style={styles.icon}
                />
              </Tip>
            )}
            {!props.onlyShow && props.isBestQuote && (
              <View style={styles.bestInlineTag}>
                <Text style={styles.bestInlineTagText}>
                  {t('page.bridge.best')}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.rightSection}>
            <AssetAvatar size={20} logo={props.receiveToken.logo_url} />
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
            <Text style={styles.feeText}>
              {t('page.bridge.gasXUsd', {
                gasUsd: formatUsdValue(props.gas_fee.usd_value),
              })}
            </Text>

            {/* <RcIconDurationCC
            color={durationColor || colors['neutral-foot']}
            style={[styles.icon, styles.durationIcon]}
          /> */}
            <Text style={[styles.feeText, { color: durationColor }]}>
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
          </View>
        </View>

        {!props.onlyShow && (
          <View
            style={[
              styles.badge,
              isTopAmount ? styles.bestBadge : styles.diffBadge,
            ]}>
            <Text
              style={
                isTopAmount ? styles.bestQuoteText : styles.otherQuoteText
              }>
              {diffPercent}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors, colors2024, isLight }) => ({
  container: {
    flexDirection: 'column',
    justifyContent: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    // height: 82,
    gap: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  enabledAggregator: {},
  onlyShow: {
    height: 'auto',
    padding: 0,
    paddingTop: 0,
  },
  insufficient: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  active: {
    backgroundColor: colors2024['brand-light-1'],
    borderColor: colors2024['brand-light-2'],
  },
  normal: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderWidth: 1,
    borderColor: 'transparent',
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
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  bridgeName: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 18,
    flexShrink: 0,
  },
  icon: {
    width: 16,
    height: 16,
  },
  tokenAmount: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 18,
    flexShrink: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  feeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 6,
  },
  feeText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 18,
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
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 16,
  },

  infoIcon: {
    width: 14,
    height: 14,
    tintColor: colors['neutral-foot'],
  },
  badge: {
    position: 'absolute',
    top: -1,
    right: 0,
    borderRadius: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 0,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  bestBadge: {
    backgroundColor: colors2024['green-light-1'],
  },
  diffBadge: {
    backgroundColor: colors2024['red-light-1'],
  },

  bestQuoteText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    color: colors2024['green-default'],
  },
  otherQuoteText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    color: colors2024['red-default'],
  },
  bestInlineTag: {
    backgroundColor: colors2024['brand-default'],
    borderRadius: 4,
    paddingHorizontal: 4,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bestInlineTagText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    color: colors2024['neutral-InvertHighlight'],
  },
}));
