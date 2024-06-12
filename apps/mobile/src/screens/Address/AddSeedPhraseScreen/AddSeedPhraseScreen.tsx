import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

export const AddSeedPhraseScreen = () => {
  const { t } = useTranslation();

  return (
    <NormalScreenContainer>
      <View>
        <Text>123</Text>
      </View>
    </NormalScreenContainer>
  );
};
