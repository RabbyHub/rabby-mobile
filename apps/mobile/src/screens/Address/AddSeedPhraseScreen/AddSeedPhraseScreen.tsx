import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { useSeedPhrase } from '@/hooks/useSeedPhrase';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

export const AddSeedPhraseScreen = () => {
  const { t } = useTranslation();
  const { seedPhraseList } = useSeedPhrase();

  return (
    <NormalScreenContainer>
      <View>
        <Text>Coming soon</Text>
      </View>
    </NormalScreenContainer>
  );
};
