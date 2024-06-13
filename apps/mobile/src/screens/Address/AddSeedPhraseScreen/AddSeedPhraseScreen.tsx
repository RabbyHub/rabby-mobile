import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { useSeedPhrase } from '@/hooks/useSeedPhrase';
import { createGetStyles } from '@/utils/styles';
import { View } from 'react-native';
import { SeedPhraseGroup } from './SeedPhraseGroup';
import { useThemeStyles } from '@/hooks/theme';

export const AddSeedPhraseScreen = () => {
  const { seedPhraseList, handleAddSeedPhraseAddress } = useSeedPhrase();
  const { styles } = useThemeStyles(getStyle);

  return (
    <NormalScreenContainer>
      <View style={styles.main}>
        {seedPhraseList.map((item, index) => (
          <SeedPhraseGroup
            onAddAddress={handleAddSeedPhraseAddress}
            key={index}
            index={index}
            data={item}
          />
        ))}
      </View>
    </NormalScreenContainer>
  );
};

const getStyle = createGetStyles(colors => {
  return {
    main: {
      paddingHorizontal: 20,
    },
  };
});
