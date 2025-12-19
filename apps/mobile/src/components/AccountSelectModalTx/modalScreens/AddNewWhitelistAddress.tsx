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
import { useFindAddressByWhitelist } from '@/screens/Send/hooks/useWhiteListAddress';
import RcIconSwapHistory from '@/assets2024/icons/common/IconHistoryCC.svg';
import { AppSwitch2024 } from '@/components/customized/Switch2024';
import TouchableView from '@/components/Touchable/TouchableView';
import { CaretArrowIconCC } from '@/components/Icons/CaretArrowIconCC';
import { setWhitelist } from '@/hooks/whitelist';
import { contactService, whitelistService } from '@/core/services';
import { ProjectItem } from '@rabby-wallet/rabby-api/dist/types';
import { useCexSupportList } from '@/hooks/useCexSupportList';
import { getAddrDescWithCexLocalCacheSync } from '@/databases/hooks/cex';
import { setCexId } from '@/utils/addressCexId';
import { useAtom } from 'jotai';
import { toast } from '@/components2024/Toast';
import { matomoRequestEvent } from '@/utils/analytics';
import { ellipsisAddress } from '@/utils/address';
import { useAccounts } from '@/hooks/account';
import { useMemoizedFn } from 'ahooks';
import { debounce } from 'lodash';
import { useAccountSelectModalCtx, useAlertAddress } from '../hooks';
import { Button } from '@/components2024/Button';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { SelectAccountSheetModalSizes } from '../layout';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { RcIconScannerCC } from '@/assets/icons/address';
import { touchedFeedback } from '@/utils/touch';
import { IS_IOS } from '@/core/native/utils';

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
  newValue = '',
}: {
  newValue?: string;
}) => {
  const { fnNavTo } = useAccountSelectModalCtx();
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const [input, setInput] = useState(newValue);
  const [isCex, setIsCex] = useState(false);
  const [aliasName, setAliasName] = useState('');
  const [cex, setCex] = useState<ProjectItem | undefined>();
  const [error, setError] = useState<INPUT_ERROR>();
  const [loading, setLoading] = useState(false);

  const { list } = useCexSupportList();

  const { findAccountWithoutBalance } = useFindAddressByWhitelist();

  const { t } = useTranslation();
  const { fetchAccounts } = useAccounts({ disableAutoFetch: true });

  const getWhitelist = React.useCallback(async () => {
    const data = await whitelistService.getWhitelist();
    setWhitelist(data);
  }, []);
  // TODO: make auto focus
  // const { inputCallbackRef } = useAutoFocusInput(false);

  const confirmModalIRef = useRef<any>(null);
  const handleDone = useMemoizedFn(
    debounce(async () => {
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
          findAccountWithoutBalance(address);
        if (inWhitelist) {
          toast.show(t('page.whitelist.alreadyAdded'));
        } else {
          if (confirmModalIRef.current) {
            // clear last modal
            removeGlobalBottomSheetModal2024(confirmModalIRef.current);
          }
          confirmModalIRef.current = createGlobalBottomSheetModal2024({
            name: MODAL_NAMES.CONFIRM_ADDRESS,
            account: {
              ...account,
              aliasName: aliasName || account.aliasName,
            },
            title: t('page.confirmAddress.addToWhitelist'),
            cex: isCex ? cex : undefined,
            disableWhiteSwitch: true,
            bottomSheetModalProps: {
              enableDynamicSizing: true,
            },
            onCancel: () => {
              confirmModalIRef.current &&
                removeGlobalBottomSheetModal2024(confirmModalIRef.current);
              confirmModalIRef.current = null;
            },
            onConfirm: async () => {
              Keyboard.dismiss();
              confirmModalIRef.current &&
                removeGlobalBottomSheetModal2024(confirmModalIRef.current);
              confirmModalIRef.current = null;

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
            },
          });
        }
      } catch (err: any) {
      } finally {
        setLoading(false);
      }
    }, 300),
  );

  const { safeSizes } = useSafeAndroidBottomSizes({
    containerPb:
      SIZES.bottomContentH + SIZES.bottomContentBottom + SIZES.containerPb,
    bottomContentBottom: SIZES.bottomContentBottom,
  });

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
  const onRepeatAdd = useCallback(() => {
    setError(undefined);
    setInput('');
    setIsCex(false);
    setLoading(false);
    setAliasName('');
    setCex(undefined);
  }, []);
  useAlertAddress(input, onRepeatAdd);

  return (
    <View style={[styles.container, { paddingBottom: safeSizes.containerPb }]}>
      <BottomSheetScrollView contentContainerStyle={styles.topContent}>
        <View style={styles.header}>
          <Text style={styles.headerText}>
            {t('page.whitelist.header.address')}
          </Text>
          <TouchableOpacity onPress={openSendHistory} hitSlop={10}>
            <RcIconSwapHistory
              style={styles.icon}
              color={colors2024['neutral-body']}
            />
          </TouchableOpacity>
        </View>
        <View>
          <NextInput.TextArea
            as="TextInput"
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
              ...(__DEV__ && { autoFocus: false }),
              placeholder: t('page.sendPoly.enterOrSearchAddress'),
              placeholderTextColor: colors2024['neutral-secondary'],
              value: input,
              blurOnSubmit: true,
              returnKeyType: 'done',
              onChangeText: handleInputChange,
            }}
            customIcon={ctx => (
              <View
                style={[
                  ctx.wrapperStyle,
                  styles.customContainer,
                  {
                    right: 0,
                    paddingRight: 0,
                  },
                ]}>
                <PasteButton
                  style={styles.pasteButton}
                  onPaste={text => {
                    handleInputChange(text);
                    Keyboard.dismiss();
                  }}
                />
                <TouchableOpacity
                  onPress={() => {
                    fnNavTo('scan-qr-code', {
                      nextScanFor: 'add-new-whitelist-addr',
                    });
                  }}
                  style={{
                    height: '100%',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    paddingRight: 20,
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
      </BottomSheetScrollView>

      <View
        style={[
          styles.bottomContent,
          {
            bottom: safeSizes.bottomContentBottom,
          },
        ]}>
        <Button
          type={'primary'}
          {...{
            title: t('global.Confirm'),
            onPress: handleDone,
            loading: loading,
            disabled: !input || !!error || !aliasName,
          }}
        />
      </View>
    </View>
  );
};

export default ScreenAddNewWhitelistAddress;

const SIZES = {
  bottomContentH: 56,
  bottomContentBottom: IS_IOS ? 48 : 0,
  containerPb: 20,
};
const getStyles = createGetStyles2024(ctx => ({
  container: {
    // position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
    width: '100%',
    paddingHorizontal: 0,
    paddingTop: 24,
    paddingBottom:
      SIZES.bottomContentH + SIZES.bottomContentBottom + SIZES.containerPb,
    // ...makeDebugBorder('red'),
  },
  topContent: {
    paddingHorizontal: SelectAccountSheetModalSizes.sectionPx,
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
    paddingHorizontal: SelectAccountSheetModalSizes.sectionPx,
    width: '100%',
    position: 'absolute',
    bottom: SIZES.bottomContentBottom,
    // ...makeDebugBorder(),
    height: SIZES.bottomContentH,
    flexDirection: 'column',
    justifyContent: 'flex-end',
    flex: 1,
  },
}));
