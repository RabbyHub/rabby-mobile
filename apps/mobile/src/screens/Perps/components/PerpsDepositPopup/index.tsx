import { RcIconSwapBottomArrow } from '@/assets/icons/swap';
import { AssetAvatar } from '@/components';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { RcIconInfoFill1CC, RcIconInfoFillCC } from '@/assets/icons/common';
import {
  ARB_USDC_TOKEN_ID,
  ARB_USDC_TOKEN_ITEM,
  ARB_USDC_TOKEN_SERVER_CHAIN,
  PERPS_SEND_ARB_USDC_ADDRESS,
} from '@/constant/perps';
import { Skeleton } from '@rneui/themed';
import { openapi } from '@/core/request';
import { Account } from '@/core/services/preference';
import { useTheme2024 } from '@/hooks/theme';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';
import {
  formatNumber,
  formatPerpsUsdValue,
  formatUsdValue,
} from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';
import { BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useMemoizedFn, useRequest } from 'ahooks';
import useDebounce from 'react-use/lib/useDebounce';
import BigNumber from 'bignumber.js';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Platform, Text, TouchableOpacity, View } from 'react-native';
import { PerpsDepositTokenModal } from './PerpsDepositTokenModal';
import { PerpsSelectTokenPopup } from './PerpsSelectTokenPopup';
import { useUsdInput } from '@/hooks/useUsdInput';
import AuthButton from '@/components2024/AuthButton';
import { isAccountSupportDirectSign } from '@/utils/account';
import { CHAINS_ENUM, formatTokenAmount } from '@debank/common';
import { PerpBridgeQuote, Tx } from '@rabby-wallet/rabby-api/dist/types';
import { findChain } from '@/utils/chain';
import { abiCoder } from '@/core/apis/sendRequest';
import { getERC20Allowance } from '@/core/apis/provider';
import { approveToken } from '@/core/apis/approvals';
import { Linear } from '@/screens/Transaction/components/SkeletonCard';
import { useTipsPopup } from '@/hooks/useTipsPopup';
import { ETH_USDT_CONTRACT } from '@/constant/swap';

export interface PerpBridgeHistory {
  from_chain_id: string;
  from_token_id: string;
  from_token_amount: number;
  to_token_amount: number;
  tx: Tx;
}

export const PerpsDepositPopup: React.FC<{
  account?: Account | null;
  visible?: boolean;
  onClose?(): void;
  onDeposit?(
    txs: Tx[],
    amount: string,
    cacheBridgeHistory?: PerpBridgeHistory,
  ): void;
}> = ({ visible, onClose, account, onDeposit }) => {
  const modalRef = useRef<AppBottomSheetModal>(null);

  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyle,
  });
  // const [amount, setAmount] = React.useState<string>('');
  const {
    value: usdValue,
    onChangeText: setUsdValue,
    displayedValue: displayedAmount,
  } = useUsdInput();
  const { showTipsPopup } = useTipsPopup();

  const [isShowTokenPopup, setIsShowTokenPopup] = useState(false);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [isShowModal, setIsShowModal] = useState(false);
  const [selectedToken, setSelectedToken] = useState<AbstractPortfolioToken>(
    ensureAbstractPortfolioToken(ARB_USDC_TOKEN_ITEM),
  );
  const [quoteLoading, setQuoteLoading] = useState<boolean>(true);
  const [cacheBridgeHistory, setCacheBridgeHistory] =
    useState<PerpBridgeHistory | null>(null);
  const [bridgeQuote, setBridgeQuote] = useState<PerpBridgeQuote | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const { t } = useTranslation();

  const { data: _tokenInfo, runAsync: runFetchUsdcToken } = useRequest(
    async () => {
      if (!account || !selectedToken) {
        return null;
      }
      const res = await openapi.getToken(
        account.address,
        selectedToken?.chain,
        selectedToken?._tokenId,
      );
      return ensureAbstractPortfolioToken(res);
    },
    {
      refreshDeps: [account?.address, selectedToken],
    },
  );

  const tokenInfo = useMemo(() => {
    return (
      _tokenInfo ||
      selectedToken ||
      ensureAbstractPortfolioToken(ARB_USDC_TOKEN_ITEM)
    );
  }, [_tokenInfo, selectedToken]);

  const buildSendTx = useMemoizedFn((amount: number | string) => {
    const token = ARB_USDC_TOKEN_ITEM;
    const to = PERPS_SEND_ARB_USDC_ADDRESS;

    const chain = findChain({
      serverId: token.chain,
    })!;
    const sendValue = new BigNumber(amount || 0)
      .multipliedBy(10 ** token.decimals)
      .decimalPlaces(0, BigNumber.ROUND_DOWN);
    const dataInput = [
      {
        name: 'transfer',
        type: 'function',
        inputs: [
          {
            type: 'address',
            name: 'to',
          },
          {
            type: 'uint256',
            name: 'value',
          },
        ] as any[],
      } as const,
      [to, sendValue.toFixed(0)] as any[],
    ] as const;
    const params: Record<string, any> = {
      chainId: chain.id,
      from: account!.address,
      to: token.id,
      value: '0x0',
      data: abiCoder.encodeFunctionCall(dataInput[0], dataInput[1]),
      isSend: true,
    };

    return params as Tx;
  });

  const isDirectDeposit = useMemo(() => {
    return (
      selectedToken?._tokenId === ARB_USDC_TOKEN_ID &&
      selectedToken?.chain === ARB_USDC_TOKEN_SERVER_CHAIN
    );
  }, [selectedToken]);

  const amountValidation = React.useMemo(() => {
    const amountValue = Number(usdValue);
    if (amountValue === 0) {
      return { isValid: false, error: null };
    }

    if (Number.isNaN(+usdValue)) {
      return {
        isValid: false,
        error: 'invalid_number',
        errorMessage: t('page.perps.PerpsDepositPopup.invalidNumber'),
      };
    }

    if (amountValue < 5) {
      return {
        isValid: false,
        error: 'minimum_limit',
        errorMessage: t('page.perps.PerpsDepositPopup.minimumDepositSize'),
      };
    }

    const tokenUsdAmount = (tokenInfo?.amount || 0) * (tokenInfo?.price || 0);

    if (amountValue > tokenUsdAmount) {
      return {
        isValid: false,
        error: 'insufficient_balance',
        errorMessage: t('page.perps.PerpsDepositPopup.insufficientBalance'),
      };
    }
    return { isValid: true, error: null };
  }, [usdValue, t, tokenInfo]);

  const isValidAmount = useMemo(
    () => amountValidation.isValid,
    [amountValidation.isValid],
  );

  const updateMiniSignTx = useMemoizedFn(
    async (value: number, token: AbstractPortfolioToken) => {
      if (!account) {
        return;
      }

      if (!isDirectDeposit) {
        setQuoteLoading(true);
        const targetTxs: Tx[] = [];
        try {
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }
          const controller = new AbortController();
          abortControllerRef.current = controller;

          const amount = value / token.price;

          const fromTokenRawAmount = new BigNumber(amount)
            .times(10 ** token.decimals)
            .toFixed(0, 1)
            .toString();
          const res = await openapi.getPerpBridgeQuote({
            user_addr: account!.address,
            from_chain_id: token.chain,
            from_token_id: token._tokenId,
            from_token_raw_amount: fromTokenRawAmount,
          });
          let tokenApproved = false;
          let allowance = '0';
          const fromChain = findChain({ serverId: token.chain });
          if (token._tokenId === fromChain?.nativeTokenAddress) {
            tokenApproved = true;
          } else {
            allowance = await getERC20Allowance(
              token.chain,
              token._tokenId,
              res.approve_contract_id,
              account!.address,
              account!,
            );
            tokenApproved = new BigNumber(allowance).gte(
              new BigNumber(amount).times(10 ** token.decimals),
            );
          }

          let shouldTwoStepApprove = false;
          if (
            fromChain?.enum === CHAINS_ENUM.ETH &&
            isSameAddress(token.id, ETH_USDT_CONTRACT) &&
            Number(allowance) !== 0 &&
            !tokenApproved
          ) {
            shouldTwoStepApprove = true;
          }
          if (controller.signal.aborted) {
            return;
          }
          if (res.tx) {
            if (!tokenApproved) {
              if (shouldTwoStepApprove) {
                const resp = await approveToken({
                  chainServerId: token.chain,
                  id: token._tokenId,
                  spender: res.approve_contract_id,
                  amount: 0,
                  account: account,
                  isBuild: true,
                });
                targetTxs.push(resp.params[0]);
              }

              const resp = await approveToken({
                chainServerId: token.chain,
                id: token._tokenId,
                spender: res.approve_contract_id,
                amount: fromTokenRawAmount,
                account: account,
                isBuild: true,
              });
              targetTxs.push(resp.params[0]);
            }
            const bridgeTx = {
              from: res.tx.from,
              to: res.tx.to,
              value: res.tx.value,
              data: res.tx.data,
              chainId: res.tx.chainId,
            } as Tx;
            targetTxs.push(bridgeTx);
            setTxs(targetTxs);
            setBridgeQuote(res);
            setQuoteLoading(false);
            setCacheBridgeHistory({
              from_chain_id: token.chain,
              from_token_id: token._tokenId,
              from_token_amount: amount,
              to_token_amount: res.to_token_amount,
              tx: res.tx,
            });
          } else {
            setBridgeQuote(null);
            setTxs([]);
            setQuoteLoading(false);
          }
        } catch (error) {
          console.error('getPerpBridgeQuote error', error);
          setBridgeQuote(null);
          setTxs([]);
          setQuoteLoading(false);
        }
      } else {
        const res = buildSendTx(value);
        setTxs([res]);
        setBridgeQuote(null);
      }
    },
  );

  useDebounce(
    () => {
      if (!visible) {
        return;
      }
      if (!isValidAmount) {
        return;
      }
      updateMiniSignTx(Number(usdValue), tokenInfo);
    },
    300,
    [usdValue, visible, tokenInfo, updateMiniSignTx],
  );

  useEffect(() => {
    if (visible) {
      if (!isValidAmount) {
        setTxs([]);
        setBridgeQuote(null);
        setQuoteLoading(true);
      }
    }
  }, [isValidAmount, visible, setTxs, setBridgeQuote, setQuoteLoading]);

  const { runAsync: handleDeposit, loading } = useRequest(
    async () => {
      Keyboard.dismiss();
      const bridgeValue = (
        (bridgeQuote?.to_token_amount || 0) * ARB_USDC_TOKEN_ITEM.price
      ).toString();
      const value = isDirectDeposit ? usdValue : bridgeValue;
      await onDeposit?.(txs, value, cacheBridgeHistory || undefined);
      setTxs([]);
      setBridgeQuote(null);
    },
    {
      manual: true,
    },
  );
  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setUsdValue('');
      setSelectedToken(ensureAbstractPortfolioToken(ARB_USDC_TOKEN_ITEM));
    }
  }, [setUsdValue, visible, setSelectedToken]);

  const depositMaxUsdValue = useMemo(() => {
    return Number((tokenInfo?.amount || 0) * (tokenInfo?.price || 0));
  }, [tokenInfo]);

  const quoteError = useMemo(() => {
    return !isDirectDeposit &&
      isValidAmount &&
      !quoteLoading &&
      !bridgeQuote?.tx
      ? t('page.perps.PerpsDepositPopup.fetchQuoteFailed')
      : '';
  }, [bridgeQuote, quoteLoading, isDirectDeposit, t, isValidAmount]);

  const BottomComponent = useMemo(() => {
    if (amountValidation.errorMessage) {
      return (
        <Text style={styles.errorMessage}>{amountValidation.errorMessage}</Text>
      );
    }

    if (!isDirectDeposit && isValidAmount) {
      if (quoteLoading) {
        return (
          <Skeleton
            LinearGradientComponent={Linear}
            animation="wave"
            width={120}
            height={18}
            style={[styles.skeleton]}
          />
        );
      }
      if (quoteError) {
        return (
          <Text style={styles.errorMessage}>
            {t('page.perps.PerpsDepositPopup.fetchQuoteFailed')}
          </Text>
        );
      }

      if (bridgeQuote?.tx) {
        return (
          <TouchableOpacity
            style={styles.estReceiveContainer}
            onPress={() => {
              Keyboard.dismiss();
              showTipsPopup({
                title: t('page.perps.PerpsDepositPopup.estReceive', {
                  balance: formatUsdValue(
                    (bridgeQuote?.to_token_amount || 0) *
                      ARB_USDC_TOKEN_ITEM.price,
                  ),
                }),
                desc: t('page.perps.PerpsDepositPopup.estReceiveTooltip', {
                  number: bridgeQuote?.duration || 0,
                }),
              });
            }}>
            <Text style={styles.estReceiveText}>
              {t('page.perps.PerpsDepositPopup.estReceive', {
                balance: formatUsdValue(
                  (bridgeQuote?.to_token_amount || 0) *
                    ARB_USDC_TOKEN_ITEM.price,
                ),
              })}
            </Text>
            <RcIconInfoFill1CC
              color={colors2024['neutral-info']}
              width={18}
              height={18}
            />
          </TouchableOpacity>
        );
      }
    }

    return null;
  }, [
    isValidAmount,
    bridgeQuote,
    amountValidation.errorMessage,
    styles,
    t,
    isDirectDeposit,
    quoteLoading,
    quoteError,
    showTipsPopup,
    colors2024,
  ]);

  const canShowDirectSubmit = isAccountSupportDirectSign(account?.type);

  if (!account) {
    return null;
  }

  return (
    <>
      <AppBottomSheetModal
        ref={modalRef}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg1',
        })}
        onDismiss={onClose}
        // enableDynamicSizing
        snapPoints={[376]}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore">
        <BottomSheetView style={[styles.container]}>
          <View>
            <Text style={styles.title}>
              {t('page.perps.PerpsDepositPopup.title')}
            </Text>
          </View>
          <View style={styles.formItem}>
            <View style={styles.formItemLabelRow}>
              <Text style={styles.formItemLabel}>
                {t('page.perps.PerpsDepositPopup.amount')}
              </Text>
              <Text style={styles.formItemDesc}>
                {t('page.perps.PerpsDepositPopup.balance')}:{' '}
                {tokenInfo
                  ? `${formatPerpsUsdValue(
                      depositMaxUsdValue,
                      BigNumber.ROUND_DOWN,
                    )}`
                  : '$0'}
              </Text>
            </View>
            <View style={styles.inputContainer}>
              <BottomSheetTextInput
                keyboardType="numeric"
                style={[
                  styles.input,
                  !amountValidation.isValid && usdValue !== ''
                    ? styles.inputError
                    : null,
                ]}
                textAlignVertical="center"
                placeholder="$0"
                value={displayedAmount}
                onChangeText={setUsdValue}
                numberOfLines={1}
              />
              {!usdValue && (
                <TouchableOpacity
                  style={styles.maxButtonWrapper}
                  onPress={() => {
                    setUsdValue(
                      Number(
                        (Math.floor(depositMaxUsdValue * 100) / 100).toFixed(2),
                      ).toString(),
                    );
                  }}>
                  <Text style={styles.maxButtonText}>MAX</Text>
                </TouchableOpacity>
              )}
              <View style={styles.divider} />
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setIsShowTokenPopup(true);
                }}>
                <View style={styles.tokenContainer}>
                  <AssetAvatar
                    size={26}
                    chain={tokenInfo?.chain}
                    logo={tokenInfo?.logo_url}
                    chainSize={12}
                  />
                  <Text style={styles.tokenText}>
                    {getTokenSymbol(tokenInfo)}
                  </Text>

                  <RcIconSwapBottomArrow />
                </View>
              </TouchableOpacity>
            </View>
            <View style={styles.bottomContainer}>{BottomComponent}</View>
          </View>
          {canShowDirectSubmit ? (
            <AuthButton
              authTitle={t('page.whitelist.confirmPassword')}
              title={t('page.perps.PerpsDepositPopup.depositBtn')}
              onFinished={handleDeposit}
              disabled={
                !isValidAmount ||
                Boolean(quoteError) ||
                (!isDirectDeposit && quoteLoading)
              }
              loading={loading}
              type={'primary'}
              syncUnlockTime
              onBeforeAuth={() => {
                Keyboard.dismiss();
              }}
              // onCancel={() => {
              // }}
            />
          ) : (
            <Button
              type="primary"
              title={t('page.perps.PerpsDepositPopup.depositBtn')}
              onPress={handleDeposit}
              disabled={
                !isValidAmount ||
                Boolean(quoteError) ||
                (!isDirectDeposit && quoteLoading)
              }
              loading={loading}
            />
          )}
        </BottomSheetView>
      </AppBottomSheetModal>
      <PerpsSelectTokenPopup
        account={account}
        visible={isShowTokenPopup}
        onClose={() => {
          setIsShowTokenPopup(false);
        }}
        onSelect={async token => {
          setUsdValue('');
          if (
            token.chain === ARB_USDC_TOKEN_SERVER_CHAIN &&
            isSameAddress(token._tokenId, ARB_USDC_TOKEN_ID)
          ) {
            setIsShowTokenPopup(false);
            return;
          }

          const res = await openapi.getPerpsBridgeIsSupportToken({
            token_id: token._tokenId,
            chain_id: token.chain,
          });

          if (res?.success) {
            // bridge token with liFi dex
            setIsShowTokenPopup(false);
            setSelectedToken(token);
            // setClickLoading(false);
          } else {
            setSelectedToken(token);
            setIsShowModal(true);
          }
        }}
      />
      <PerpsDepositTokenModal
        visible={isShowModal}
        onCancel={() => {
          setIsShowModal(false);
        }}
        token={selectedToken}
        onNavigate={() => {
          setIsShowModal(false);
          setIsShowTokenPopup(false);
          onClose?.();
        }}
      />
    </>
  );
};

const getStyle = createGetStyles2024(ctx => {
  return {
    container: {
      // height: '100%',
      backgroundColor: ctx.colors2024['neutral-bg-1'],
      paddingBottom: 56,
      paddingHorizontal: 20,
      display: 'flex',
      flexDirection: 'column',
    },
    formItem: {
      marginBottom: 48,
    },
    formItemLabelRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    formItemLabel: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: ctx.colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
    },
    formItemDesc: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: ctx.colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
    },
    inputContainer: {
      borderRadius: 16,
      paddingVertical: 28,
      paddingHorizontal: 20,
      backgroundColor: ctx.colors2024['neutral-bg-2'],
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    input: {
      ...(Platform.OS === 'ios' && {
        fontFamily: 'SF Pro Rounded', // avoid some android phone show number not in center
      }),
      fontSize: 28,
      lineHeight: 36,
      fontWeight: '700',
      flex: 1,
      paddingTop: 0,
      paddingBottom: 0,
      color: ctx.colors2024['neutral-title-1'],
      minHeight: 52,
    },
    inputError: {
      color: ctx.colors2024['red-default'],
    },
    skeleton: {
      borderRadius: 100,
      backgroundColor: ctx.colors2024['neutral-bg-5'],
    },
    bottomContainer: {
      marginTop: 8,
      minHeight: 18,
      marginLeft: 8,
    },
    maxButtonWrapper: {
      padding: 4,
      backgroundColor: ctx.colors2024['brand-light-1'],
      borderRadius: 8,
    },
    maxButtonText: {
      color: ctx.colors2024['brand-default'],
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
    },
    errorMessage: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '400',
      color: ctx.colors2024['red-default'],
      flexShrink: 0,
    },
    title: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '900',
      color: ctx.colors2024['neutral-title-1'],
      marginBottom: 24,
      textAlign: 'center',
    },
    divider: {
      width: 1,
      height: 28,
      backgroundColor: ctx.colors2024['neutral-line'],
    },
    tokenContainer: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      padding: 4,
      backgroundColor: ctx.colors2024['neutral-line'],
      borderRadius: 100,
    },
    tokenText: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      color: ctx.colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
    },
    estReceiveText: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '400',
      color: ctx.colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
    },
    estReceiveContainer: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
  };
});
