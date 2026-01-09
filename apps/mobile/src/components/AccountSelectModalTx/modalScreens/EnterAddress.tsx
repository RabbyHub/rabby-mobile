import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text } from '@/components';
import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { navigateDeprecated } from '@/utils/navigation';
import { isValidAddress } from '@ethereumjs/util';
import {
  Keyboard,
  TouchableOpacity,
  View,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';
import {
  createGetStyles2024,
  makeDebugBorder,
  makeDevOnlyStyle,
} from '@/utils/styles';
import { NextInput } from '@/components2024/Form/Input';
import PasteButton from '@/components2024/PasteButton';
import { useTranslation } from 'react-i18next';
import { openapi } from '@/core/request';
import { debounce, throttle } from 'lodash';
import { useFindAddressByWhitelist } from '@/screens/Send/hooks/useWhiteListAddress';
import { useAccountSelectModalCtx } from '../hooks';
import { SelectAccountSheetModalSizes } from '../layout';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { RcIconScannerCC } from '@/assets/icons/address';
import { Button } from '@/components2024/Button';
import { AddressEditorBadge } from '../AddressEditorBadge';
import { touchedFeedback } from '@/utils/touch';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import { useSortedAccounts } from '@/screens/Address/useSortAddressList';
import { SearchedAddressItemInSheetModal } from '../AddressItem/SearchedItem';
import { Account } from '@/core/services/preference';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

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

const debouncedGetEnsAddress = debounce(
  (
    input: string,
    callback: (result: any) => void,
    errorCallback: (e: any) => void,
  ) => {
    openapi.getEnsAddressByName(input).then(callback).catch(errorCallback);
  },
  500,
  { leading: false, trailing: true },
);

const ScreenPanelEnterAddress = ({
  onCleanupInput,
  newValue,
}: {
  onCleanupInput?: () => void;
  newValue?: string;
}) => {
  const { fnNavTo, cbOnSelectedAccount } = useAccountSelectModalCtx();
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const [input, _setInput] = React.useState('');
  const setInput = useCallback((text: string) => {
    _setInput(text);
    setEnsResult(null);
  }, []);
  const [error, setError] = React.useState<INPUT_ERROR>();
  const [loading, setLoading] = useState(false);
  const [ensResult, setEnsResult] = React.useState<null | {
    addr: string;
    name: string;
  }>(null);

  const isValidAddr = useMemo(
    () => isValidAddress(input as `0x${string}`),
    [input],
  );
  const hasError = !!input && !isValidAddr && !ensResult?.addr;
  const disableConfirm = !input || hasError;

  const { sortedAccounts, fetchSortedAccounts } = useSortedAccounts();
  const { isAddrOnWhitelist, findAccountWithoutBalance } =
    useFindAddressByWhitelist();

  const { t } = useTranslation();

  const { foundAccountInfo } = useMemo(() => {
    let info: null | ReturnType<typeof findAccountWithoutBalance> = null;
    if (isValidAddress(input as `0x${string}`)) {
      info = findAccountWithoutBalance(input, { useEllipsisAsFallback: false }); // clear input when enter screen
    }
    return {
      foundAccountInfo: info,
    };
  }, [findAccountWithoutBalance, input]);

  const { hasAccount, searchedAccountCount, mainAccounts, watchAccounts } =
    useMemo(() => {
      const ret = {
        hasAccount: false,
        searchedAccountCount: 0,
        mainAccounts: [] as typeof sortedAccounts,
        watchAccounts: [] as typeof sortedAccounts,
      };
      const lowerFilterText = input?.toLowerCase() || '';

      const filterAccount = (account: Account) => {
        if (!lowerFilterText) return true;

        const address = account.address.toLowerCase();
        const brandName = account.brandName?.toLowerCase() || '';
        const aliasName = account.aliasName?.toLowerCase() || '';

        return (
          address.includes(lowerFilterText) ||
          brandName.includes(lowerFilterText) ||
          aliasName.includes(lowerFilterText)
        );
      };

      sortedAccounts.forEach(account => {
        if (!filterAccount(account)) return;

        if (account.type === KEYRING_TYPE.WatchAddressKeyring) {
          ret.watchAccounts.push(account);
        } else {
          ret.mainAccounts.push(account);
        }
      });

      ret.hasAccount = ret.mainAccounts.length + ret.watchAccounts.length > 0;
      ret.searchedAccountCount =
        ret.mainAccounts.length + ret.watchAccounts.length;

      return ret;
    }, [sortedAccounts, input]);

  const showSearchError = hasError && !hasAccount;

  const handleConfirmAddress = useCallback(
    async (address: string) => {
      if (!isValidAddress(address as any)) {
        setError(INPUT_ERROR.INVALID_ADDRESS);
        return;
      }
      try {
        setLoading(true);
        Keyboard.dismiss();

        const { inWhitelist, account, isMyImported } =
          findAccountWithoutBalance(address, undefined);

        cbOnSelectedAccount?.(account);
      } catch (err: any) {
        console.error('[EnterAddress] err', err);
      } finally {
        setLoading(false);
      }
    },
    [findAccountWithoutBalance, cbOnSelectedAccount],
  );

  const handleDone = useCallback(async () => {
    if (!input) {
      setError(INPUT_ERROR.REQUIRED);
      return;
    }

    let address = input;
    if (ensResult && input !== ensResult.addr) {
      address = ensResult.addr;
    }

    await handleConfirmAddress(address);
  }, [ensResult, input, handleConfirmAddress]);

  const handleInputChange = React.useCallback(
    (text: string) => {
      setError(undefined);
      setInput(text);
    },
    [setInput],
  );

  const { safeSizes } = useSafeAndroidBottomSizes({
    containerPb:
      SIZES.bottomContentH + SIZES.bottomContentBottom + SIZES.containerPb,
    bottomContentBottom: SIZES.bottomContentBottom,
  });

  const onSubmitEditing = React.useCallback(() => {
    if (!error && ensResult && input !== ensResult.addr) {
      setInput(ensResult.addr);
    }
  }, [error, ensResult, input, setInput]);

  useEffect(() => {
    if (!input) {
      setError(undefined);
      return;
    }
    if (isValidAddress(input as `0x${string}`)) {
      setError(undefined);
      return;
    }

    debouncedGetEnsAddress(
      input,
      result => {
        if (result && result.addr) {
          setEnsResult(result);
          setError(undefined);
        } else {
          setEnsResult(null);
          setError(INPUT_ERROR.INVALID_ADDRESS);
        }
      },
      () => {
        setEnsResult(null);
        setError(INPUT_ERROR.INVALID_ADDRESS);
      },
    );
  }, [input]);

  useEffect(() => {
    if (newValue) {
      setInput(newValue);
    }
  }, [newValue, setInput]);

  const showAccountList = !!input;
  const showConfirmButton =
    searchedAccountCount === 1 || !!foundAccountInfo?.account || isValidAddr;
  const displayWatchOnlyDivider =
    !!mainAccounts.length && !!watchAccounts.length;

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        Keyboard.dismiss();
        if (!input && !ensResult) {
          onCleanupInput?.();
        }
      }}>
      <View
        style={[styles.container, { paddingBottom: safeSizes.containerPb }]}>
        <BottomSheetScrollView
          contentContainerStyle={styles.topContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.inputAreaContainer}>
            <NextInput.TextArea
              as="TextInput"
              style={styles.textContainer}
              inputStyle={styles.textArea}
              tipText={''}
              hasError={showSearchError}
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
                placeholder: t('page.sendPoly.enterOrSearchAddress'),
                placeholderTextColor: colors2024['neutral-secondary'],
                value: input,
                blurOnSubmit: true,
                autoFocus: true,
                returnKeyType: 'done',
                onChangeText: handleInputChange,
                onSubmitEditing: onSubmitEditing,
              }}
              customIcon={ctx => (
                <View style={[ctx.wrapperStyle, styles.customIconContainer]}>
                  <PasteButton
                    style={styles.pasteButton}
                    cleanClipboardAfterPaste={false}
                    onPaste={text => {
                      handleInputChange(text);
                      Keyboard.dismiss();
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      touchedFeedback();
                      fnNavTo('scan-qr-code', { nextScanFor: 'enter-addr' });
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
            {!!foundAccountInfo?.account && (
              <View style={styles.addressEditorPos}>
                <AddressEditorBadge
                  style={styles.addressEditor}
                  account={foundAccountInfo?.account}
                  onUpdatedAlias={() => {
                    fetchSortedAccounts();
                  }}
                />
              </View>
            )}
          </View>
          <View style={styles.afterInput}>
            {!showSearchError && ensResult && input === ensResult.addr && (
              <Text style={styles.ensText}>ENS: {ensResult.name}</Text>
            )}

            {!showSearchError && ensResult && input !== ensResult.addr && (
              <TouchableOpacity
                style={styles.ensResultBox}
                onPress={() => {
                  touchedFeedback();
                  Keyboard.dismiss();
                  setInput(ensResult.addr);
                }}>
                <Text style={styles.ensResult}>{ensResult.addr}</Text>
              </TouchableOpacity>
            )}
            {showSearchError && error && (
              <Text style={styles.errorMessage}>{ERROR_MESSAGE[error]}</Text>
            )}
            {!showSearchError && hasAccount && showAccountList && (
              <View style={styles.accountsList}>
                {mainAccounts.map(account => {
                  const key = `acc-${account.address}-${account.brandName}`;
                  return (
                    <SearchedAddressItemInSheetModal
                      key={key}
                      account={account}
                      inWhiteList={isAddrOnWhitelist(account.address)}
                      onPress={() => {
                        handleConfirmAddress(account.address);
                      }}
                    />
                  );
                })}

                {displayWatchOnlyDivider && (
                  <View style={[styles.accountsDividerWrapper]}>
                    {/* <View style={styles.accountsDivider} /> */}
                    <View style={styles.accountsDividerPart} />
                    <Text style={styles.accountsDividerText}>
                      {t('page.sendPoly.dividerWatchOnlyWallets')}
                    </Text>
                    <View style={styles.accountsDividerPart} />
                  </View>
                )}
                {watchAccounts.map(account => {
                  const key = `acc-${account.address}-${account.brandName}`;
                  return (
                    <SearchedAddressItemInSheetModal
                      key={key}
                      account={account}
                      inWhiteList={isAddrOnWhitelist(account.address)}
                      onPress={() => {
                        handleConfirmAddress(account.address);
                      }}
                    />
                  );
                })}
              </View>
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
          {showConfirmButton && (
            <Button
              type={'primary'}
              {...{
                title: t('global.Confirm'),
                onPress: handleDone,
                loading: loading,
                disabled: disableConfirm,
              }}
            />
          )}
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
};

export default ScreenPanelEnterAddress;

const SIZES = {
  bottomContentH: 56,
  bottomContentBottom: IS_IOS ? 48 : 0,
  containerPb: 20,
  itemH: 78,
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
    paddingTop: 16,
    paddingBottom:
      SIZES.bottomContentH + SIZES.bottomContentBottom + SIZES.containerPb,
    // ...makeDebugBorder('red'),
  },
  topContent: {
    paddingHorizontal: SelectAccountSheetModalSizes.sectionPx,
  },
  inputAreaContainer: {
    position: 'relative',
  },
  errorMessage: {
    color: ctx.colors2024['red-default'],
    fontSize: 13,
    marginBottom: 16,
  },

  textContainer: {
    backgroundColor: ctx.colors2024['neutral-bg-2'],
    paddingTop: 8,
    position: 'relative',
    height: 140,
  },
  textArea: {
    marginTop: 10,
    paddingHorizontal: 20,
    backgroundColor: ctx.colors['neutral-card-1'],
    fontSize: 17,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
  },
  customIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,

    right: 0,
    paddingRight: 0,
    bottom: 8,
  },
  pasteButton: {
    borderWidth: 0,
    width: 'auto',
    // ...makeDebugBorder(),
  },
  error: {
    textAlign: 'left',
  },
  ensResultBox: {
    paddingHorizontal: 12,
    width: '100%',
    borderRadius: 16,
    display: 'flex',
    backgroundColor: ctx.colors2024['brand-light-1'],
  },

  afterInput: {
    marginTop: 16,
    flexDirection: 'row',
  },

  ensResult: {
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 14,
    borderRadius: 16,
    // overflow: 'hidden',
    color: ctx.colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
  },
  addressEditorPos: {
    zIndex: 10,
    position: 'absolute',
    bottom: 16,
    left: 20,
    // ...makeDebugBorder(),
    ...makeDevOnlyStyle({}),
  },
  addressEditor: {
    alignSelf: 'flex-start',
  },
  ensText: {
    fontSize: 13,
    color: ctx.colors2024['neutral-body'],
  },

  bottomContent: {
    paddingHorizontal: SelectAccountSheetModalSizes.sectionPx,
    width: '100%',
    position: 'absolute',
    bottom: SIZES.bottomContentBottom,
    // ...makeDebugBorder(),
    height: SIZES.bottomContentH,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    flex: 1,
  },

  /* address :start */
  accountsList: {
    width: '100%',
    flexDirection: 'column',
    gap: 12,
  },

  accountsDividerWrapper: {
    position: 'relative',
    width: '100%',
    height: 32,
    marginTop: 0,
    marginBottom: 0,

    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  accountsDividerPart: {
    height: 1,
    backgroundColor: ctx.colors2024['neutral-line'],
    // ...makeDebugBorder(),
    width: '100%',
    flexShrink: 1,
  },
  // accountsDivider: {
  //   position: 'absolute',
  //   top: '50%',
  //   left: 0,
  //   right: 0,
  //   height: 1,
  //   backgroundColor: ctx.colors2024['neutral-line'],
  // },
  accountsDividerText: {
    color: ctx.colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: 500,
    lineHeight: 18,

    flexShrink: 0,
  },
  /* address item: end */
}));
