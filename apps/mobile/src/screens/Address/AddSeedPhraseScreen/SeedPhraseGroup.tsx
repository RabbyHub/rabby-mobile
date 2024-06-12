import { createGetStyles } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useThemeStyles } from '@/hooks/theme';

export const SeedPhraseGroup = () => {
  const { t } = useTranslation();
  const { styles } = useThemeStyles(getStyle);

  return <View></View>;
};

const getStyle = createGetStyles(colors => {
  return {
    checklist: {
      gap: 12,
      marginBottom: 24,
    },
  };
});
