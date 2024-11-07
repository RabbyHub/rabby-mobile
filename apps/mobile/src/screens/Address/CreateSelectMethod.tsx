import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React from 'react';

import {
  View,
  Text,
  TouchableWithoutFeedback,
  Keyboard,
  StyleSheet,
} from 'react-native';

import HelpIcon from '@/assets2024/icons/common/help.svg';
import { RootNames } from '@/constant/layout';
import { default as RcIconBackupCloud } from '@/assets/icons/nextComponent/IconBackupCloud.svg';
import { default as RcIconBackupManual } from '@/assets/icons/nextComponent/IconBackupManual.svg';
import IcRightArrow from '@/assets2024/icons/common/IcRightArrow.svg';
import { useNavigationState } from '@react-navigation/native';
import { Card } from '@/components2024/Card';
import { useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { ListItem } from '@/components2024/ListItem/ListItem';
import { ProgressBar } from '@/components2024/progressBar';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import LinearGradient from 'react-native-linear-gradient';
import { IS_IOS } from '@/core/native/utils';
import { navigate } from '@/utils/navigation';

function MainListBlocks() {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  const state = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.CreateChooseBackup)?.params,
  ) as {
    address: string;
    alias: string;
    seedPhrase: string;
    firstAddress: any;
  };
  console.log('state3', state);

  const handleCreateNewSeed = React.useCallback(() => {
    navigate(RootNames.StackAddress2024, {
      screen: RootNames.CreateNewAddress,
      params: {
        noSetupPassword: 2,
        useCurrentSeed: false,
        title: '2. Name Your Address',
      },
    });
  }, []);

  const handleCreateCurrentSeed = React.useCallback(() => {
    navigate(RootNames.StackAddress2024, {
      screen: RootNames.CreateSelectOnCurrentSeed,
    });
  }, []);

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        Keyboard.dismiss();
      }}>
      <View style={[styles.container]}>
        <ProgressBar amount={3} currentCount={1} />
        <Card
          style={[styles.listItem, styles.marginTop]}
          onPress={handleCreateNewSeed}>
          <View style={styles.titleContainer}>
            <Text style={styles.titleText}>Create New Seed Phrase</Text>
            <IcRightArrow />
          </View>
          <Text style={styles.tipText}>
            {'Create new seed phrase and an new address'}
          </Text>
        </Card>
        <Card style={styles.listItem} onPress={handleCreateCurrentSeed}>
          <View style={styles.titleContainer}>
            <Text style={styles.titleText}>Create on Current Seed Phrase </Text>
            <IcRightArrow />
          </View>
          <Text style={styles.tipText}>
            {'Create address on one of your imported seed phrase'}
          </Text>
        </Card>
      </View>
    </TouchableWithoutFeedback>
  );
}

function CreateSelectMethod(): JSX.Element {
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
  titleContainer: {
    display: 'flex',
    flexWrap: 'nowrap',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  marginTop: {
    marginTop: 40,
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
    marginBottom: 12,
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
    height: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 20,
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
}));

export default CreateSelectMethod;
