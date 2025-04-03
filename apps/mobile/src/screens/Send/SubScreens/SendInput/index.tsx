import React, { useEffect, useState } from 'react';
import { RcIconScannerCC } from '@/assets/icons/address';
import { Text } from '@/components';
import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { navigate } from '@/utils/navigation';
import { isValidHexAddress } from '@metamask/utils';
import {
  Keyboard,
  TouchableOpacity,
  View,
  TouchableWithoutFeedback,
} from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { NextInput } from '@/components2024/Form/Input';
import PasteButton from '@/components2024/PasteButton';
import { useTranslation } from 'react-i18next';
import { useScanner } from '@/screens/Scanner/ScannerScreen';
import { useWhiteListAddress } from '../../hooks/useWhiteListAddress';
import { openapi } from '@/core/request';
import { useNavigationState } from '@react-navigation/native';
import { toast } from '@/components2024/Toast';
import { useSendRoutes } from '@/hooks/useSendRoutes';
import { useAtom } from 'jotai';
import { addrDescInfoAtoms } from '@/hooks/useAddrDesc';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { useWhitelist } from '@/hooks/whitelist';

enum INPUT_ERROR {
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  ADDRESS_EXIST = 'ADDRESS_EXIST',
  REQUIRED = 'REQUIRED',
}

const ERROR_MESSAGE = {
  [INPUT_ERROR.INVALID_ADDRESS]:
    "The address you're are trying to import is invalid",
  [INPUT_ERROR.ADDRESS_EXIST]:
    "The address you're are trying to import is duplicated",
  [INPUT_ERROR.REQUIRED]: 'Please input address',
};

const SendInputScreen = ({ isForWhitelist }: { isForWhitelist: boolean }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const [input, setInput] = React.useState('');
  const [error, setError] = React.useState<INPUT_ERROR>();
  const scanner = useScanner();
  const [loading, setLoading] = useState(false);
  const navParams = useNavigationState(
    s =>
      s.routes.find(
        r =>
          r.name ===
          (isForWhitelist ? RootNames.WhitelistInput : RootNames.SendInput),
      )?.params,
  ) as {
    autoScan?: boolean;
  };
  const { addWhitelist } = useWhitelist();

  const { navigateToSendScreen } = useSendRoutes();

  const { findAccount } = useWhiteListAddress(true);
  const [addrDescInfo, setAddrDescInfo] = useAtom(addrDescInfoAtoms);

  const { t } = useTranslation();

  const handleDone = async () => {
    if (!input) {
      setError(INPUT_ERROR.REQUIRED);
      return;
    }

    let address = input;
    if (!isValidHexAddress(address as any)) {
      setError(INPUT_ERROR.INVALID_ADDRESS);
      return;
    }
    try {
      setLoading(true);
      Keyboard.dismiss();
      const { inWhitelist, account } = await findAccount(
        address,
        undefined,
        true,
      );

      if (isForWhitelist) {
        if (inWhitelist) {
          toast.show(t('page.whitelist.alreadyAdded'));
        } else {
          const id = createGlobalBottomSheetModal2024({
            name: MODAL_NAMES.CONFIRM_ADDRESS,
            account,
            title: t('page.confirmAddress.addToWhitelist'),
            disbaleWhiteSwitch: true,
            bottomSheetModalProps: {
              enableDynamicSizing: true,
            },
            onCancel: () => {
              removeGlobalBottomSheetModal2024(id);
            },
            onConfirm() {
              removeGlobalBottomSheetModal2024(id);
              addWhitelist(account.address, {
                onAdded: () => {
                  toast.success(t('page.whitelist.addSuccessful'));
                },
              });
            },
          });
        }
        return;
      }
      if (inWhitelist) {
        let addrDesc = addrDescInfo[address];
        if (!addrDesc) {
          const { desc } = await openapi.addrDesc(address);
          addrDesc = desc;
          setAddrDescInfo(prev => ({ ...prev, [address]: addrDesc }));
        }
        navigateToSendScreen({
          toAddress: account.address,
          addrDesc: addrDesc,
          addressBrandName: account.brandName,
        });
      } else {
        const id = createGlobalBottomSheetModal2024({
          name: MODAL_NAMES.CONFIRM_ADDRESS,
          account,
          bottomSheetModalProps: {
            enableDynamicSizing: true,
          },
          onCancel: () => {
            removeGlobalBottomSheetModal2024(id);
          },
          onConfirm(acc, addressDesc) {
            removeGlobalBottomSheetModal2024(id);
            navigateToSendScreen({
              addressBrandName: acc.brandName,
              addrDesc: addressDesc,
              toAddress: acc.address,
            });
          },
        });
      }
    } catch (err: any) {
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = React.useCallback((text: string) => {
    setError(undefined);
    setInput(text);
  }, []);

  React.useEffect(() => {
    if (scanner.text) {
      setInput(scanner.text);
      scanner.clear();
    }
  }, [scanner]);
  useEffect(() => {
    if (navParams?.autoScan) {
      navigate(RootNames.Scanner);
    }
  }, [navParams?.autoScan]);

  return (
    <FooterButtonScreenContainer
      as="View"
      buttonProps={{
        title: t('global.Confirm'),
        onPress: handleDone,
        loading: loading,
        disabled: !input || !!error,
      }}
      style={styles.screen}
      footerBottomOffset={56}
      footerContainerStyle={{
        paddingHorizontal: 20,
      }}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <View style={styles.topContent}>
            <View>
              <NextInput.TextArea
                style={styles.textContainer}
                inputStyle={styles.textArea}
                tipText={''}
                hasError={!!error}
                fieldErrorTextStyle={styles.error}
                containerStyle={Object.assign(
                  {
                    borderRadius: 16,
                  },
                  error
                    ? {}
                    : {
                        borderColor: 'transparent',
                      },
                )}
                inputProps={{
                  placeholder: t('page.sendPoly.enterAddress'),
                  placeholderTextColor: colors2024['neutral-secondary'],
                  value: input,
                  blurOnSubmit: true,
                  autoFocus: true,
                  returnKeyType: 'done',
                  onChangeText: handleSubmit,
                }}
                // eslint-disable-next-line react/no-unstable-nested-components
                customIcon={ctx => (
                  <TouchableOpacity
                    style={ctx.wrapperStyle}
                    onPress={() => {
                      navigate(RootNames.Scanner);
                    }}>
                    <RcIconScannerCC
                      style={ctx.iconStyle}
                      color={colors2024['neutral-title-1']}
                    />
                  </TouchableOpacity>
                )}
              />
              {error && (
                <Text style={styles.errorMessage}>{ERROR_MESSAGE[error]}</Text>
              )}
            </View>

            <PasteButton
              style={styles.pasteButton}
              onPaste={text => {
                handleSubmit(text);
              }}
            />
          </View>
        </View>
      </TouchableWithoutFeedback>
    </FooterButtonScreenContainer>
  );
};

SendInputScreen.ForWhitelist = () => {
  return <SendInputScreen isForWhitelist />;
};

export default SendInputScreen;

const getStyles = createGetStyles2024(ctx => ({
  screen: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    height: '100%',
    width: '100%',
    paddingHorizontal: 20,
  },
  topContent: {
    alignItems: 'center',
    flexShrink: 0,
  },
  errorMessage: {
    color: ctx.colors2024['red-default'],
    fontSize: 13,
    marginTop: 12,
    marginBottom: 16,
  },

  textContainer: {
    backgroundColor: ctx.colors2024['neutral-bg-2'],
  },
  textArea: {
    marginTop: 14,
    paddingHorizontal: 20,
    backgroundColor: ctx.colors['neutral-card-1'],
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
  error: {
    textAlign: 'left',
  },
  pasteButton: {
    marginTop: 58,
  },
}));
