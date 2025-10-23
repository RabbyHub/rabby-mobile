import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Text } from '@/components';
import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { navigateDeprecated } from '@/utils/navigation';
import { isValidHexAddress, Hex } from '@metamask/utils';
import {
  Keyboard,
  TouchableOpacity,
  View,
  TouchableWithoutFeedback,
  Image,
} from 'react-native';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { NextInput } from '@/components2024/Form/Input';
import PasteButton from '@/components2024/PasteButton';
import { useTranslation } from 'react-i18next';
import { useScanner } from '@/screens/Scanner/ScannerScreen';
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
import { AppSwitch2024 } from '@/components/customized/Switch2024';
import TouchableView from '@/components/Touchable/TouchableView';
import { CaretArrowIconCC } from '@/components/Icons/CaretArrowIconCC';
import { whitelistAtom } from '@/hooks/whitelist';
import { contactService, whitelistService } from '@/core/services';
import { ProjectItem } from '@rabby-wallet/rabby-api/dist/types';
import { useCexSupportList } from '@/hooks/useCexSupportList';
import { getAddrDescWithCexLocalCacheSync } from '@/databases/hooks/cex';
import { setCexId } from '@/utils/addressCexId';
import { useAtom } from 'jotai';
import { toast } from '@/components2024/Toast';
import { useSendRoutes } from '@/hooks/useSendRoutes';
import { matomoRequestEvent } from '@/utils/analytics';
import useAutoFocusInput from '@/hooks/useAutoFocusInput';
import { ellipsisAddress } from '@/utils/address';
import { useAccounts } from '@/hooks/account';
import { useMemoizedFn } from 'ahooks';
import { debounce } from 'lodash';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import {
  useAccountSelectModalCtx,
  useAlertAddress,
  useRestoreModalOnBackFromScanner,
} from '../hooks';
import { Button } from '@/components2024/Button';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { SelectAccountSheetModalSizes } from '../layout';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { RcIconScannerCC } from '@/assets/icons/address';
import { touchedFeedback } from '@/utils/touch';

enum INPUT_ERROR {
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  ADDRESS_EXIST = 'ADDRESS_EXIST',
  REQUIRED = 'REQUIRED',
}

const ERROR_MESSAGE = {
  [INPUT_ERROR.INVALID_ADDRESS]:
    "The address you're trying to import is invalid",
  [INPUT_ERROR.ADDRESS_EXIST]:
    "The address you're trying to import is duplicated",
  [INPUT_ERROR.REQUIRED]: 'Please input address',
};

export const ScreenAddNewWhitelistAddress = ({
  nextInitAddressValue = '',
}: {
  nextInitAddressValue?: string;
}) => {
  const { fnNavTo, cbOnScanStageChanged } = useAccountSelectModalCtx();
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const [input, setInput] = useState(nextInitAddressValue);
  const [isCex, setIsCex] = useState(false);
  const [aliasName, setAliasName] = useState('');
  const [cex, setCex] = useState<ProjectItem | undefined>();
  const [error, setError] = useState<INPUT_ERROR>();
  const scanner = useScanner();
  const [loading, setLoading] = useState(false);

  const { list } = useCexSupportList();

  const { findAccountWithoutBalance } = useWhiteListAddress();

  const { t } = useTranslation();
  const { fetchAccounts } = useAccounts({ disableAutoFetch: true });

  const [, setWL] = useAtom(whitelistAtom);

  const getWhitelist = React.useCallback(async () => {
    const data = await whitelistService.getWhitelist();
    setWL(data);
  }, [setWL]);
  // TODO: make auto focus
  // const { inputCallbackRef } = useAutoFocusInput(false);

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

      const { inWhitelist, isImported } = await findAccountWithoutBalance(
        address,
      );
      if (inWhitelist) {
        toast.show(t('page.whitelist.alreadyAdded'));
      } else {
        Keyboard.dismiss();
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
        fnNavTo('default');
      }
    } catch (err: any) {
    } finally {
      setLoading(false);
    }
  });

  const { safeSizes } = useSafeAndroidBottomSizes({
    containerPb: 20,
  });

  const debouncedHandleDone = useMemo(
    () => debounce(handleDone, 300),
    [handleDone],
  );

  const handleInputChange = useCallback((text: string) => {
    setError(undefined);
    setInput(text);
  }, []);
  const openSendHistory = useCallback(() => {
    touchedFeedback();
    fnNavTo('select-from-history');
    Keyboard.dismiss();
  }, [fnNavTo]);

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

  useEffect(() => {
    if (scanner.text) {
      setInput(scanner.text);
      scanner.clear();
    }
  }, [scanner]);

  useEffect(() => {
    setIsCex(false);
    setCex(undefined);
    setAliasName('');
    if (isValidHexAddress(input as Hex)) {
      const aliasInfo = contactService.getAliasByAddress(input);
      setAliasName(aliasInfo?.isDefaultAlias ? '' : aliasInfo?.alias || '');
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
  useAlertAddress(input, onReaptAdd);

  useRestoreModalOnBackFromScanner(cbOnScanStageChanged);

  return (
    <BottomSheetScrollView
      contentContainerStyle={[
        styles.container,
        { paddingBlock: safeSizes.containerPb },
      ]}>
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
            // as="BottomSheetTextInput"
            style={styles.textContainer}
            inputStyle={styles.textArea}
            tipText={''}
            hasError={!!error}
            fieldErrorTextStyle={styles.error}
            // ref={inputCallbackRef}
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
              autoFocus: true,
              placeholder: t('page.sendPoly.enterAddress'),
              placeholderTextColor: colors2024['neutral-secondary'],
              value: input,
              blurOnSubmit: true,
              returnKeyType: 'done',
              onChangeText: handleInputChange,
            }}
            customIcon={ctx => (
              <View style={[ctx.wrapperStyle, styles.customContainer]}>
                <PasteButton
                  style={styles.pasteButton}
                  cleanClipboardAfterPaste={!__DEV__}
                  onPaste={text => {
                    handleInputChange(text);
                    Keyboard.dismiss();
                  }}
                />
                <TouchableOpacity
                  onPress={() => {
                    cbOnScanStageChanged('start');
                    setTimeout(() => {
                      navigateDeprecated(RootNames.Scanner);
                    }, 200);
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
            <Text style={styles.errorMessage}>{ERROR_MESSAGE[error]}</Text>
          )}
        </View>

        <View style={styles.nameContent}>
          <View style={styles.header}>
            <Text style={styles.headerText}>
              {t('page.whitelist.header.name')}
            </Text>
          </View>
          <NextInput
            as="BottomSheetTextInput"
            style={styles.editContainer}
            inputStyle={styles.aliasName}
            tipText={''}
            hasError={!!error}
            inputProps={{
              placeholder: t('page.whitelist.placeholder.name'),
              placeholderTextColor: colors2024['neutral-secondary'],
              value: aliasName,
              onChangeText: setAliasName,
            }}
            containerStyle={styles.nameInput}
            fieldErrorTextStyle={styles.error}
          />
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
                <CaretArrowIconCC
                  dir="down"
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

      <View style={styles.bottomContent}>
        <Button
          type={'primary'}
          {...{
            title: t('global.Confirm'),
            onPress: debouncedHandleDone,
            loading: loading,
            disabled: !input || !!error || !aliasName,
          }}
        />
      </View>
    </BottomSheetScrollView>
  );
};

export default ScreenAddNewWhitelistAddress;

const getStyles = createGetStyles2024(ctx => ({
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 500,
    width: '100%',
    paddingHorizontal: SelectAccountSheetModalSizes.sectionPx,
    paddingTop: 24,
    // ...makeDebugBorder(),
  },
  topContent: {},
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
    fontSize: 17,
    fontWeight: '400',
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
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '400',
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
    height: 58,
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
  nameInput: {
    borderRadius: 16,
    borderColor: 'transparent',
  },

  bottomContent: {
    width: '100%',
  },
}));
