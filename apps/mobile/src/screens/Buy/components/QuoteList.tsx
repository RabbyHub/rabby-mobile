import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { View } from 'react-native';
import { BuyQuoteItem as QuoteItem } from './QuoteItem';
import { openapi } from '@/core/request';
import { BuyQuoteItem } from '@rabby-wallet/rabby-api/dist/types';

export const BuyQuoteList = ({
  quotes,
  symbol,
  activeProvider,
  setActiveProvider,
}: {
  quotes: (BuyQuoteItem & {
    paymentMethod?: Awaited<ReturnType<typeof openapi.getBuyPaymentMethods>>;
  })[];
  symbol: string;
  activeProvider: string;
  setActiveProvider: (s: string) => void;
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  return (
    <View>
      <Text style={styles.title}>{t('page.buy.quote.title')}</Text>
      <View style={styles.container}>
        {quotes.map((e, idx) => (
          <QuoteItem
            name={e.service_provider.name}
            id={e.service_provider.id}
            key={e.service_provider.id}
            symbol={symbol}
            logo={e.service_provider.logo_url || e.service_provider.image_url}
            amount={e.token_amount}
            activeProvider={activeProvider}
            isBest={idx === 0}
            setActiveProvider={setActiveProvider}
            payments={e.paymentMethod}
          />
        ))}
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
