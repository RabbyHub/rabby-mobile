import { useMemo, useState } from 'react';
import { Image, Text, View } from 'react-native';

import { CHAINS_ENUM, Chain } from '@/constant/chains';
import RcIconChecked from '@/assets/icons/select-chain/icon-checked.svg';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import TouchableView from '@/components/Touchable/TouchableView';
import { useChainBalances } from '@/hooks/account';
import { RcWalletCC } from '@/assets/icons/common';
import { formatUsdValue } from '@/utils/number';
import { TestnetChainLogo } from '@/components/Chain/TestnetChainLogo';
import { Tip } from '@/components/Tip';
import { RPCStatusBadge } from '@/components/Chain/RPCStatusBadge';

export default function ChainItem({
  data,
  value,
  style,
  onPress,
  disabled = false,
  disabledTips = 'Coming soon',
}: RNViewProps & {
  data: Chain;
  value?: CHAINS_ENUM;
  onPress?(value: CHAINS_ENUM): void;
  disabled?: boolean;
  disabledTips?: string | ((ctx: { chain: Chain }) => string);
}) {
  const { styles } = useTheme2024({ getStyle });

  const { matteredChainBalances, testnetMatteredChainBalances } =
    useChainBalances();

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
              <View style={styles.selectChainItemBalance}>
                <RcWalletCC style={styles.walletIcon} />
                <Text style={styles.usdValueText}>
                  {formatUsdValue(chainBalanceItem?.usd_value || 0)}
                </Text>
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
    padding: 16,
  },
  isSelected: {
    backgroundColor: colors2024['brand-light-1'],
  },
  logo: {
    width: 32,
    height: 32,
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
    lineHeight: 19,
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  selectChainItemBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  walletIcon: {
    color: colors2024['neutral-foot'],
    width: 14,
    height: 14,
    marginTop: 2,
  },
  usdValueText: {
    fontSize: 12,
    fontWeight: '400',
    color: colors2024['neutral-foot'],
    marginLeft: 6,
    position: 'relative',
    fontFamily: 'SF Pro Rounded',
    top: 2,
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
}));
