import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React from 'react';

import {
  ScrollView,
  View,
  Text,
  TouchableWithoutFeedback,
  Keyboard,
  TouchableOpacity,
} from 'react-native';
import { RootNames } from '@/constant/layout';
import IcRightArrow from '@/assets2024/icons/common/IcRightArrow.svg';
import { StackActions, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useSeedPhrase } from '@/hooks/useSeedPhrase';
import { SeedPhraseGroup } from './CreateSelectOnCurrentSeed/SeedPhraseGroup';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function MainListBlocks() {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { seedPhraseList, handleAddSeedPhraseAddress2024 } = useSeedPhrase();
  const navigation = useNavigation();
  const { bottom } = useSafeAreaInsets();

  const handleCreateNewSeed = React.useCallback(() => {
    navigation.dispatch(
      StackActions.push(RootNames.StackAddress, {
        screen: RootNames.CreateNewAddress,
        params: {
          noSetupPassword: true,
          useCurrentSeed: false,
        },
      }),
    );
  }, [navigation]);

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        Keyboard.dismiss();
      }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(bottom, 20) },
        ]}>
        <TouchableOpacity
          style={styles.titleContainer}
          onPress={handleCreateNewSeed}>
          <Text style={styles.titleText}>
            {t('page.nextComponent.createNewAddress.createNewSeedPhrase')}
          </Text>
          <IcRightArrow
            color={colors2024['neutral-title-1']}
            width={12}
            height={12}
          />
        </TouchableOpacity>

        {Boolean(seedPhraseList.length) &&
          seedPhraseList.map((item, index) => (
            <SeedPhraseGroup
              onAddAddress={handleAddSeedPhraseAddress2024}
              key={index}
              index={index}
              data={item}
              style={styles.group}
            />
          ))}
      </ScrollView>
    </TouchableWithoutFeedback>
  );
}

function CreateSelectMethod(): JSX.Element {
  const { colors2024 } = useTheme2024({ getStyle });
  return (
    <NormalScreenContainer
      overwriteStyle={{
        backgroundColor: colors2024['neutral-bg-0'],
      }}>
      <MainListBlocks />
    </NormalScreenContainer>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  titleContainer: {
    display: 'flex',
    flexWrap: 'nowrap',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  marginTop: {
    marginTop: 28,
  },
  titleText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'left',
    color: colors2024['neutral-title-1'],
    // marginRight: 4,
  },
  tipText: {
    color: colors2024['neutral-secondary'],
    fontWeight: '400',
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'left',
    fontFamily: 'SF Pro Rounded',
    marginTop: 10,
    marginBottom: 12,
  },
  listItem: {
    position: 'relative',
    width: '100%',
    // marginBottom: 12,
    borderRadius: 30,
    display: 'flex',
    alignItems: 'flex-start',
    // padding: 24,
    // gap: 10,
  },
  text: {
    color: colors2024['neutral-secondary'],
    fontWeight: '400',
    fontSize: 17,
    marginTop: 34,
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
  },
  container: {
    flex: 1,
    display: 'flex',
  },
  content: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  inputContainer: {
    marginVertical: 8,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  inputInner: {
    width: '100%',
    textAlignVertical: 'center',
    height: 54,
    padding: 0,
    fontSize: 36,
    borderWidth: 0,
    backgroundColor: 'transparent',
    lineHeight: 42,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
  group: {
    width: '100%',
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 16,
  },
}));

export default CreateSelectMethod;
