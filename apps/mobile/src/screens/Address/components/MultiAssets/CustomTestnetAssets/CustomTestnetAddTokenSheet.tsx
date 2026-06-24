import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { debounce } from 'lodash';
import { Hex, isValidHexAddress } from '@metamask/utils';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';

import { AssetAvatar } from '@/components/AssetAvatar';
import { Text } from '@/components/Typography';
import PasteButton from '@/components2024/PasteButton';
import { Button } from '@/components2024/Button';
import { apiCustomTestnet } from '@/core/apis';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import type {
  CustomTestnetTokenBase,
  TestnetChain,
} from '@/types/customTestnet';
import { toast } from '@/components2024/Toast';
import { ChainInitialBadge } from './ChainInitialBadge';

type CustomTestnetAddTokenSheetProps = {
  chain: TestnetChain;
  onCancel?(): void;
  onConfirm?(token: CustomTestnetTokenBase): void | Promise<void>;
};

type TokenLookupState =
  | {
      status: 'idle' | 'checking';
      token?: undefined;
      error?: undefined;
    }
  | {
      status: 'found';
      token: CustomTestnetTokenBase;
      error?: undefined;
    }
  | {
      status: 'error';
      token?: undefined;
      error: string;
    };

export const CustomTestnetAddTokenSheet = memo(
  ({ chain, onCancel, onConfirm }: CustomTestnetAddTokenSheetProps) => {
    const { styles, colors2024 } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const [address, setAddress] = useState('');
    const [lookupState, setLookupState] = useState<TokenLookupState>({
      status: 'idle',
    });
    const [confirming, setConfirming] = useState(false);
    const lookupSeqRef = useRef(0);

    const lookupToken = useMemo(
      () =>
        debounce(async (nextAddress: string, seq: number) => {
          try {
            const token = await apiCustomTestnet.getCustomTestnetToken({
              chainId: chain.id,
              address: '',
              tokenId: nextAddress,
            });

            if (lookupSeqRef.current !== seq) {
              return;
            }

            setLookupState({
              status: 'found',
              token: {
                id: token.id,
                chainId: token.chainId,
                symbol: token.symbol,
                decimals: token.decimals,
              },
            });
          } catch (error) {
            if (lookupSeqRef.current !== seq) {
              return;
            }
            setLookupState({
              status: 'error',
              error: t('page.customTestnet.addToken.notErc20'),
            });
          }
        }, 300),
      [chain.id, t],
    );

    useEffect(() => {
      return () => {
        lookupToken.cancel();
      };
    }, [lookupToken]);

    useEffect(() => {
      const nextAddress = address.trim();
      lookupSeqRef.current += 1;
      lookupToken.cancel();

      if (!nextAddress) {
        setLookupState({ status: 'idle' });
        return;
      }

      if (!isValidHexAddress(nextAddress as Hex)) {
        setLookupState({
          status: 'error',
          error: t('page.customTestnet.addToken.invalidAddress'),
        });
        return;
      }

      if (isSameAddress(nextAddress, chain.nativeTokenAddress)) {
        setLookupState({
          status: 'error',
          error: t('page.customTestnet.addToken.notErc20'),
        });
        return;
      }

      if (
        apiCustomTestnet.isAddedCustomTestnetToken({
          id: nextAddress,
          chainId: chain.id,
        })
      ) {
        setLookupState({
          status: 'error',
          error: t('page.customTestnet.addToken.alreadyAdded'),
        });
        return;
      }

      const seq = lookupSeqRef.current;
      setLookupState({ status: 'checking' });
      lookupToken(nextAddress, seq);
    }, [address, chain.id, chain.nativeTokenAddress, lookupToken, t]);

    const handleAddressChange = useCallback((text: string) => {
      setAddress(text);
    }, []);

    const handleCancel = useCallback(() => {
      Keyboard.dismiss();
      onCancel?.();
    }, [onCancel]);

    const handleConfirm = useCallback(async () => {
      if (lookupState.status !== 'found') {
        return;
      }

      Keyboard.dismiss();
      setConfirming(true);
      try {
        await apiCustomTestnet.addCustomTestnetToken(lookupState.token);
        toast.success(t('page.customTestnet.addToken.added'));
        setConfirming(false);
        await onConfirm?.(lookupState.token);
      } catch (error: any) {
        toast.show(
          error?.message || t('page.customTestnet.addToken.addFailed'),
        );
        setConfirming(false);
      }
    }, [lookupState, onConfirm, t]);

    const confirmDisabled = lookupState.status !== 'found' || confirming;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>
          {t('page.customTestnet.addToken.title')}
        </Text>

        <View style={styles.content}>
          <View style={styles.field}>
            <Text style={styles.label}>
              {t('page.customTestnet.addToken.chain')}
            </Text>
            <View style={styles.chainField}>
              <ChainInitialBadge name={chain.name} size={24} />
              <Text numberOfLines={1} style={styles.chainName}>
                {chain.name}
              </Text>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              {t('page.customTestnet.addToken.tokenAddress')}
            </Text>
            <View style={styles.addressInputWrap}>
              <BottomSheetTextInput
                multiline
                value={address}
                onChangeText={handleAddressChange}
                placeholder={t('page.customTestnet.addToken.enterAddress')}
                placeholderTextColor={colors2024['neutral-secondary']}
                style={styles.addressInput}
                textAlignVertical="top"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <PasteButton
                style={styles.pasteButton}
                iconColor={colors2024['brand-default']}
                onPaste={text => {
                  handleAddressChange(text.trim());
                  Keyboard.dismiss();
                }}
              />
            </View>
            {lookupState.status === 'found' ? (
              <View style={styles.foundToken}>
                <Text style={styles.foundTokenLabel}>
                  {t('page.customTestnet.addToken.foundToken')}
                </Text>
                <View style={styles.foundTokenMain}>
                  <AssetAvatar
                    size={24}
                    chain={chain.serverId}
                    chainSize={10}
                    innerChainStyle={styles.foundTokenChainIcon}
                  />
                  <Text style={styles.foundTokenSymbol}>
                    {lookupState.token.symbol}
                  </Text>
                </View>
              </View>
            ) : lookupState.status === 'checking' ? (
              <Text style={styles.checkingText}>
                {t('page.customTestnet.addToken.checking')}
              </Text>
            ) : lookupState.status === 'error' ? (
              <Text style={styles.errorText}>{lookupState.error}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.footer}>
          <Button
            title={t('global.Cancel')}
            type="plain"
            height={48}
            containerStyle={styles.footerButton}
            buttonStyle={styles.cancelButton}
            titleStyle={styles.cancelButtonText}
            onPress={handleCancel}
            disabled={confirming}
          />
          <Button
            title={t('global.Confirm')}
            type="primary"
            height={48}
            containerStyle={styles.footerButton}
            buttonStyle={styles.confirmButton}
            onPress={handleConfirm}
            loading={confirming}
            disabled={confirmDisabled}
          />
        </View>
      </View>
    );
  },
);

const getStyle = createGetStyles2024(ctx =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 34,
      backgroundColor: ctx.colors2024['neutral-bg-1'],
    },
    title: {
      color: ctx.colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '800',
      textAlign: 'center',
    },
    content: {
      marginTop: 26,
      gap: 30,
    },
    field: {
      gap: 12,
    },
    label: {
      paddingLeft: 8,
      color: ctx.colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
    },
    chainField: {
      height: 56,
      borderRadius: 16,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: ctx.colors2024['neutral-bg-2'],
    },
    chainName: {
      color: ctx.colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      flex: 1,
    },
    addressInputWrap: {
      height: 140,
      borderRadius: 16,
      backgroundColor: ctx.colors2024['neutral-bg-2'],
      overflow: 'hidden',
    },
    addressInput: {
      minHeight: 94,
      paddingTop: 18,
      paddingHorizontal: 18,
      color: ctx.colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '400',
    },
    pasteButton: {
      position: 'absolute',
      right: 16,
      bottom: 18,
      borderWidth: 0,
      padding: 0,
      paddingVertical: 0,
      paddingHorizontal: 0,
      minWidth: 61,
      height: 22,
      gap: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    foundToken: {
      alignSelf: 'flex-start',
      minHeight: 36,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: ctx.colors2024['neutral-bg-2'],
    },
    foundTokenLabel: {
      color: ctx.colors2024['neutral-body'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '400',
    },
    foundTokenMain: {
      height: 29,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    foundTokenChainIcon: {
      borderWidth: 0.8,
      borderColor: ctx.colors2024['neutral-bg-1'],
      borderRadius: 3,
    },
    foundTokenSymbol: {
      color: ctx.colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
    },
    checkingText: {
      color: ctx.colors2024['neutral-foot'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 13,
      lineHeight: 16,
      fontWeight: '400',
    },
    errorText: {
      color: ctx.colors2024['red-default'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 13,
      lineHeight: 16,
      fontWeight: '400',
    },
    footer: {
      marginTop: 'auto',
      flexDirection: 'row',
      gap: 12,
    },
    footerButton: {
      flex: 1,
    },
    cancelButton: {
      borderRadius: 12,
      backgroundColor: ctx.colors2024['neutral-bg-5'],
    },
    confirmButton: {
      borderRadius: 12,
    },
    cancelButtonText: {
      color: ctx.colors2024['neutral-title-1'],
    },
  }),
);
