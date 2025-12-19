import { createGetStyles2024 } from '@/utils/styles';
import {
  StyleSheet,
  View,
  Text,
  StyleProp,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { TypeKeyringGroup } from '@/hooks/useWalletTypeData';
import { Button } from '@/components2024/Button';
import { useTranslation } from 'react-i18next';
import { default as RcIconCreateSeed } from '@/assets2024/icons/common/IconAddCreate.svg';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import IcRightArrow from '@/assets2024/icons/common/IcRightArrow.svg';
import { useCallback, useMemo, useState } from 'react';
import { useCurrency } from '@/hooks/useCurrency';
import BigNumber from 'bignumber.js';
import { splitNumberByStep } from '@/utils/number';
interface Props {
  index: number;
  data: TypeKeyringGroup;
  onAddAddress: (pk: string, accounts: string[]) => void;
  style?: StyleProp<ViewStyle>;
}

export const SeedPhraseGroup: React.FC<Props> = ({
  index,
  data,
  onAddAddress,
  style,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { currency } = useCurrency();

  const allAddrBalance = (data?.list || []).reduce((pre, now) => {
    return pre.plus(now.balance);
  }, new BigNumber(0));

  const totalValue = useMemo(() => {
    const b = allAddrBalance.times(currency.usd_rate);
    return `${currency.symbol}${splitNumberByStep(
      b.isGreaterThan(10)
        ? b.decimalPlaces(0, BigNumber.ROUND_FLOOR).toString()
        : b.toFixed(2),
    )}`;
  }, [allAddrBalance, currency.symbol, currency.usd_rate]);

  const noBalance = useMemo(
    () => allAddrBalance.isEqualTo(0),
    [allAddrBalance],
  );

  const [isFold, setFold] = useState(noBalance ? true : false);

  const toggle = useCallback(() => {
    setFold(e => !e);
  }, []);

  const [showMoreWallet, setShowMoreWallet] = useState(false);

  const renderItem = useCallback(
    (item: (typeof data.list)[number]) => (
      <AddressItem account={item} key={item.address}>
        {({ WalletIcon, WalletName, WalletBalance }) => (
          <View style={styles.item}>
            <WalletIcon width={46} height={46} style={styles.walletLogo} />
            <View style={styles.itemInfo}>
              <View style={styles.itemName}>
                <WalletName style={styles.itemNameText} />
              </View>
              <WalletBalance style={styles.itemBalanceText} />
            </View>
          </View>
        )}
      </AddressItem>
    ),
    [data, styles],
  );

  return (
    <View style={StyleSheet.flatten([styles.main, style])}>
      <TouchableOpacity style={styles.headline} onPress={toggle}>
        <Text style={styles.headlineText}>Seed Phrase {index + 1}</Text>
        <Text style={[{ marginLeft: 'auto' }, styles.headlineText]}>
          {totalValue}
        </Text>
        <IcRightArrow
          style={[
            styles.valueArrow,
            { transform: [{ rotate: isFold ? '90deg' : '-90deg' }] },
          ]}
          color={colors2024['neutral-title-1']}
        />
      </TouchableOpacity>
      {isFold ? null : (
        <>
          <View style={styles.body}>
            {data.list
              ?.slice(0, showMoreWallet ? undefined : 3)
              .map(item => renderItem(item))}
            {!showMoreWallet && data.list.length > 3 && (
              <TouchableOpacity
                style={styles.more}
                onPress={() => {
                  setShowMoreWallet(e => !e);
                }}>
                <Text style={styles.moreText}>More wallet</Text>
                <IcRightArrow style={styles.moreTextArrow} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.footer}>
            <Button
              onPress={() => {
                const addressArr = data.list.map(e => e.address);
                onAddAddress(data.publicKey!, addressArr);
              }}
              buttonStyle={styles.button}
              noShadow={true}
              titleStyle={styles.buttonText}
              title={t('page.manageAddress.add-address')}
              icon={
                <RcIconCreateSeed
                  color={colors2024['blue-default']}
                  width={20}
                  height={20}
                />
              }
            />
          </View>
        </>
      )}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  main: {
    borderRadius: 6,
  },
  walletLogo: {
    borderRadius: 12,
  },
  itemInfo: {
    marginLeft: 8,
    gap: 4,
  },
  itemNameText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
  },
  itemName: {
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemBalanceText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  titleText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'left',
    color: colors2024['neutral-title-1'],
    // marginRight: 4,
  },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 2,
    backgroundColor: colors2024['neutral-bg-0'],
    borderRadius: 12,
  },
  moreText: {
    paddingLeft: 14,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 18,
  },
  moreTextArrow: {
    color: colors2024['neutral-secondary'],
    transform: [{ rotate: '90deg' }],
    width: 14,
    height: 14,
    position: 'relative',
    top: 1,
  },
  headline: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headlineText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  valueArrow: {
    marginLeft: 6,
  },
  body: {
    paddingHorizontal: 16,
    gap: 8,
  },
  item: {
    padding: 12,
    backgroundColor: colors2024['neutral-bg-0'],
    flexDirection: 'row',
    borderRadius: 12,
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 16,
  },
  button: {
    backgroundColor: colors2024['brand-light-1'],
    height: 42,
  },
  buttonText: {
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'left',
  },
}));
