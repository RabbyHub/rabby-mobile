import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { RcIconAddCircle } from '@/assets/icons/address';
import { RcIconCheckedCC } from '@/assets/icons/common';
import {
  AppBottomSheetModal,
  AppBottomSheetModalTitle,
  AssetAvatar,
  Button,
} from '@/components';
import { FooterButton } from '@/components/FooterButton/FooterButton';
import { useInputBlurOnTouchaway } from '@/components/Form/hooks';
import { FormInput } from '@/components/Form/Input';
import { toast } from '@/components/Toast';
import { Chain } from '@/constant/chains';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { useChainList } from '@/hooks/useChainList';
import { useSheetModals } from '@/hooks/useSheetModal';
import { ChainInfo } from '@/screens/Send/components/ChainInfo';
import { findChain } from '@/utils/chain';
import { formatTokenAmount } from '@/utils/number';
import { getTokenSymbol } from '@/utils/token';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRequest } from 'ahooks';
import {
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native-gesture-handler';
import { AbstractPortfolioToken } from '../types';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { ModalLayouts } from '@/constant/layout';
import { isAddress } from 'viem';
import AutoLockView from '@/components/AutoLockView';

export type AddCustomTokenPopupProps = {
  visible?: boolean;
  onClose?: () => void;
  isTestnet?: boolean;
  onSearchToken?: (args: {
    chainId: number;
    address: string;
    chainServerId: string;
  }) => Promise<AbstractPortfolioToken[]>;
  onAddToken?: (token: AbstractPortfolioToken) => Promise<void>;
};
export const AddCustomTokenPopup = ({
  visible,
  onClose,
  isTestnet,
  onSearchToken,
  onAddToken,
}: AddCustomTokenPopupProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyle(colors), [colors]);
  const { t } = useTranslation();

  const { mainnetList, testnetList } = useChainList();

  const defaultChain = useMemo(() => {
    if (isTestnet) {
      return testnetList[0];
    } else {
      return mainnetList[0];
    }
  }, [isTestnet, mainnetList, testnetList]);

  const [chain, setChain] = useState<Chain | undefined | null>(defaultChain);
  const [tokenId, setTokenId] = useState('');
  const [checked, setChecked] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { data: token, loading } = useRequest(
    async () => {
      if (!chain?.id || !tokenId || !isAddress(tokenId)) {
        return null;
      }
      setErrorMessage('');
      setChecked(false);
      const res = await onSearchToken?.({
        chainId: chain.id,
        address: tokenId,
        chainServerId: chain.serverId,
      });
      const token = res?.[0] || null;
      if (!token) {
        setErrorMessage('Token not found');
      }
      return token;
    },
    {
      refreshDeps: [chain?.id, tokenId],
      debounceWait: 500,
      onError: e => {
        setErrorMessage('Token not found');
      },
    },
  );

  const { runAsync: runAddToken, loading: isSubmitting } = useRequest(
    async () => {
      if (!token || !chain?.id || !tokenId) {
        return null;
      }

      if (token.is_core) {
        // message.error();
        throw new Error(
          t('page.dashboard.assets.AddMainnetToken.isBuiltInToken'),
        );
      }
      await onAddToken?.(token);
    },
    {
      manual: true,
      onError(e) {
        toast.info(e.message);
      },
    },
  );

  const {
    sheetModalRefs: { modalRef },
    toggleShowSheetModal,
  } = useSheetModals({
    modalRef: useRef<BottomSheetModal>(null),
  });

  useEffect(() => {
    toggleShowSheetModal('modalRef', !!visible);
  }, [toggleShowSheetModal, visible]);

  useEffect(() => {
    if (!visible) {
      setChain(defaultChain);
      setTokenId('');
      setChecked(false);
      setErrorMessage('');
    }
  }, [visible, defaultChain]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      snapPoints={['80%']}
      onDismiss={onClose}>
      <AutoLockView style={{ height: '100%' }}>
        <TouchableWithoutFeedback
          style={{ height: '100%' }}
          onPress={() => {
            Keyboard.dismiss();
          }}>
          <AppBottomSheetModalTitle
            title="Add Custom Token"
            style={{ paddingTop: ModalLayouts.titleTopOffset }}
          />
          <KeyboardAwareScrollView
            // style={styles.keyboardView}
            enableOnAndroid
            scrollEnabled={false}
            keyboardOpeningTime={0}
            keyboardShouldPersistTaps="handled">
            <View style={styles.main}>
              <View style={styles.formItem}>
                <View style={styles.formLabel}>
                  <Text style={styles.formLabelText}>Chain:</Text>
                </View>
                <View style={styles.formControl}>
                  <ChainInfo
                    chainEnum={chain?.enum}
                    onChange={e => {
                      setChain(findChain({ enum: e }));
                    }}
                    hideMainnetTab={isTestnet}
                    hideTestnetTab={!isTestnet}
                  />
                </View>
              </View>
              <View style={styles.formItem}>
                <View style={styles.formLabel}>
                  <Text style={styles.formLabelText}>Token Address:</Text>
                </View>
                <View style={styles.formControl}>
                  <FormInput
                    // as="BottomSheetTextInput"
                    as="TextInput"
                    style={styles.formInput}
                    inputStyle={styles.input}
                    disableFocusingStyle
                    fieldErrorTextStyle={styles.formInputError}
                    inputProps={{
                      numberOfLines: 2,
                      multiline: true,
                      // react native bug, must use defaultValue
                      defaultValue: tokenId,
                      onChangeText: setTokenId,
                    }}
                    errorText={errorMessage}
                  />
                  {loading && tokenId && !errorMessage ? (
                    <ActivityIndicator style={{ marginTop: 16 }} />
                  ) : null}
                </View>
              </View>
              {token ? (
                <View style={styles.formItem}>
                  <View style={styles.formLabel}>
                    <Text style={styles.formLabelText}>Found Token:</Text>
                  </View>
                  <View>
                    <TouchableOpacity
                      onPress={() => {
                        setChecked(v => !v);
                      }}>
                      <View
                        style={[styles.token, checked && styles.tokenSelected]}>
                        <View>
                          <AssetAvatar
                            logo={token.logo_url}
                            chain={chain?.serverId}
                            size={28}
                            chainSize={16}
                          />
                        </View>
                        <View style={styles.tokenContent}>
                          <Text style={styles.tokenText}>
                            {formatTokenAmount(token.amount)}{' '}
                            {getTokenSymbol(token)}
                          </Text>
                        </View>
                        <View style={styles.checkbox}>
                          <RcIconCheckedCC
                            width={20}
                            height={20}
                            color={
                              checked
                                ? colors['blue-default']
                                : colors['neutral-line']
                            }
                          />
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
          </KeyboardAwareScrollView>
          <View style={styles.footer}>
            <Button
              TouchableComponent={TouchableOpacity}
              onPress={onClose}
              title={'Cancel'}
              buttonStyle={[styles.buttonStyle]}
              titleStyle={styles.btnCancelTitle}
              type="white"
              containerStyle={[styles.btnContainer, styles.btnCancelContainer]}
            />
            <Button
              TouchableComponent={TouchableOpacity}
              title={'Confirm'}
              buttonStyle={[
                styles.buttonStyle,
                { backgroundColor: colors['blue-default'] },
              ]}
              style={{
                width: '100%',
              }}
              titleStyle={styles.btnConfirmTitle}
              disabled={!token || !checked || !chain}
              onPress={runAddToken}
              loading={isSubmitting}
              containerStyle={[styles.btnContainer, styles.btnConfirmContainer]}
            />
          </View>
        </TouchableWithoutFeedback>
      </AutoLockView>
    </AppBottomSheetModal>
  );
};

const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    main: {
      flex: 1,
      paddingHorizontal: 20,
    },
    formItem: {
      marginBottom: 20,
    },
    formLabel: {
      marginBottom: 8,
    },
    formLabelText: {
      fontSize: 14,
      lineHeight: 17,
      color: colors['neutral-body'],
    },
    formControl: {},
    input: {
      height: 64,
      paddingHorizontal: 15,
      paddingTop: 12,
      paddingBottom: 12,
    },
    formInput: {
      borderRadius: 8,
    },
    formInputError: {
      textAlign: 'left',
    },
    token: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      paddingHorizontal: 15,
      paddingVertical: 11,
      backgroundColor: colors['neutral-card-2'],
      borderRadius: 8,
      borderWidth: 1,
      minHeight: 52,
      borderColor: 'transparent',
    },
    tokenSelected: {
      borderColor: colors['blue-default'],
    },
    tokenContent: {
      flex: 1,
    },
    tokenText: {
      fontSize: 16,
      lineHeight: 19,
      fontWeight: '500',
      color: colors['neutral-title-1'],
    },
    checkbox: {
      flexShrink: 0,
    },
    footer: {
      width: '100%',
      maxWidth: Dimensions.get('window').width,
      display: 'flex',
      flexDirection: 'row',
      gap: 16,
      justifyContent: 'space-between',
      borderTopColor: colors['neutral-line'],
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: 20,
      paddingHorizontal: 20,
      paddingBottom: 35,
    },
    btnContainer: {
      flexShrink: 1,
      display: 'flex',
      height: 52,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 8,
      flex: 1,
      maxWidth: '100%',
      minWidth: 0,
    },

    buttonStyle: {
      width: '100%',
      height: '100%',
    },
    btnCancelContainer: {
      borderColor: colors['blue-default'],
      borderWidth: StyleSheet.hairlineWidth,
    },
    btnCancelTitle: {
      color: colors['blue-default'],
      flex: 1,
    },
    btnConfirmContainer: {},
    btnConfirmTitle: {
      color: colors['neutral-title-2'],
      flex: 1,
    },
  });
