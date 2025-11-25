import { Image, Text, View } from 'react-native';

import RcIconChecked from '@/assets/icons/select-chain/icon-checked.svg';
import { createGetStyles2024 } from '@/utils/styles';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import TouchableView from '@/components/Touchable/TouchableView';
import { RPCStatusBadge } from '@/components/Chain/RPCStatusBadge';
import { useFindChain } from '@/hooks/useFindChain';
import { CustomMarket, getMarketLogo, MarketDataType } from '../config/market';

interface MarketItem {
  chain: string;
}
export default function MarketItem({
  data,
  value,
  style,
  onPress,
}: RNViewProps & {
  data: MarketDataType;
  value?: CustomMarket;
  onPress?(value: CustomMarket): void;
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const isDark = useGetBinaryMode() === 'dark';
  const chainItem = useFindChain({
    id: data.chainId,
  });
  const isSelected = value && value === data?.market;
  return (
    <TouchableView
      style={[
        styles.container,
        {
          backgroundColor: isDark
            ? colors2024['neutral-bg-2']
            : colors2024['neutral-bg-1'],
        },
        isSelected && styles.isSelected,
        style,
      ]}
      onPress={() => {
        onPress?.(data?.market);
      }}>
      <RPCStatusBadge
        size={styles.logo.width}
        chainEnum={chainItem?.enum}
        badgeStyle={styles.badgeStyle}
        badgeSize={9}>
        <Image
          source={{
            uri: getMarketLogo(data?.market)?.uri || chainItem?.logo,
          }}
          style={styles.logo}
        />
      </RPCStatusBadge>

      <View style={styles.contentContainer}>
        <View style={styles.leftBasic}>
          <Text style={styles.nameText}>{data?.marketTitle}</Text>
        </View>
        <View style={styles.rightArea}>
          {isSelected ? <RcIconChecked /> : null}
        </View>
      </View>
    </TouchableView>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12,
    paddingTop: 16,
    paddingBottom: 16,
    paddingLeft: 12,
    paddingRight: 12,
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
    width: 46,
    height: 46,
    borderRadius: 12,
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
    fontFamily: 'SF Pro Rounded',
  },
  selectChainItemBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  percentageText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
  walletIcon: {
    color: colors2024['neutral-foot'],
    width: 14,
    height: 14,
    marginRight: 6,
  },
  usdValueText: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  rightArea: {},
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
}));
