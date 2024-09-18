import { createGetStyles } from '@/utils/styles';
import { StyleSheet, View, Text, StyleProp, ViewStyle } from 'react-native';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { TypeKeyringGroup } from '@/hooks/useWalletTypeData';
import { AddressItemInner } from '../components/AddressItemInner';
import { Button } from '@/components';
import { useTranslation } from 'react-i18next';
import { RcIconCreateSeed } from '@/assets/icons/address';

interface Props {
  index: number;
  data: TypeKeyringGroup;
  onAddAddress: (pk: string) => void;
  style?: StyleProp<ViewStyle>;
}

export const SeedPhraseGroup: React.FC<Props> = ({
  index,
  data,
  onAddAddress,
  style,
}) => {
  const { styles } = useThemeStyles(getStyle);
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <View style={StyleSheet.flatten([styles.main, style])}>
      <View style={styles.headline}>
        <Text style={styles.headlineText}>Seed Phrase {index + 1}</Text>
      </View>
      <View style={styles.body}>
        {data.list.map(item => (
          <View key={item.address} style={styles.item}>
            <AddressItemInner isInList wallet={item} showUsd={false} />
          </View>
        ))}
      </View>
      <View style={styles.footer}>
        <Button
          onPress={() => onAddAddress(data.publicKey!)}
          buttonStyle={styles.button}
          titleStyle={styles.buttonText}
          title={t('page.manageAddress.add-address')}
          icon={
            <RcIconCreateSeed
              color={colors['blue-default']}
              width={20}
              height={20}
            />
          }
        />
      </View>
    </View>
  );
};

const getStyle = createGetStyles(colors => {
  return {
    main: {
      borderRadius: 6,
      backgroundColor: colors['neutral-card1'],
    },
    headline: {
      padding: 15,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors['neutral-line'],
    },
    headlineText: {
      fontSize: 16,
      color: colors['neutral-title-1'],
      fontWeight: '500',
    },
    body: {
      paddingHorizontal: 16,
    },
    item: {
      paddingVertical: 14,
    },
    footer: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      paddingTop: 8,
    },
    button: {
      backgroundColor: colors['blue-light1'],
    },
    buttonText: {
      color: colors['blue-default'],
      fontSize: 14,
      fontWeight: '500',
    },
  };
});
