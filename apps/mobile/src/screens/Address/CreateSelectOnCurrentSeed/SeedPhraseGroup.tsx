import { createGetStyles, createGetStyles2024 } from '@/utils/styles';
import { StyleSheet, View, Text, StyleProp, ViewStyle } from 'react-native';
import { useTheme2024, useThemeColors, useThemeStyles } from '@/hooks/theme';
import { TypeKeyringGroup } from '@/hooks/useWalletTypeData';
import { Button } from '@/components2024/Button';
import { useTranslation } from 'react-i18next';
import { default as RcIconCreateSeed } from '@/assets2024/icons/common/IconAddCreate.svg';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { ellipsisAddress } from '@/utils/address';

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
  const colors = useThemeColors();

  return (
    <View style={StyleSheet.flatten([styles.main, style])}>
      <View style={styles.headline}>
        <Text style={styles.headlineText}>Seed Phrase {index + 1}</Text>
      </View>
      <View style={styles.body}>
        {data.list.map(item => (
          // <View key={item.address} style={styles.item}>
          <AddressItem account={item} key={item.address}>
            {({ WalletIcon, WalletName, WalletBalance }) => (
              <View style={styles.item}>
                <WalletIcon width={40} height={40} />
                <View style={styles.itemInfo}>
                  <View style={styles.itemName}>
                    <WalletName style={styles.itemNameText} />
                  </View>
                  <WalletBalance style={styles.itemBalanceText} />
                </View>
              </View>
            )}
          </AddressItem>
          // </View>
        ))}
      </View>
      <View style={styles.footer}>
        <Button
          onPress={() => {
            const addressArr = data.list.map(e => e.address);
            onAddAddress(data.publicKey!, addressArr);
          }}
          buttonStyle={styles.button}
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
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  main: {
    borderRadius: 6,
  },
  itemInfo: {
    marginLeft: 8,
    gap: 4,
  },
  itemNameText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  itemName: {
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemBalanceText: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
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
  headline: {
    padding: 20,
    // borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors2024['neutral-line'],
  },
  headlineText: {
    fontSize: 16,
    color: colors2024['neutral-title-1'],
    fontWeight: '500',
  },
  body: {
    paddingHorizontal: 16,
  },
  item: {
    flexDirection: 'row',

    paddingVertical: 8,
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
