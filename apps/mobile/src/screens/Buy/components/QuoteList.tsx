import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { View } from 'react-native';
import { BuyQuoteItem } from './QuoteItem';

export const BuyQuoteList = () => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  return (
    <View>
      <Text style={styles.title}>{t('page.buy.quote.title')}</Text>
      <View style={styles.container}>
        <BuyQuoteItem />
        <BuyQuoteItem />
        <BuyQuoteItem />
        <BuyQuoteItem />
        <BuyQuoteItem />
        <BuyQuoteItem />
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    gap: 12,
  },

  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 36,
    marginBottom: 18,
  },
}));
