import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { RcIconLogo, RcIconLogoBlue } from '@/assets/icons/common';
import { RootNames } from '@/constant/layout';
import { keyringService, preferenceService } from '@/core/services';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { navigate } from '@/utils/navigation';
// import { Button } from '@rneui/themed';
// import { Button } from '@/components/Button';
import { Button } from '@/components2024/Button';
import { Card } from '@/components2024/Card';
import { FooterButtonGroup } from '@/components2024/FooterButtonGroup';
import { useMemoizedFn, useRequest } from 'ahooks';
import axios from 'axios';
import {
  StackActions,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import { useAppUnlocked } from '@/hooks/useLock';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import TouchableText from '@/components/Touchable/TouchableText';

function SampleGetStartedScreen2024(): JSX.Element {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const [isShowModal, setIsShowModal] = useState(false);
  const [isFocus, setIsFocus] = useState(false);
  const [code, setCode] = useState('');
  const [errMessage, setErrMessage] = useState('');

  const [isInited, setIsInited] = useState(false);
  const handleGoToHome = useCallback(async () => {
    if (!isInited) return;
    if (!keyringService.isUnlocked()) {
      navigate(RootNames.Unlock);
      return;
    }

    navigate(RootNames.StackRoot, { screen: RootNames.Home });
  }, [isInited]);

  const handleGoToCreate = useCallback(async () => {
    if (!isInited) return;
    if (!keyringService.isUnlocked()) {
      navigate(RootNames.Unlock);
      return;
    }

    navigate(RootNames.StackAddress2024, {
      screen: RootNames.CreateNewAddress,
    });
  }, [isInited]);

  useEffect(() => {
    if (isShowModal) {
      setCode('');
      setErrMessage('');
    }
  }, [isShowModal]);

  const navigation = useNavigation();

  const initAccounts = useMemoizedFn(async () => {
    setIsInited(false);
    try {
      const accounts = await keyringService.getAllVisibleAccountsArray();
      // if (accounts?.length) {
      //   navigation.dispatch(
      //     StackActions.replace(RootNames.StackRoot, {
      //       screen: RootNames.Home,
      //     }),
      //   );
      // }
    } catch (err) {
      console.error(err);
    } finally {
      setIsInited(true);
    }
  });

  const { isAppUnlocked } = useAppUnlocked();
  useFocusEffect(
    useCallback(() => {
      if (isAppUnlocked) {
        initAccounts();
      }
    }, [isAppUnlocked, initAccounts]),
  );

  return (
    <View style={styles.screen}>
      <View style={styles.offsetArea} />
      <View style={styles.contentArea}>
        <View style={styles.centerWrapper}>
          {/* <RcIconLogo /> */}
          <View style={styles.logoWrapper}>
            <RcIconLogoBlue
              style={{ width: LOGO_SIZE.width, height: LOGO_SIZE.height }}
            />
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.appName}>Rabby Wallet</Text>
          </View>
        </View>

        <View style={styles.bottomArea}>
          <Text style={styles.appDesc}>
            The game-changing wallet
            {'\n'}
            for Ethereum and all EVM chains
          </Text>
          <Button
            type="primary"
            title="Create New Address"
            onPress={handleGoToCreate}
          />
          <TouchableText style={styles.touchableText}>
            I already have a address
          </TouchableText>
        </View>
      </View>
    </View>
  );
}

const LOGO_SIZE = {
  wrapperWidth: 156,
  wrapperHeight: 156,
  width: 86,
  height: 76,
};

const getStyles = createGetStyles2024(ctx =>
  StyleSheet.create({
    screen: {
      backgroundColor: ctx.colors['neutral-card1'],
      flexDirection: 'column',
      justifyContent: 'center',
      height: '100%',
    },
    offsetArea: {
      flexShrink: 0,
      height:
        Math.floor(Dimensions.get('screen').height - LOGO_SIZE.wrapperHeight) /
        2,
    },
    contentArea: {
      flexShrink: 1,
      height: '100%',
      maxHeight: '100%',
      flexDirection: 'column',
      justifyContent: 'space-between',
      paddingBottom: 84,
      // ...makeDebugBorder(),
    },
    centerWrapper: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      // flex: 1,
      // leave here for debug
      // ...makeDebugBorder('yellow'),
    },
    logoWrapper: {
      width: LOGO_SIZE.wrapperWidth,
      // height: LOGO_SIZE.wrapperHeight,
      justifyContent: 'flex-start',
      alignItems: 'center',
      // leave here for debug
      // ...makeDebugBorder('red'),
    },
    titleContainer: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 12,
    },
    appName: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      color: ctx.colors['neutral-title-1'],
      fontSize: 24,
      lineHeight: 28,
    },
    appDesc: {
      color: ctx.colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 17,
      lineHeight: 24,
      textAlign: 'center',
      fontWeight: '500',
      marginTop: 32,
    },
    modalTitle: {
      color: ctx.colors['neutral-title-1'],
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '500',
      marginBottom: 20,
      textAlign: 'center',
    },
    modalFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 26,
      width: '100%',
      gap: 10,
    },
    flex1: {
      flex: 1,
    },
    bottomArea: {
      flexDirection: 'column',
      alignItems: 'center',
      // paddingBottom: 184,
      // ...makeDebugBorder(),
    },
    buttonContainerStyle: {
      width: 268,
      borderRadius: 56,
    },
    buttonStyle: {
      overflow: 'hidden',
    },
    buttonTitleStyle: {
      // __DEBUG_FONT_STYLE__: true,
      fontSize: 20,
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      color: ctx.colors2024['neutral-InvertHighlight'],
    },

    touchableText: {
      marginTop: 22,
      fontSize: 17,
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      color: ctx.colors2024['brand-default'],
    },
  }),
);

export default SampleGetStartedScreen2024;
