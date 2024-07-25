import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { RcIconAddCircle } from '@/assets/icons/address';
import { RcIconEmptyCC } from '@/assets/icons/gnosis';
import {
  AppBottomSheetModal,
  AppBottomSheetModalTitle,
  AssetAvatar,
} from '@/components';
import { FooterButton } from '@/components/FooterButton/FooterButton';
import { AppColorsVariants } from '@/constant/theme';
import { apiCustomTestnet } from '@/core/apis';
import { useCurrentAccount } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import { useSheetModals } from '@/hooks/useSheetModal';
import { formatTokenAmount } from '@/utils/number';
import { customTestnetTokenToTokenItem, getTokenSymbol } from '@/utils/token';
import { BottomSheetFlatList, BottomSheetModal } from '@gorhom/bottom-sheet';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { useMemoizedFn, useRequest } from 'ahooks';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { FormInput } from '@/components/Form/Input';
import { ChainInfo } from '@/screens/Send/components/ChainInfo';
import { RcIconCheckedCC } from '@/assets/icons/common';
import { AbstractPortfolioToken } from '../types';
import { useChainList } from '@/hooks/useChainList';
import { findChain } from '@/utils/chain';
import { Chain } from '@/constant/chains';
import { useInputBlurOnTouchaway } from '@/components/Form/hooks';
import { useFormik } from 'formik';
import { toast } from '@/components/Toast';

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

  const inputRef = React.useRef<TextInput>(null);
  const { onTouchInputAway } = useInputBlurOnTouchaway(inputRef);

  const { data: token, loading } = useRequest(
    async () => {
      if (!chain?.id || !tokenId) {
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
      snapPoints={['70%']}
      onDismiss={onClose}>
      <AppBottomSheetModalTitle title="Add Custom Token" />
      <View style={styles.main}>
        <View style={styles.formItem}>
          <View style={styles.formLabel}>
            <Text style={styles.formLabelText}>Chain:</Text>
          </View>
          <View style={styles.formControl}>
            <ChainInfo
              // chainEnum={chainEnum}
              // onChange={handleChainChanged}
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
              as="BottomSheetTextInput"
              ref={inputRef}
              style={styles.formInput}
              inputStyle={styles.input}
              fieldErrorTextStyle={styles.formInputError}
              inputProps={{
                numberOfLines: 2,
                // bug: can not set multiline is true ?
                // multiline: true,
                value: tokenId,
                onChangeText(text) {
                  setTokenId(text);
                },
              }}
              errorText={errorMessage}
            />
            {loading && tokenId && !errorMessage ? <ActivityIndicator /> : null}
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
                <View style={[styles.token, checked && styles.tokenSelected]}>
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
                      {formatTokenAmount(token.amount)} {getTokenSymbol(token)}
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
      <FooterButton
        title={'Add Token'}
        disabled={!token || !checked || !chain}
        onPress={runAddToken}
        loading={isSubmitting}
        icon={<RcIconAddCircle color={colors['neutral-title-2']} />}
      />
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
  });
