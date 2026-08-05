import RcIconUSDC from '@/assets2024/icons/perps/IconUSDC.svg';
import RcIconUSDE from '@/assets2024/icons/perps/IconUSDE.svg';
import RcIconUSDH from '@/assets2024/icons/perps/IconUSDH.svg';
import RcIconUSDT from '@/assets2024/icons/perps/IconUSDT.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsAccountAssetRow } from '../../model/account';
import {
  formatPerpsProDecimal,
  formatPerpsProUsdValue,
} from '../../utils/format';

const ASSET_ICONS = {
  USDC: RcIconUSDC,
  USDE: RcIconUSDE,
  USDH: RcIconUSDH,
  USDT: RcIconUSDT,
};

export const PerpsProAccountAssetRow: React.FC<{
  asset: PerpsAccountAssetRow;
  onSwap: (coin: PerpsAccountAssetRow['coin']) => void;
}> = React.memo(({ asset, onSwap }) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const AssetIcon = ASSET_ICONS[asset.coin];
  const ledgerLabel =
    asset.ledger === 'spot'
      ? t('page.perps.pro.account.spot')
      : asset.ledger === 'perps'
      ? t('page.perps.pro.account.perps')
      : null;

  return (
    <View style={styles.assetRow} testID={`perps-pro-asset-${asset.key}`}>
      <View style={styles.assetMain}>
        <View style={styles.assetIdentity}>
          <AssetIcon height={24} width={24} />
          <View>
            <View style={styles.coinRow}>
              <Text style={styles.coin}>{asset.coin}</Text>
              {ledgerLabel ? (
                <View style={styles.ledgerTag}>
                  <Text style={styles.ledgerTagText}>{ledgerLabel}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.fullName}>{asset.fullName}</Text>
          </View>
        </View>
        <View style={styles.assetValue}>
          <Text style={styles.total}>
            {formatPerpsProDecimal(asset.total, 8)}
          </Text>
          <Text style={styles.usdValue}>
            {formatPerpsProUsdValue(asset.usdValue)}
          </Text>
        </View>
      </View>
      <View style={styles.actionRow}>
        {asset.action === 'swap' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => onSwap(asset.coin)}
            style={styles.assetAction}>
            <Text style={styles.assetActionText}>
              {t('page.perps.pro.account.swap')}
            </Text>
          </Pressable>
        ) : asset.action === 'transfer-disabled' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            disabled
            style={styles.disabledAssetAction}
            testID="perps-pro-transfer-disabled">
            <Text style={styles.disabledAssetActionText}>
              {t('page.perps.pro.account.transfer')}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.actionPlaceholder} />
        )}
      </View>
    </View>
  );
});

PerpsProAccountAssetRow.displayName = 'PerpsProAccountAssetRow';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  assetRow: {
    borderBottomColor: colors2024['neutral-line'],
    borderBottomWidth: 1,
    gap: 12,
    justifyContent: 'center',
    marginHorizontal: 15,
    minHeight: 100,
    paddingVertical: 8,
  },
  assetMain: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  assetIdentity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  coinRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  coin: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  ledgerTag: {
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  ledgerTagText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 14,
  },
  fullName: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
  },
  assetValue: {
    alignItems: 'flex-end',
  },
  total: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
  },
  usdValue: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  actionRow: {
    alignItems: 'flex-end',
  },
  assetAction: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 6,
    height: 26,
    justifyContent: 'center',
    width: 64,
  },
  assetActionText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  disabledAssetAction: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 6,
    height: 26,
    justifyContent: 'center',
    opacity: 0.55,
    width: 64,
  },
  disabledAssetActionText: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  actionPlaceholder: {
    height: 26,
    width: 64,
  },
}));
