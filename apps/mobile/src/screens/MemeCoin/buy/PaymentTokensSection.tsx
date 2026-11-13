import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import RcImgEmptyDark from '@/assets2024/memecoin/empty-payment-dark.svg';
import RcImgEmpty from '@/assets2024/memecoin/empty-payment-light.svg';
import { AssetAvatar } from '@/components/AssetAvatar';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { tokenKey } from '../engine/keys';
import type { PaymentAsset } from '../engine/types';

export const PaymentTokensSection = ({
  selectedAssets,
  paymentBySource,
  logoByKey,
  onSelectTokens,
}: {
  selectedAssets: PaymentAsset[];
  paymentBySource: Record<string, number>;
  logoByKey: ReadonlyMap<string, string>;
  onSelectTokens: () => void;
}) => {
  const { t } = useTranslation();
  const { styles, isLight } = useTheme2024({ getStyle });
  const RcEmpty = isLight ? RcImgEmpty : RcImgEmptyDark;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('page.memeCoin.buy.paymentTokens')}</Text>
        <TouchableOpacity
          activeOpacity={0.8}
          hitSlop={8}
          onPress={onSelectTokens}>
          <Text style={styles.link}>{t('page.memeCoin.buy.selectTokens')}</Text>
        </TouchableOpacity>
      </View>
      {selectedAssets.length ? (
        selectedAssets.map(asset => {
          const key = tokenKey(asset);
          return (
            <View key={key} style={styles.row}>
              <AssetAvatar
                logo={logoByKey.get(key) || ''}
                chain={asset.chain}
                size={44}
                chainSize={18}
              />
              <Text style={styles.symbol} numberOfLines={1}>
                {asset.symbol}
              </Text>
              <View style={styles.payment}>
                <Text style={styles.paymentLabel}>
                  {t('page.memeCoin.buy.estPaymentLabel')}
                </Text>
                <Text style={styles.paymentValue}>
                  {formatUsdValue(paymentBySource[key] ?? 0)}
                </Text>
              </View>
            </View>
          );
        })
      ) : (
        <View style={styles.empty}>
          <RcEmpty width={163} height={126} />
          <Text style={styles.emptyText}>
            {t('page.memeCoin.buy.noPaymentToken')}
          </Text>
        </View>
      )}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  section: {
    marginTop: 30,
  },
  header: {
    marginBottom: 8,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
  },
  link: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['brand-default'],
  },
  row: {
    height: 70,
    marginBottom: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: colors2024['neutral-card-1'],
  },
  symbol: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  payment: {
    marginLeft: 8,
    alignItems: 'flex-end',
    gap: 2,
  },
  paymentLabel: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
  },
  paymentValue: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  empty: {
    // 60 in Figma, counting the header's margin
    marginTop: 52,
    alignItems: 'center',
    gap: 4,
  },
  emptyText: {
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    color: colors2024['neutral-info'],
  },
}));
