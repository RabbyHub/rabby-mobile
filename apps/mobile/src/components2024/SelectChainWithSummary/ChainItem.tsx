import { useMemo, useState } from 'react';
import { Image, Text, View } from 'react-native';

import { CHAINS_ENUM, Chain } from '@/constant/chains';
import RcIconChecked from '@/assets/icons/select-chain/icon-checked.svg';
import { createGetStyles2024 } from '@/utils/styles';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import TouchableView from '@/components/Touchable/TouchableView';
import {
  useChainBalances,
  useMatteredChainBalancesAll,
} from '@/hooks/accountChainBalance';
import { RcWalletCC } from '@/assets/icons/common';
import { formatUsdValue } from '@/utils/number';
import { TestnetChainLogo } from '@/components/Chain/TestnetChainLogo';
import { Tip } from '@/components/Tip';
import { RPCStatusBadge } from '@/components/Chain/RPCStatusBadge';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { AssetAvatar } from '@/components/AssetAvatar';

export default function ChainItem({
  data,
  value,
  style,
  onPress,
  disabled = false,
  disabledTips = 'Coming soon',
  needAllAddresses,
  tokens = [],
}: RNViewProps & {
  data: Chain;
  needAllAddresses?: boolean;
  value?: CHAINS_ENUM;
  onPress?(value: CHAINS_ENUM): void;
  disabled?: boolean;
  disabledTips?: string | ((ctx: { chain: Chain }) => string);
  tokens?: TokenItem[];
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const isDark = useGetBinaryMode() === 'dark';

  const {
    matteredChainBalances: _matteredChainBalances,
    testnetMatteredChainBalances,
  } = useChainBalances();
  const { matteredChainBalancesAll } = useMatteredChainBalancesAll();

  const matteredChainBalances = useMemo(
    () =>
      needAllAddresses ? matteredChainBalancesAll : _matteredChainBalances,
    [matteredChainBalancesAll, _matteredChainBalances, needAllAddresses],
  );

  const chainBalanceItem = useMemo(() => {
    return (
      matteredChainBalances?.[data.serverId] ||
      testnetMatteredChainBalances?.[data.serverId]
    );
  }, [data.serverId, matteredChainBalances, testnetMatteredChainBalances]);

  const finalDisabledTips = useMemo(() => {
    if (typeof disabledTips === 'function') {
      return disabledTips({ chain: data });
    }

    return disabledTips;
  }, [data, disabledTips]);

  const [tipsVisible, setTipsVisible] = useState(false);
  const isSelected = value && value === data?.enum;
  return (
    <Tip
      tooltipStyle={{
        transform: [{ translateY: 20 }],
      }}
      content={finalDisabledTips}
      isVisible={tipsVisible}
      onClose={() => setTipsVisible(false)}>
      <TouchableView
        activeOpacity={disabled ? 1 : undefined}
        style={[
          styles.container,
          disabled && styles.disable,
          {
            backgroundColor: isDark
              ? colors2024['neutral-bg-2']
              : colors2024['neutral-bg-1'],
          },
          isSelected && styles.isSelected,
          style,
        ]}
        onPress={() => {
          if (disabled) {
            finalDisabledTips && setTipsVisible(true); // toast.info(finalDisabledTips);
            return;
          }
          onPress?.(data?.enum);
        }}>
        {data.isTestnet ? (
          <TestnetChainLogo name={data.name} style={styles.logo} size={32} />
        ) : (
          <>
            <RPCStatusBadge
              size={styles.logo.width}
              chainEnum={data?.enum}
              badgeStyle={styles.badgeStyle}
              badgeSize={9}>
              <Image
                source={{
                  uri: data.logo,
                }}
                style={styles.logo}
              />
            </RPCStatusBadge>
          </>
        )}
        <View style={styles.contentContainer}>
          <View style={styles.leftBasic}>
            <Text style={styles.nameText}>{data?.name}</Text>
            {!!chainBalanceItem?.usd_value && (
              <View style={styles.chainSummary}>
                <View style={styles.selectChainItemBalance}>
                  <RcWalletCC style={styles.walletIcon} />
                  <Text style={styles.usdValueText}>
                    {formatUsdValue(chainBalanceItem?.usd_value || 0)}
                  </Text>
                </View>
                {tokens && tokens.length > 0 && (
                  <>
                    <View style={styles.divide} />
                    <View style={styles.chainLogos}>
                      {tokens.map(item => (
                        <AssetAvatar
                          key={`${item.chain}-${item.id}`}
                          logo={item.logo_url}
                          size={14}
                          logoStyle={styles.chainLogoItem}
                        />
                      ))}
                    </View>
                  </>
                )}
              </View>
            )}
          </View>
          <View style={styles.rightArea}>
            {isSelected ? <RcIconChecked /> : null}
          </View>
        </View>
      </TouchableView>
    </Tip>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12,
    paddingTop: 14,
    paddingBottom: 14,
    paddingLeft: 16,
    paddingRight: 16,
    marginBottom: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  isSelected: {
    backgroundColor: colors2024['brand-light-1'],
    borderColor: colors2024['brand-light-2'],
  },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 16,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  leftBasic: {
    flexDirection: 'column',
  },
  nameText: {
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
    fontFamily: 'SF Pro',
  },
  selectChainItemBalance: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletIcon: {
    color: colors2024['neutral-foot'],
    width: 14,
    height: 14,
    marginRight: 6,
  },
  usdValueText: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
  },
  rightArea: {},
  disable: {
    opacity: 0.5,
  },
  badgeStyle: {
    top: 0,
    right: 0,
    backgroundColor: colors2024['green-default'],
    borderColor: colors2024['neutral-title-2'],
  },
  chainSummary: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  chainLogos: {
    display: 'flex',
    flexDirection: 'row',
    gap: 2,
  },
  chainLogoItem: {
    borderRadius: 14,
    width: 14,
    height: 14,
  },
  divide: {
    width: 1,
    height: 12,
    backgroundColor: colors2024['brand-light-2'],
    marginLeft: 6,
    marginRight: 6,
  },
}));
