import RcIconInfoCC from '@/assets2024/icons/perps/IconInfoCC.svg';
import { RcIconLong } from '@/assets2024/icons/perps';
import { MarketData } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { useTipsPopup } from '@/hooks/useTipsPopup';
import { formatPercent, formatUsdValueKMB } from '@/screens/Home/utils/price';
import { createGetStyles2024 } from '@/utils/styles';
import BigNumber from 'bignumber.js';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { WsActiveAssetCtx } from '@rabby-wallet/hyperliquid-sdk';

export const PerpsInfo: React.FC<{
  market: MarketData;
  activeAssetCtx: WsActiveAssetCtx['ctx'] | null;
}> = ({ market, activeAssetCtx }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { showTipsPopup } = useTipsPopup();

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {t('page.perpsDetail.PerpsInfo.title')}
        </Text>
      </View>
      <View style={styles.list}>
        <View style={styles.listItem}>
          <View style={styles.listItemMain}>
            <Text style={styles.label}>
              {t('page.perpsDetail.PerpsInfo.24Vol')}
            </Text>
          </View>
          <View>
            <Text style={styles.value}>
              {formatUsdValueKMB(
                Number(activeAssetCtx?.dayNtlVlm || market?.dayNtlVlm || 0),
              )}
            </Text>
          </View>
        </View>
        <View style={styles.listItem}>
          <TouchableOpacity
            onPress={() => {
              showTipsPopup({
                title: t('page.perpsDetail.PerpsInfo.openInterest'),
                desc: t('page.perpsDetail.PerpsInfo.openInterestTips'),
              });
            }}>
            <View style={styles.listItemMain}>
              <Text style={styles.label}>
                {t('page.perpsDetail.PerpsInfo.openInterest')}
              </Text>
              <RcIconInfoCC
                width={18}
                height={16}
                color={colors2024['neutral-info']}
              />
            </View>
          </TouchableOpacity>
          <View>
            <Text style={styles.value}>
              {formatUsdValueKMB(
                new BigNumber(
                  activeAssetCtx?.openInterest || market?.openInterest || 0,
                )
                  .times(activeAssetCtx?.markPx || market?.markPx || 0)
                  .toString(),
              )}
            </Text>
          </View>
        </View>
        <View style={styles.listItem}>
          <TouchableOpacity
            onPress={() => {
              showTipsPopup({
                title: t('page.perpsDetail.PerpsInfo.funding'),
                desc: t('page.perpsDetail.PerpsInfo.fundingTips'),
              });
            }}>
            <View style={styles.listItemMain}>
              <Text style={styles.label}>
                {t('page.perpsDetail.PerpsInfo.fundingRate')}
              </Text>
              <RcIconInfoCC
                width={18}
                height={18}
                color={colors2024['neutral-info']}
              />
            </View>
          </TouchableOpacity>
          <View>
            <Text style={styles.value}>
              {formatPercent(
                Number(activeAssetCtx?.funding || market?.funding || 0),
                6,
              )}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  section: {
    // marginBottom: 30,
  },
  header: {
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  list: {
    borderRadius: 16,
    // backgroundColor: isLight
    //   ? colors2024['neutral-bg-1']
    //   : colors2024['neutral-bg-2'],
    backgroundColor: isLight
      ? colors2024['neutral-bg-5']
      : colors2024['neutral-bg-3'],
  },
  listItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    justifyContent: 'space-between',
  },
  listItemMain: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 20,
  },
  label: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },
  value: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
}));
