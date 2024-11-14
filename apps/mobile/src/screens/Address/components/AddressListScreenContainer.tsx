import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { useNavigationState } from '@react-navigation/native';
import { useAccounts } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { RootNames } from '@/constant/layout';
import { useNavigation } from '@react-navigation/core';
import { RootStackParamsList } from '@/navigation-type';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { redirectToAddAddressEntry } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import WalletSVG from '@/assets2024/icons/common/wallet-cc.svg';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { useOpenDappView } from '@/screens/Dapps/hooks/useDappView';
import { useSetPasswordFirst } from '@/hooks/useLock';

type CurrentAddressProps = NativeStackScreenProps<
  RootStackParamsList,
  'StackAddress'
>;

export const AddressListScreenContainer: React.FC<any> = ({ children }) => {
  const { accounts } = useAccounts();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { openUrlAsDapp } = useOpenDappView();
  const { shouldRedirectToSetPasswordBefore2024 } = useSetPasswordFirst();

  const navState = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.AddressList)?.params,
  ) as
    | {
        backToDappOnClose?: string | undefined;
      }
    | undefined;

  React.useEffect(() => {
    return () => {
      if (navState?.backToDappOnClose) {
        openUrlAsDapp(navState?.backToDappOnClose, {
          showSheetModalFirst: false,
        });
      }
    };
  }, [navState, openUrlAsDapp]);

  const navigation = useNavigation<CurrentAddressProps['navigation']>();

  const gotoAddAddress = React.useCallback(() => {
    // redirectToAddAddressEntry({ action: 'classical:push' });

    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.ADD_ADDRESS_SELECT_METHOD,
      onDone: () => {
        removeGlobalBottomSheetModal2024(id);
      },
      shouldRedirectToSetPasswordBefore2024,
    });
  }, [shouldRedirectToSetPasswordBefore2024]);

  useEffect(() => {
    if (!accounts?.length) {
      redirectToAddAddressEntry({ action: 'classical:resetTo' });
    }
  }, [accounts, navigation]);

  return (
    <FooterButtonScreenContainer
      footerContainerStyle={styles.footer}
      buttonProps={{
        title: (
          <View style={styles.buttonTitle}>
            <WalletSVG
              width={20}
              height={20}
              color={colors2024['brand-default']}
            />
            <Text style={styles.buttonTitleText}>Add an Address</Text>
          </View>
        ),
        type: 'ghost',
        onPress: gotoAddAddress,
        buttonStyle: {
          marginTop: 20,
          width: 200,
          margin: 'auto',
          backgroundColor: 'transparent',
        },
      }}
      footerBottomOffset={76}>
      {children}
    </FooterButtonScreenContainer>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
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
}));
