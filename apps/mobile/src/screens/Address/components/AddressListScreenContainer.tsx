import React, { useEffect } from 'react';
import { View, Text, TouchableNativeFeedback } from 'react-native';
import { useNavigationState } from '@react-navigation/native';
import { useAccounts } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { AppRootName, RootNames } from '@/constant/layout';
import { StackActions, useNavigation } from '@react-navigation/core';
import { RootStackParamsList } from '@/navigation-type';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { redirectToAddAddressEntry } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import WalletSVG from '@/assets2024/icons/common/wallet-cc.svg';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { useOpenDappView } from '@/screens/Dapps/hooks/useDappView';
import { useSetPasswordFirst } from '@/hooks/useLock';
import { Button } from '@/components2024/Button';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import LinearGradient from 'react-native-linear-gradient';
import { colord } from 'colord';
import { useTranslation } from 'react-i18next';

type CurrentAddressProps = NativeStackScreenProps<
  RootStackParamsList,
  'StackAddress'
>;

export const AddressListScreenContainer: React.FC<any> = ({ children }) => {
  const { accounts } = useAccounts();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  // const { openUrlAsDapp } = useOpenDappView();
  const { shouldRedirectToSetPasswordBefore2024 } = useSetPasswordFirst();
  const { t } = useTranslation();

  const navState = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.AddressList)?.params,
  ) as
    | {
        backToDappOnClose?: string | undefined;
      }
    | undefined;

  // React.useEffect(() => {
  //   return () => {
  //     if (navState?.backToDappOnClose) {
  //       openUrlAsDapp(navState?.backToDappOnClose, {
  //         showSheetModalFirst: false,
  //       });
  //     }
  //   };
  // }, [navState, openUrlAsDapp]);

  const navigation = useNavigation<CurrentAddressProps['navigation']>();

  const gotoAddAddress = React.useCallback(() => {
    // redirectToAddAddressEntry({ action: 'classical:push' });

    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.ADD_ADDRESS_SELECT_METHOD,
      onDone: () => {
        removeGlobalBottomSheetModal2024(id);
      },
      shouldRedirectToSetPasswordBefore2024,
      navigateTo: (screen: AppRootName, params?: object) => {
        navigation.dispatch(
          StackActions.push(RootNames.StackAddress, {
            screen,
            params,
          }),
        );
      },
    });
  }, [shouldRedirectToSetPasswordBefore2024, navigation]);

  useEffect(() => {
    if (!accounts?.length) {
      redirectToAddAddressEntry({ action: 'classical:resetTo' });
    }
  }, [accounts, navigation]);

  return (
    <NormalScreenContainer2024 overwriteStyle={styles.root}>
      {children}
      <LinearGradient
        pointerEvents="none"
        colors={[
          colord(colors2024['neutral-bg-3']).alpha(0.3).toHex(),
          colors2024['neutral-bg-1'],
        ]}
        style={styles.footerShadow}
      />
      <View style={styles.buttonWrapper}>
        <Button
          TouchableComponent={TouchableNativeFeedback}
          buttonStyle={styles.button}
          type="ghost"
          onPress={gotoAddAddress}
          title={
            <View style={styles.buttonTitle}>
              <WalletSVG
                width={20}
                height={20}
                color={colors2024['brand-default']}
              />
              <Text style={styles.buttonTitleText}>
                {t('page.addressDetail.addressListScreen.addAddress')}
              </Text>
            </View>
          }
        />
      </View>
    </NormalScreenContainer2024>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    position: 'relative',
  },
  buttonTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  buttonTitleText: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['brand-default'],
  },
  footer: {
    alignItems: 'center',
  },
  footerShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    height: 122,
  },
  button: {
    width: 200,
    margin: 'auto',
    backgroundColor: colors2024['neutral-bg-3'],
  },
  buttonWrapper: {
    position: 'absolute',
    zIndex: 1,
    bottom: 56,
    width: 200,
    left: '50%',
    marginLeft: -100,
  },
}));
