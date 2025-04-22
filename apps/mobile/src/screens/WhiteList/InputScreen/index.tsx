import React, { useCallback, useEffect, useState } from 'react';
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
import { useNavigationState } from '@react-navigation/native';
import { useSendRoutes } from '@/hooks/useSendRoutes';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { useWhiteListAddress } from '@/screens/Send/hooks/useWhiteListAddress';
import RcIconSwapHistory from '@/assets2024/icons/common/IconHistoryCC.svg';
import { trigger } from 'react-native-haptic-feedback';
import EditSVG from '@/assets2024/icons/common/edit-cc.svg';
import { useAliasNameEditModal } from '@/components2024/AliasNameEditModal/useAliasNameEditModal';
import { AppSwitch2024 } from '@/components/customized/Switch2024';
import TouchableView from '@/components/Touchable/TouchableView';
import { CaretDownIconCC } from '@/components/AccountSwitcher/icons/CaretDownIconCC';
import { SendHistory } from '@/screens/Send/SubScreens/SelectPolyScreen/SendHistory';
import { HistoryDisplayItem } from '@/screens/Transaction/MultiAddressHistory';
import { toast } from '@/components2024/Toast';
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

const WhitelistInputScreen = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const [input, setInput] = useState('');
  const [error, setError] = useState<INPUT_ERROR>();
  const [isCex, setIsCex] = useState(false);
  const scanner = useScanner();
  const [loading, setLoading] = useState(false);
  const navParams = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.SendInput)?.params,
  ) as {
    autoScan?: boolean;
  };

  const { navigateToSendScreen } = useSendRoutes();

  const { findAccount } = useWhiteListAddress(true);
  const { addWhitelist } = useWhitelist();

  const { t } = useTranslation();
  const [historyVisible, setHistoryVisible] = useState(false);

  const closeHistory = useCallback(() => {
    setHistoryVisible(false);
  }, []);

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
      const { inWhitelist, account, isMyImported } = await findAccount(
        address,
        undefined,
        true,
      );

      if (inWhitelist || isMyImported) {
        navigateToSendScreen({
          toAddress: account.address,
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

  const handleSubmit = useCallback((text: string) => {
    setError(undefined);
    setInput(text);
  }, []);
  const openSendHistory = useCallback(() => {
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });

    setHistoryVisible(true);
    Keyboard.dismiss();
  }, [setHistoryVisible]);

  const editAliasName = useAliasNameEditModal();
  // TODO:
  const isOpen = false;

  useEffect(() => {
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
    <>
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
              <View style={styles.header}>
                <Text style={styles.headerText}>Address</Text>
                <TouchableOpacity onPress={openSendHistory}>
                  <RcIconSwapHistory
                    style={styles.icon}
                    color={colors2024['neutral-body']}
                  />
                </TouchableOpacity>
              </View>
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
                    <View style={[ctx.wrapperStyle, styles.customContainer]}>
                      <PasteButton
                        style={styles.pasteButton}
                        onPaste={text => {
                          handleSubmit(text);
                        }}
                      />
                      <TouchableOpacity
                        onPress={() => {
                          navigate(RootNames.Scanner);
                        }}>
                        <RcIconScannerCC
                          style={ctx.iconStyle}
                          color={colors2024['neutral-title-1']}
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                />
                {error && (
                  <Text style={styles.errorMessage}>
                    {ERROR_MESSAGE[error]}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.nameContent}>
              <View style={styles.header}>
                <Text style={styles.headerText}>Name</Text>
              </View>
              <View style={styles.editContainer}>
                <Text style={styles.aliasName}>name</Text>
                <TouchableOpacity
                  onPress={() => {
                    // editAliasName.show(account);
                  }}
                  hitSlop={10}
                  style={styles.button}>
                  <EditSVG
                    color={colors2024['neutral-body']}
                    width={20}
                    height={20}
                  />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.exChangeContent}>
              <View style={styles.header}>
                <Text style={styles.headerText}>Exchange address?</Text>
                <AppSwitch2024 onValueChange={setIsCex} value={isCex} />
              </View>

              <TouchableView style={styles.selectCex} onPress={() => {}}>
                <View style={styles.addressRow}>
                  <Text style={styles.toSelect}>Select exchange</Text>
                  <CaretDownIconCC
                    style={[styles.caretIcon, isOpen && styles.reverseCaret]}
                    width={26}
                    height={26}
                    bgColor={colors2024['neutral-line']}
                    lineColor={colors2024['neutral-title-1']}
                  />
                </View>
              </TouchableView>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </FooterButtonScreenContainer>
      <SendHistory
        visible={historyVisible}
        onClose={closeHistory}
        title={t('page.sendPoly.SelectFromHistory')}
        onPressBottomBtn={() => {}} // todo click AddToWhitelist cb
      />
    </>
  );
};

export default WhitelistInputScreen;

const getStyles = createGetStyles2024(ctx => ({
  screen: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  container: {
    display: 'flex',
    alignItems: 'center',
    // justifyContent: 'space-between',
    position: 'relative',
    height: '100%',
    width: '100%',
    paddingHorizontal: 20,
  },
  topContent: {
    paddingTop: 16,
    // alignItems: 'center',
    // flexShrink: 0,
  },
  nameContent: {
    width: '100%',
    marginTop: 30,
  },
  errorMessage: {
    color: ctx.colors2024['red-default'],
    fontSize: 13,
    marginTop: 12,
    marginBottom: 16,
  },

  textContainer: {
    backgroundColor: ctx.colors2024['neutral-bg-2'],
    height: 140,
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
    borderWidth: 0,
    padding: 0,
    paddingHorizontal: 0,
    width: 'auto',
    gap: 4,
  },
  customContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  headerText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  icon: {
    width: 20,
    height: 20,
  },
  aliasName: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  button: {
    padding: 5,
    backgroundColor: ctx.colors2024['neutral-line'],
    borderRadius: 30,
  },
  editContainer: {
    backgroundColor: ctx.colors2024['neutral-bg-2'],
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 15,
    paddingBottom: 17,
    paddingHorizontal: 20,
  },
  exChangeContent: {
    width: '100%',
    marginTop: 32,
  },
  selectCex: {
    backgroundColor: ctx.colors2024['neutral-bg-2'],
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  caretIcon: {
    marginLeft: 'auto',
  },
  reverseCaret: {
    transform: [{ rotate: '180deg' }],
  },
  addressRow: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
  },
  toSelect: {
    fontSize: 17,
    lineHeight: 22,
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
}));
