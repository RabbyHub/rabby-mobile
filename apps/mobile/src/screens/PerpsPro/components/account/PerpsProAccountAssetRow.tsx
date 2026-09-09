import { PERPS_PRO_NUMBER_STYLE } from '../common/perpsProNumberText';
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
  onTransfer: (asset: PerpsAccountAssetRow) => void;
}> = React.memo(({ asset, onSwap, onTransfer }) => {
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
          <AssetIcon height={36} width={36} />
          <View style={styles.coinRow}>
            <Text style={styles.coin}>{asset.coin}</Text>
            {ledgerLabel ? (
              <View style={styles.ledgerTag}>
                <Text style={styles.ledgerTagText}>{ledgerLabel}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.assetValue}>
          <Text style={styles.total}>
            {formatPerpsProDecimal(asset.total, 2)}
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
        ) : asset.action === 'transfer' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => onTransfer(asset)}
            style={styles.assetAction}
            testID="perps-pro-transfer">
            <Text style={styles.assetActionText}>
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
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-1'],
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    flexDirection: 'row',
    gap: 16,
    marginHorizontal: 16,
    minHeight: 62,
    paddingLeft: 4,
    paddingVertical: 12,
  },
  assetMain: {
    gap: 8,
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minWidth: 0,
  },
  assetIdentity: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 8,
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
  assetValue: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
    gap: 2,
  },
  total: {
    ...PERPS_PRO_NUMBER_STYLE,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
  },
  usdValue: {
    ...PERPS_PRO_NUMBER_STYLE,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
  },
  actionRow: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  assetAction: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 6,
    height: 30,
    justifyContent: 'center',
    width: 68,
  },
  assetActionText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  actionPlaceholder: {
    height: 30,
    width: 68,
  },
}));
