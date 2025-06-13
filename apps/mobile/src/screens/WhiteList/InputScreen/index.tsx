import React, { useCallback, useEffect, useRef, useState } from 'react';
import ScannerCC from '@/assets2024/icons/common/scanner-cc.svg';
import { Text } from '@/components';
import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { navigate } from '@/utils/navigation';
import { isValidHexAddress, Hex } from '@metamask/utils';
import {
  Keyboard,
  TouchableOpacity,
  View,
  TouchableWithoutFeedback,
  Image,
} from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { NextInput } from '@/components2024/Form/Input';
import PasteButton from '@/components2024/PasteButton';
import { useTranslation } from 'react-i18next';
import { useScanner } from '@/screens/Scanner/ScannerScreen';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import {
  createGlobalBottomSheetModal2024,
  globalBottomSheetModalAddListener2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import {
  EVENT_NAMES,
  MODAL_NAMES,
} from '@/components2024/GlobalBottomSheetModal/types';
import { useWhiteListAddress } from '@/screens/Send/hooks/useWhiteListAddress';
import RcIconSwapHistory from '@/assets2024/icons/common/IconHistoryCC.svg';
import EditSVG from '@/assets2024/icons/common/edit-cc.svg';
import { useAliasNameEditModal } from '@/components2024/AliasNameEditModal/useAliasNameEditModal';
import { AppSwitch2024 } from '@/components/customized/Switch2024';
import TouchableView from '@/components/Touchable/TouchableView';
import { CaretDownIconCC } from '@/components/AccountSwitcher/icons/CaretDownIconCC';
import { SendHistory } from '@/screens/Send/SubScreens/SelectPolyScreen/SendHistory';
import { whitelistAtom } from '@/hooks/whitelist';
import { contactService, whitelistService } from '@/core/services';
import { ProjectItem } from '@rabby-wallet/rabby-api/dist/types';
import { useCexSupportList } from '@/hooks/useCexSupportList';
import { getAddrDescWithCexLocalCacheSync } from '@/databases/hooks/cex';
import { setCexId } from '@/utils/addressCexId';
import { useAtom } from 'jotai';
import { toast } from '@/components2024/Toast';
import { useAlert } from './useAlert';
import { useSendRoutes } from '@/hooks/useSendRoutes';
import { matomoRequestEvent } from '@/utils/analytics';
import useAutoFocusInput from '@/hooks/useAutoFocusInput';
import { ellipsisAddress } from '@/utils/address';
import { useAccounts } from '@/hooks/account';
import { useMemoizedFn } from 'ahooks';

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
  const [isCex, setIsCex] = useState(false);
  const [aliasName, setAliasName] = useState('');
  const [cex, setCex] = useState<ProjectItem | undefined>();
  const [error, setError] = useState<INPUT_ERROR>();
  const scanner = useScanner();
  const [loading, setLoading] = useState(false);
  const navParams = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.SendInput)?.params,
  ) as {
    autoScan?: boolean;
  };
  const nav = useNavigation();
  const { isSingleAddress } = useSendRoutes();

  const { list } = useCexSupportList();

  const { findAccountWithoutBalance } = useWhiteListAddress(true);

  const { t } = useTranslation();
  const [historyVisible, setHistoryVisible] = useState(false);
  const { fetchAccounts } = useAccounts({ disableAutoFetch: true });

  const [, setWL] = useAtom(whitelistAtom);

  const getWhitelist = React.useCallback(async () => {
    const data = await whitelistService.getWhitelist();
    setWL(data);
  }, [setWL]);
  const { inputCallbackRef } = useAutoFocusInput(false);

  const closeHistory = useCallback(() => {
    setHistoryVisible(false);
  }, []);

  const confrimModalIRef = useRef<any>(null);

  const handleDone = useMemoizedFn(async () => {
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

      const { inWhitelist, account, isImported } =
        await findAccountWithoutBalance(address, undefined);
      if (inWhitelist) {
        toast.show(t('page.whitelist.alreadyAdded'));
      } else {
        if (confrimModalIRef.current) {
          // clear last modal
          removeGlobalBottomSheetModal2024(confrimModalIRef.current);
        }
        confrimModalIRef.current = createGlobalBottomSheetModal2024({
          name: MODAL_NAMES.CONFIRM_ADDRESS,
          account: {
            ...account,
            aliasName: aliasName || account.aliasName,
          },
          title: t('page.confirmAddress.addToWhitelist'),
          cex: isCex ? cex : undefined,
          disbaleWhiteSwitch: true,
          bottomSheetModalProps: {
            enableDynamicSizing: true,
          },
          onCancel: () => {
            confrimModalIRef.current &&
              removeGlobalBottomSheetModal2024(confrimModalIRef.current);
            confrimModalIRef.current = null;
          },
          async onConfirm() {
            confrimModalIRef.current &&
              removeGlobalBottomSheetModal2024(confrimModalIRef.current);
            confrimModalIRef.current = null;
            matomoRequestEvent({
              category: 'Send Usage',
              action: isImported
                ? 'Send_AddWhitelist_imported'
                : 'Send_AddWhitelist_notImported',
            });
            if (isCex && cex?.id) {
              setCexId(address, cex.id);
            }
            contactService.updateAlias({
              address,
              name: aliasName || ellipsisAddress(address),
            });
            fetchAccounts();
            setInput('');
            await whitelistService.addWhitelist(address);
            await getWhitelist();
            toast.success(t('page.whitelist.addSuccessful'));
            nav.canGoBack() && nav.goBack();
          },
        });
      }
    } catch (err: any) {
    } finally {
      setLoading(false);
    }
  });

  const handleSubmit = useCallback((text: string) => {
    setError(undefined);
    setInput(text);
  }, []);
  const openSendHistory = useCallback(() => {
    setHistoryVisible(true);
    Keyboard.dismiss();
  }, [setHistoryVisible]);

  const onSelectCex = useCallback(() => {
    let tmpCex = cex;
    globalBottomSheetModalAddListener2024(
      EVENT_NAMES.DISMISS,
      () => {
        if (!tmpCex) {
          setIsCex(false);
          return;
        }
      },
      true,
    );
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.SELECT_CEX,
      bottomSheetModalProps: {
        // enableContentPanningGesture: true,
        enablePanDownToClose: true,
        handleStyle: {
          backgroundColor: colors2024['neutral-bg-2'],
        },
      },
      onSelect: item => {
        tmpCex = item;
        setCex(item);
        removeGlobalBottomSheetModal2024(id);
      },
      onCancel: () => {
        removeGlobalBottomSheetModal2024(id);
      },
    });
  }, [cex, colors2024]);

  const onSwitch = useCallback(
    (bool: boolean) => {
      if (isValidHexAddress(input as Hex)) {
        setIsCex(!!bool);
        if (bool && !cex) {
          onSelectCex();
        }
      }
    },
    [cex, input, onSelectCex],
  );

  const editAliasName = useAliasNameEditModal();

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
  useEffect(() => {
    setIsCex(false);
    setCex(undefined);
    setAliasName('');
    if (isValidHexAddress(input as Hex)) {
      setAliasName(contactService.getAliasByAddress(input)?.alias || '');
      getAddrDescWithCexLocalCacheSync(input).then(res => {
        if (res?.cex?.id && res?.cex?.is_deposit) {
          setIsCex(true);
          setCex(list.find(item => item.id === res?.cex?.id));
        }
      });
    }
  }, [input, list]);
  const onReaptAdd = useCallback(() => {
    setError(undefined);
    setInput('');
    setIsCex(false);
    setLoading(false);
    setAliasName('');
    setCex(undefined);
  }, []);
  useAlert(input, onReaptAdd);

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
                <Text style={styles.headerText}>
                  {t('page.whitelist.header.address')}
                </Text>
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
                  ref={inputCallbackRef}
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
                        <ScannerCC
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
                <Text style={styles.headerText}>
                  {t('page.whitelist.header.name')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  if (!isValidHexAddress(input as Hex)) {
                    return;
                  }
                  const targetAccount =
                    findAccountWithoutBalance(input).account;
                  editAliasName.show(
                    {
                      ...targetAccount,
                      aliasName: aliasName || targetAccount.aliasName,
                    },
                    undefined,
                    editAlias => setAliasName(editAlias),
                  );
                }}
                style={styles.editContainer}>
                {aliasName ? (
                  <Text style={styles.aliasName}>{aliasName}</Text>
                ) : (
                  <Text style={styles.aliasNamePlaceholder}>
                    {t('page.whitelist.placeholder.name')}
                  </Text>
                )}
                <View style={styles.button}>
                  <EditSVG
                    color={colors2024['neutral-body']}
                    width={20}
                    height={20}
                  />
                </View>
              </TouchableOpacity>
            </View>
            <View style={styles.exChangeContent}>
              <View style={styles.header}>
                <Text style={styles.headerText}>
                  {t('page.whitelist.header.exchange')}
                </Text>
                <AppSwitch2024 onValueChange={onSwitch} value={isCex} />
              </View>
              {isCex && (
                <TouchableView style={styles.selectCex} onPress={onSelectCex}>
                  <View style={styles.addressRow}>
                    {cex ? (
                      <View style={styles.cexContainer}>
                        <View>
                          <Image
                            source={{
                              uri: cex.logo_url,
                            }}
                            style={styles.logo}
                          />
                        </View>
                        <Text style={styles.name}>{cex.name}</Text>
                      </View>
                    ) : (
                      <Text style={styles.toSelect}>
                        {t('page.whitelist.placeholder.exchange')}
                      </Text>
                    )}
                    <CaretDownIconCC
                      style={[styles.caretIcon]}
                      width={26}
                      height={26}
                      bgColor={colors2024['neutral-line']}
                      lineColor={colors2024['neutral-title-1']}
                    />
                  </View>
                </TouchableView>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </FooterButtonScreenContainer>
      <SendHistory
        visible={historyVisible}
        onClose={closeHistory}
        isForMultipleAddress={!isSingleAddress}
        title={t('page.sendPoly.SelectFromHistory')}
        onPressBottomBtn={data => {
          if (data?.to && isValidHexAddress(data?.to as Hex)) {
            if (nav.canGoBack()) {
              nav.goBack();
            }
            setInput(data.to);
          }
        }}
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
    fontWeight: '700',
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  icon: {
    width: 20,
    height: 20,
  },
  aliasNamePlaceholder: {
    fontSize: 17,
    lineHeight: 22,
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
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
  cexContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: { borderRadius: 6, width: 24, height: 24 },
  name: {
    fontSize: 16,
    lineHeight: 20,
    color: ctx.colors2024['neutral-title-1'],
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
}));
