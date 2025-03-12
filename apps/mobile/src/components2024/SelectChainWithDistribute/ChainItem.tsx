import { Image, Text, View } from 'react-native';

import RcIconChecked from '@/assets/icons/select-chain/icon-checked.svg';
import { createGetStyles2024 } from '@/utils/styles';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import TouchableView from '@/components/Touchable/TouchableView';
import { formatUsdValue } from '@/utils/number';
import { RPCStatusBadge } from '@/components/Chain/RPCStatusBadge';
import { ChainListItem } from './index';
import { useFindChain } from '@/hooks/useFindChain';
export default function ChainItem({
  data,
  value,
  style,
  onPress,
}: RNViewProps & {
  data: ChainListItem;
  value?: ChainListItem;
  onPress?(value: ChainListItem): void;
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const isDark = useGetBinaryMode() === 'dark';
  const chainItem = useFindChain({
    serverId: data.chain || null,
  });

  const isSelected = value && value.chain === data?.chain;
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
        onPress?.(data);
      }}>
      <RPCStatusBadge
        size={styles.logo.width}
        chainEnum={chainItem?.enum}
        badgeStyle={styles.badgeStyle}
        badgeSize={9}>
        <Image
          source={{
            uri: chainItem?.logo,
          }}
          style={styles.logo}
        />
      </RPCStatusBadge>

      <View style={styles.contentContainer}>
        <View style={styles.leftBasic}>
          <Text style={styles.nameText}>{chainItem?.name}</Text>
          {!!data.total && (
            <View style={styles.chainSummary}>
              <View style={styles.selectChainItemBalance}>
                <Text style={styles.usdValueText}>
                  {formatUsdValue(data.total || 0)}
                </Text>
              </View>
            </View>
          )}
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
