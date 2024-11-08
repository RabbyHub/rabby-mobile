import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React from 'react';

import { View, Text, ScrollView } from 'react-native';
import { RootNames } from '@/constant/layout';
import { default as RcIconBackupCloud } from '@/assets/icons/nextComponent/IconBackupCloud.svg';
import { default as RcIconBackupManual } from '@/assets/icons/nextComponent/IconBackupManual.svg';
import IcRightArrow from '@/assets2024/icons/common/IcRightArrow.svg';
import { useNavigationState } from '@react-navigation/native';
import { Card } from '@/components2024/Card';
import { useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { ProgressBar } from '@/components2024/progressBar';
import { SeedPhraseGroup } from './SeedPhraseGroup';
import LinearGradient from 'react-native-linear-gradient';
import { IS_IOS } from '@/core/native/utils';
import { navigate } from '@/utils/navigation';
import { useSeedPhrase } from '@/hooks/useSeedPhrase';

function MainListBlocks() {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });
  const { seedPhraseList, handleAddSeedPhraseAddress2024 } = useSeedPhrase();
  console.log('seedPhraseList', seedPhraseList?.[0]?.list);
  const state = useNavigationState(
    s =>
      s.routes.find(r => r.name === RootNames.CreateSelectOnCurrentSeed)
        ?.params,
  ) as {
    address: string;
    alias: string;
    seedPhrase: string;
    firstAddress: any;
  };
  console.log('state3', state);

  return (
    <View style={[styles.container]}>
      <ProgressBar amount={3} currentCount={2} />
      <ScrollView style={styles.main}>
        {seedPhraseList.map((item, index) => (
          <SeedPhraseGroup
            onAddAddress={handleAddSeedPhraseAddress2024}
            key={index}
            index={index}
            data={item}
            style={styles.group}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function CreateSelectOnCurrentSeed(): JSX.Element {
  const { colors2024 } = useTheme2024({ getStyle });
  return (
    <NormalScreenContainer>
      <LinearGradient
        colors={['#FFF', '#F9F9F9']} // 渐变颜色
        start={{ x: 0, y: 0 }} // 渐变起始位置
        end={{ x: 0, y: 1 }} // 渐变结束位置
        // style={{
        //   height: '100%',
        // }}
      >
        <MainListBlocks />
      </LinearGradient>
    </NormalScreenContainer>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  main: {
    // paddingHorizontal: 20,
    width: '100%',
    marginTop: 32,
  },
  group: {
    marginBottom: 20,
    borderRadius: 30,
    // padding: 10,
    backgroundColor: colors2024['neutral-bg-1'],
    overflow: 'hidden',
    borderColor: colors2024['neutral-line'],
    borderWidth: 1,
    borderStyle: 'solid',
  },
  marginTop: {
    marginTop: 40,
  },
  container: {
    height: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
}));

export default CreateSelectOnCurrentSeed;
