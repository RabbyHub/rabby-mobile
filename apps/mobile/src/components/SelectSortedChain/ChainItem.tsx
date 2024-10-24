import { useMemo, useState } from 'react';
import { Image, Text, View } from 'react-native';

import { CHAINS_ENUM, Chain } from '@/constant/chains';
import RcIconChecked from '@/assets/icons/select-chain/icon-checked.svg';
import { createGetStyles } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import TouchableView from '../Touchable/TouchableView';
import {
  useChainBalances,
  useLoadMatteredChainBalances,
} from '@/hooks/account';
import { RcWalletCC } from '@/assets/icons/common';
import { formatUsdValue } from '@/utils/number';
import { toast } from '../Toast';
import { TestnetChainLogo } from '../Chain/TestnetChainLogo';
import { Tip } from '../Tip';
import { Badge } from '@rneui/themed';
import { RPCStatusBadge } from '../Chain/RPCStatusBadge';

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
  const { styles } = useThemeStyles(getStyles);

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
        style={[styles.container, disabled && styles.disable, style]}
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
            <RPCStatusBadge size={styles.logo.width} chainEnum={data?.enum}>
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
            {value && value === data?.enum ? <RcIconChecked /> : null}
          </View>
        </View>
      </TouchableView>
    </Tip>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      gap: 12,
      paddingVertical: 16,
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
      color: colors['neutral-title1'],
      fontWeight: '600',
    },
    selectChainItemBalance: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    walletIcon: {
      color: colors['neutral-foot'],
      width: 14,
      height: 14,
      marginTop: 2,
    },
    usdValueText: {
      fontSize: 12,
      fontWeight: '400',
      color: colors['neutral-foot'],
      marginLeft: 6,
      position: 'relative',
      top: 2,
    },
    rightArea: {},
    disable: {
      opacity: 0.5,
    },
  };
});
