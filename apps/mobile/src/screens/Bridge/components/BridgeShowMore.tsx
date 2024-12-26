import React, {
  Dispatch,
  SetStateAction,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import ArrowRightSVG from '@/assets2024/icons/common/arrow-right-cc.svg';
import { useTranslation } from 'react-i18next';
import { getTokenSymbol } from '@/utils/token';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { BridgeSlippage } from './BridgeSlippage';
import RcIconPolygon from '@/assets2024/icons/bridge/IconPolygon.svg';
import { tokenPriceImpact } from '../hooks/token';
import { AppSwitch, AssetAvatar, Tip } from '@/components';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import RcIconBluePolygon from '@/assets2024/icons/bridge/IconBluePolygon.svg';

const BridgeShowMore = ({
  openQuotesList,
  sourceName,
  sourceLogo,
  slippage,
  displaySlippage,
  onSlippageChange,
  fromToken,
  toToken,
  amount,
  toAmount,
  quoteLoading,
  slippageError,
  autoSlippage,
  isCustomSlippage,
  setAutoSlippage,
  setIsCustomSlippage,
  open,
  setOpen,
  type,
  isWrapToken,
  isBestQuote,
  showMEVGuardedSwitch,
  originPreferMEVGuarded,
  switchPreferMEV,
  recommendValue,
}: {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  openQuotesList: () => void;
  sourceName: string;
  sourceLogo: string;
  slippage: string;
  displaySlippage: string;
  onSlippageChange: (n: string) => void;
  fromToken?: TokenItem;
  toToken?: TokenItem;
  amount?: string | number;
  toAmount?: string | number;
  quoteLoading?: boolean;
  slippageError?: boolean;
  autoSlippage: boolean;
  isCustomSlippage: boolean;
  setAutoSlippage: (boolean: boolean) => void;
  setIsCustomSlippage: (boolean: boolean) => void;
  type: 'swap' | 'bridge';
  /**
   * for swap props
   */
  isWrapToken?: boolean;
  isBestQuote: boolean;
  showMEVGuardedSwitch?: boolean;
  originPreferMEVGuarded?: boolean;
  switchPreferMEV?: (b: boolean) => void;
  recommendValue?: number;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024, colors } = useTheme2024({ getStyle });
  const [lossImpactOpen, setLossImpactOpen] = useState(false);

  const data = useMemo(() => {
    if (quoteLoading || (!sourceLogo && !sourceName)) {
      return {
        showLoss: false,
        diff: '',
        fromUsd: '',
        toUsd: '',
        lossUsd: '',
      };
    }
    return tokenPriceImpact(fromToken, toToken, amount, toAmount);
  }, [
    fromToken,
    toToken,
    amount,
    toAmount,
    quoteLoading,
    sourceLogo,
    sourceName,
  ]);
  useEffect(() => {
    if ((!quoteLoading && data?.showLoss) || slippageError) {
      setOpen(true);
    }
  }, [quoteLoading, data?.showLoss, setOpen, slippageError]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.dottedLine} />
        <TouchableOpacity
          onPress={() => setOpen(e => !e)}
          style={styles.headerTextWrapper}>
          <Text style={styles.headerText}>
            {t('page.bridge.showMore.title')}
          </Text>
          <ArrowRightSVG
            width={14}
            height={14}
            style={[styles.icon, open && { transform: [{ rotate: '-90deg' }] }]}
            color={colors2024['neutral-secondary']}
          />
        </TouchableOpacity>
        <View style={styles.dottedLine} />
      </View>

      <View style={[styles.body, !open && { height: 0 }]}>
        {data?.showLoss && !quoteLoading && (
          <>
            <View style={styles.lossInfo}>
              <View style={styles.flexRow}>
                <Text style={styles.impactText}>
                  {t('page.bridge.price-impact')}
                </Text>
                <TouchableOpacity
                  style={styles.diffBox}
                  onPress={() => setLossImpactOpen(i => !i)}>
                  <Text style={styles.lossAmount}>-{data.diff}%</Text>
                  <Animated.View
                    style={{
                      transform: [
                        { rotate: !lossImpactOpen ? '180deg' : '0deg' },
                      ],
                    }}>
                    <RcIconPolygon />
                  </Animated.View>
                </TouchableOpacity>
              </View>
              {lossImpactOpen && (
                <View style={styles.impactTooltip}>
                  <Text style={styles.impactTooltipText}>
                    {t('page.bridge.est-payment')} {amount}
                    {getTokenSymbol(fromToken)} ≈ {data.fromUsd}
                  </Text>
                  <Text style={styles.impactTooltipText}>
                    {t('page.bridge.est-receiving')} {toAmount}
                    {getTokenSymbol(toToken)} ≈ {data.toUsd}
                  </Text>
                  <Text style={styles.impactTooltipText}>
                    {t('page.bridge.est-difference')} {data.lossUsd}
                  </Text>
                </View>
              )}

              <Text style={styles.lossTip}>
                {t('page.bridge.loss-tips', { usd: data?.lossUsd })}
              </Text>
              <View style={styles.dottedLine} />
            </View>
          </>
        )}

        <ListItem
          name={t('page.bridge.showMore.source')}
          style={styles.listItem}>
          {quoteLoading ? (
            <ActivityIndicator size="small" />
          ) : (
            <TouchableOpacity
              onPress={openQuotesList}
              style={styles.quoteContainer}>
              {isBestQuote && (
                <View style={styles.bestView}>
                  <Text style={styles.bestText}>{t('page.swap.best')}</Text>
                </View>
              )}
              {sourceLogo && (
                <Image
                  source={
                    typeof sourceLogo === 'string'
                      ? { uri: sourceLogo }
                      : sourceLogo
                  }
                  style={styles.sourceLogo}
                />
              )}
              {sourceName && (
                <Text style={styles.sourceName}>{sourceName}</Text>
              )}
              {sourceName || sourceLogo ? (
                <RcIconBluePolygon
                  style={styles.arrowIcon}
                  color={colors2024['brand-default']}
                />
              ) : null}
              {!sourceLogo && !sourceName ? (
                <Text style={styles.noQuotePlaceholder}>-</Text>
              ) : null}
            </TouchableOpacity>
          )}
        </ListItem>

        <BridgeSlippage
          value={slippage}
          displaySlippage={displaySlippage}
          onChange={onSlippageChange}
          autoSlippage={autoSlippage}
          isCustomSlippage={isCustomSlippage}
          setAutoSlippage={setAutoSlippage}
          setIsCustomSlippage={setIsCustomSlippage}
          type={type}
          isWrapToken={isWrapToken}
          recommendValue={recommendValue}
        />

        {showMEVGuardedSwitch && (
          <ListItem style={{ marginTop: 20 }} name={t('page.swap.preferMEV')}>
            <AppSwitch
              value={originPreferMEVGuarded}
              onValueChange={switchPreferMEV}
              barHeight={22}
              circleBorderInactiveColor={colors2024['neutral-bg-2']}
              backgroundInactive={colors2024['neutral-bg-2']}
            />
          </ListItem>
        )}
      </View>
    </View>
  );
};

function ListItem({
  name,
  style,
  children,
}: {
  name: React.ReactNode;
  style?: object;
  children: React.ReactNode;
}) {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={[styles.listItemContainer, style]}>
      <Text style={styles.listItemText}>{name}</Text>
      <View style={styles.flexRow}>{children}</View>
    </View>
  );
}

export const RecommendFromToken = ({
  token,
  style,
  onOk,
}: {
  token: TokenItem;
  style?: object;
  onOk: () => void;
}) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  return (
    <View style={[styles.recommendFromToken, style]}>
      <View style={styles.recommendTextWrapper}>
        <Text style={styles.recommendText}>{t('page.bridge.bridge-from')}</Text>
        <View style={styles.tokenContainer}>
          <AssetAvatar
            size={26}
            chain={token.chain}
            logo={token.logo_url}
            chainSize={12}
          />
          <Text style={styles.tokenText}>{getTokenSymbol(token)}</Text>
        </View>
        <Text style={styles.recommendText}>
          {t('page.bridge.for-available-quote')}
        </Text>
      </View>
      <TouchableOpacity onPress={onOk} style={styles.okButton}>
        <Text style={styles.okButtonText}>{t('global.ok')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: { marginHorizontal: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  dottedLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderColor: colors2024['neutral-line'],
    opacity: 0.5,
  },
  impactTooltip: {
    alignItems: 'flex-end',
    flexDirection: 'column',
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors2024['red-light-1'],
    borderRadius: 12,
  },
  impactTooltipText: {
    fontSize: 12,
    lineHeight: 14,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['red-default'],
  },
  icon: {
    marginLeft: 4,
    transform: [{ rotate: '90deg' }],
  },
  headerTextWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    // opacity: 0.3,
  },
  listItemText: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
  },
  headerText: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
  },
  body: { overflow: 'hidden' },
  lossInfo: { marginBottom: 12, fontSize: 12, color: '#5B5B5B' },
  flexRow: { flexDirection: 'row', justifyContent: 'space-between' },
  lossAmount: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    lineHeight: 20,
    color: colors2024['red-default'],
    marginRight: 4,
  },
  impactText: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
  },
  diffBox: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lossTip: {
    marginTop: 8,
    // paddingHorizontal: 4,
    // backgroundColor: '#FFE3E3',
    color: colors2024['red-default'],
    borderRadius: 4,
    fontSize: 13,
    marginBottom: 8,
  },
  listItem: { marginBottom: 20 },
  listItemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourceLogo: { width: 18, height: 18, borderRadius: 16 },
  sourceName: {
    color: colors2024['brand-default'],
    fontWeight: '500',
  },
  recommendFromToken: {
    // flexDirection: 'row',
    // height: 44,
    alignItems: 'flex-end',
    height: 122,
    marginTop: 100,
    marginHorizontal: 24,
    paddingHorizontal: 12,
    paddingVertical: 20,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    // borderBlockColor: colors2024['neutral-line'],
    backgroundColor: colors2024['neutral-bg-1'],
    // alignItems: 'center',
  },
  recommendTextWrapper: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
  },
  recommendText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    lineHeight: 18,
    color: colors2024['neutral-info'],
  },
  tokenContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: colors2024['neutral-bg-4'],
    borderRadius: 12,
  },
  tokenText: {
    color: colors2024['neutral-title-1'],
    marginLeft: 6,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    lineHeight: 20,
  },
  okButton: {
    backgroundColor: colors2024['brand-default'],
    borderRadius: 100,
    width: 77,
    height: 36,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  okButtonText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    lineHeight: 20,
    color: colors2024['neutral-bg-1'],
    marginRight: 4,
  },

  quoteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  afterLabel: {
    fontSize: 14,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-body'],
  },
  bestView: {
    backgroundColor: colors2024['green-light-2'],
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 4,
  },
  bestText: {
    color: colors2024['green-default'],
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    zIndex: 1,
  },
  noQuotePlaceholder: {
    color: colors2024['neutral-foot'],
    fontSize: 12,
  },
  arrowIcon: {
    transform: [{ rotate: '-90deg' }],
  },
}));

export default BridgeShowMore;
