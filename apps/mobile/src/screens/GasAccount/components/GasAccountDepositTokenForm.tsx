import {
  RcIconSwapBottomArrow,
  RcIconSwapReceiveInfo,
} from '@/assets/icons/swap';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import {
  afterBridgeTopUpGasAccount,
  afterTopUpGasAccount,
  buildGasAccountBridgeTxs,
  buildTopUpGasAccount,
  fetchGasAccountBridgeQuote,
  topUpGasAccount,
} from '@/core/apis/gasAccount';
import { sendRequest } from '@/core/apis/sendRequest';
import { Account } from '@/core/services/preference';
import { useUsdInput } from '@/hooks/useUsdInput';
import { useAccounts } from '@/hooks/account';
import { useMiniSigner } from '@/hooks/useSigner';
import { useTheme2024 } from '@/hooks/theme';
import { Skeleton } from '@rneui/themed';
import BigNumber from 'bignumber.js';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { InteractionManager, Keyboard, Platform, View } from 'react-native';
import useDebounce from 'react-use/lib/useDebounce';
import { AssetAvatar, Tip } from '@/components';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { L2_DEPOSIT_ADDRESS_MAP } from '@/constant/gas-account';
import { useGasAccountMethods } from '@/screens/GasAccount/hooks';
import {
  storeApiGasAccount,
  useGasAccountBridgeSupportLoading,
  useGasAccountBridgeSupportUpdatedAt,
  useGasAccountSign,
} from '@/screens/GasAccount/hooks/atom';
import {
  GasAccountAvailableToken,
  useGasAccountDepositAvailableTokens,
} from '@/screens/GasAccount/hooks/useDepositTokenAvailability';
import { Linear } from '@/screens/Transaction/components/SkeletonCard';
import { createGetStyles2024 } from '@/utils/styles';
import {
  filterMyAccounts,
  isAccountSupportMiniApproval,
  isWatchOrSafeAccount,
} from '@/utils/account';
import { findChainByServerID } from '@/utils/chain';
import { formatUsdValue } from '@/utils/number';
import { getTokenSymbol, tokenItemToITokenItem } from '@/utils/token';
import { BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { GasAccountBridgeQuote, Tx } from '@rabby-wallet/rabby-api/dist/types';
import { CHAINS_ENUM } from '@debank/common';
import { GasAccountDepositTokenPicker } from './GasAccountDepositTokenPicker';
import {
  getBridgeFromTokenAmount,
  getDepositAmountValidation,
  getDepositBalanceCopy,
  getDepositMaxUsdValue,
  getMinDepositUsdValue,
} from './GasAccountDepositTokenForm.utils';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { useRequest } from 'ahooks';
import { openapi } from '@/core/request';
import { pollDepositStatus } from '@/core/apis/gasAccount';
import { toast } from '@/components2024/Toast';
import { GasAccountTopUpWaitCallback } from './topUpContinuation';
import { apiProvider } from '@/core/apis';

type DepositAccount = Account;

export const GasAccountDepositTokenForm: React.FC<{
  visible?: boolean;
  onClose?(): void;
  onDeposit?(): Promise<void> | void;
  onWaitDepositResult?: GasAccountTopUpWaitCallback;
  minDepositPrice?: number;
  disableL2Deposit?: boolean;
}> = props => {
  const { accounts } = useAccounts({ disableAutoFetch: true });
  const myAccounts = useMemo(
    () => filterMyAccounts(accounts) as Account[],
    [accounts],
  );
  const {
    availableTokens,
    isCheckingAvailability,
    checkIsExpireAndUpdate,
    refreshBridgeSupportTokenList,
  } = useGasAccountDepositAvailableTokens(props.minDepositPrice, {
    disableL2Deposit: props.disableL2Deposit,
  });
  const bridgeSupportLoading = useGasAccountBridgeSupportLoading();
  const bridgeSupportUpdatedAt = useGasAccountBridgeSupportUpdatedAt();
  const isTokenListLoading =
    isCheckingAvailability ||
    (bridgeSupportUpdatedAt <= 0 && bridgeSupportLoading);

  const refreshAvailableTokens = useCallback(async () => {
    await Promise.allSettled([
      checkIsExpireAndUpdate(),
      refreshBridgeSupportTokenList(),
    ]);
  }, [checkIsExpireAndUpdate, refreshBridgeSupportTokenList]);

  const scheduleRefreshAvailableTokens = useCallback(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      refreshAvailableTokens();
    });

    return () => {
      task.cancel();
    };
  }, [refreshAvailableTokens]);

  useEffect(() => {
    if (!props.visible) {
      return;
    }

    return scheduleRefreshAvailableTokens();
  }, [props.visible, scheduleRefreshAvailableTokens]);

  if (!myAccounts.length) {
    return null;
  }

  return (
    <GasAccountDepositTokenFormInner
      {...props}
      myAccounts={myAccounts}
      availableTokens={availableTokens}
      isCheckingAvailability={isTokenListLoading}
    />
  );
};

const GasAccountDepositTokenFormInner: React.FC<{
  visible?: boolean;
  onClose?(): void;
  onDeposit?(): Promise<void> | void;
  onWaitDepositResult?: GasAccountTopUpWaitCallback;
  minDepositPrice?: number;
  myAccounts: DepositAccount[];
  availableTokens: GasAccountAvailableToken[];
  isCheckingAvailability: boolean;
}> = ({
  visible,
  onClose,
  onDeposit,
  onWaitDepositResult,
  minDepositPrice,
  myAccounts,
  availableTokens,
  isCheckingAvailability,
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({
    getStyle: getStyles,
  });
  const quoteReqIdRef = useRef(0);
  const { sig, accountId } = useGasAccountSign();
  const { login } = useGasAccountMethods();
  const {
    value: usdValue,
    displayedValue,
    onChangeText: setUsdValue,
  } = useUsdInput({ maxDecimals: 4 });
  const didInitRef = useRef(false);

  const [_selectedToken, setSelectedToken] = useState<
    GasAccountAvailableToken | undefined
  >();
  const [tokenPickerVisible, setTokenPickerVisible] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [bridgeQuote, setBridgeQuote] = useState<GasAccountBridgeQuote | null>(
    null,
  );
  const [quoteAmountValue, setQuoteAmountValue] = useState<number | null>(null);
  const [bridgeQuoteError, setBridgeQuoteError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEstimateTip, setShowEstimateTip] = useState(false);
  const pollCancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      pollCancelRef.current?.();
    };
  }, []);

  const { data: _tokenInfo } = useRequest(
    async () => {
      if (
        !_selectedToken?.owner_addr ||
        !_selectedToken?.chain ||
        !_selectedToken?.id
      ) {
        return null;
      }
      const res = await openapi.getToken(
        _selectedToken?.owner_addr,
        _selectedToken?.chain,
        _selectedToken?.id,
      );
      return tokenItemToITokenItem(res, _selectedToken?.owner_addr);
    },
    {
      refreshDeps: [
        _selectedToken?.owner_addr,
        _selectedToken?.chain,
        _selectedToken?.id,
      ],
    },
  );

  const selectedToken = useMemo(() => {
    if (
      _selectedToken &&
      _tokenInfo &&
      _selectedToken?.chain === _tokenInfo?.chain &&
      _selectedToken?.id?.toLowerCase() === _tokenInfo?.id?.toLowerCase()
    ) {
      return { ..._selectedToken, ..._tokenInfo };
    }
    return _selectedToken;
  }, [_selectedToken, _tokenInfo]);

  const resetBridgeQuoteState = useCallback(() => {
    setBridgeQuote(null);
    setQuoteAmountValue(null);
    setBridgeQuoteError('');
    setQuoteLoading(false);
  }, []);

  useEffect(() => {
    if (!visible) {
      setTokenPickerVisible(false);
      resetBridgeQuoteState();
    }
  }, [resetBridgeQuoteState, visible]);

  const didInitSelectedTokenRef = useRef(false);

  useEffect(() => {
    if (!availableTokens.length) {
      setSelectedToken(undefined);
      return;
    }
    if (!didInitSelectedTokenRef.current) {
      didInitSelectedTokenRef.current = true;
      setSelectedToken(prev => {
        if (!prev) {
          return (
            availableTokens?.find(e => e.chain !== 'eth') || availableTokens[0]
          );
        }

        return prev;
      });
    }
  }, [availableTokens]);

  const selectedOwnerAccount = useMemo(() => {
    const matched = myAccounts.filter(
      item =>
        isSameAddress(item.address, selectedToken?.owner_addr || '') &&
        !isWatchOrSafeAccount(item),
    );

    return (
      matched.find(item =>
        [KEYRING_CLASS.PRIVATE_KEY, KEYRING_CLASS.MNEMONIC].includes(item.type),
      ) || matched[0]
    );
  }, [myAccounts, selectedToken?.owner_addr]);

  const signerAccount = useMemo<DepositAccount>(
    () => selectedOwnerAccount || myAccounts[0]!,
    [myAccounts, selectedOwnerAccount],
  );

  const {
    openUI,
    resetGasStore,
    close: closeMiniSign,
  } = useMiniSigner({
    account: signerAccount,
  });

  const amountValue = Number(usdValue || 0);
  const minDepositUsd = useMemo(
    () => getMinDepositUsdValue(minDepositPrice),
    [minDepositPrice],
  );
  const isBridgeDeposit = selectedToken?.gasAccountDepositType === 'bridge';
  const directTokenBalance = Number(selectedToken?.amount || 0);
  const tokenBalanceUsd = Number(selectedToken?.usd_value || 0);
  const bridgeFromTokenAmount = getBridgeFromTokenAmount({
    amountValue,
    tokenPrice: selectedToken?.price,
  });
  const depositMaxUsdValue = getDepositMaxUsdValue({
    isBridgeDeposit,
    directTokenBalance,
    tokenBalanceUsd,
  });
  const balanceText = formatUsdValue(depositMaxUsdValue);
  const balanceDisplayText = formatUsdValue(tokenBalanceUsd);
  const validationMessages = useMemo(
    () => ({
      unavailablePaymentWallet: t(
        'page.gasAccount.depositPopup.unavailablePaymentWallet',
      ),
      invalidAmount: t('page.gasAccount.depositPopup.invalidAmount'),
      zeroInvalidAmount: t('page.gasAccount.depositPopup.zeroInvalidAmount'),
      minAmountRequired: t(
        'page.gasAccount.depositPopup.minAmountRequired',
      ).replace('$1', `$${minDepositUsd}`),
      insufficientTokenBalance: t(
        'page.gasAccount.depositSelectPopup.insufficientTokenBalance',
      ),
      fetchQuoteFailed: t('page.gasAccount.depositPopup.fetchQuoteFailed'),
      insufficientBalanceLabel: t(
        'page.gasAccount.depositPopup.insufficientBalanceLabel',
      ),
    }),
    [t, minDepositUsd],
  );

  useEffect(() => {
    if (visible && !didInitRef.current) {
      didInitRef.current = true;
      setUsdValue(
        new BigNumber(minDepositUsd).toFixed(2, BigNumber.ROUND_CEIL),
      );
    }
  }, [minDepositUsd, setUsdValue, visible]);

  const amountValidation = getDepositAmountValidation({
    hasSelectedToken: !!selectedToken,
    hasSelectedOwnerAccount: !!selectedOwnerAccount,
    usdValue,
    amountValue,
    isBridgeDeposit,
    directTokenBalance,
    tokenBalanceUsd,
    hasTokenPrice: !!selectedToken?.price,
    minDepositUsd,
    messages: validationMessages,
  });

  useDebounce(
    () => {
      if (
        !visible ||
        !isBridgeDeposit ||
        !selectedToken ||
        !selectedOwnerAccount ||
        !amountValidation.isValid
      ) {
        return;
      }

      const requestId = ++quoteReqIdRef.current;
      resetBridgeQuoteState();
      setQuoteLoading(true);

      fetchGasAccountBridgeQuote({
        token: selectedToken,
        account: selectedOwnerAccount,
        usdValue: amountValue,
      })
        .then(quote => {
          if (quoteReqIdRef.current !== requestId) {
            return;
          }
          setBridgeQuote(quote);
          setQuoteAmountValue(amountValue);
        })
        .catch(error => {
          if (quoteReqIdRef.current !== requestId) {
            return;
          }
          console.error('getGasAccountBridgeQuote error', error);
          resetBridgeQuoteState();
          setBridgeQuoteError(validationMessages.fetchQuoteFailed);
        })
        .finally(() => {
          if (quoteReqIdRef.current === requestId) {
            setQuoteLoading(false);
          }
        });
    },
    300,
    [
      amountValidation.isValid,
      amountValue,
      isBridgeDeposit,
      resetBridgeQuoteState,
      selectedOwnerAccount,
      selectedToken,
      validationMessages.fetchQuoteFailed,
      visible,
    ],
  );

  useEffect(() => {
    if (
      !isBridgeDeposit ||
      !selectedToken ||
      !selectedOwnerAccount ||
      !amountValidation.isValid
    ) {
      quoteReqIdRef.current += 1;
      resetBridgeQuoteState();
    }
  }, [
    amountValidation.isValid,
    isBridgeDeposit,
    resetBridgeQuoteState,
    selectedOwnerAccount,
    selectedToken,
  ]);

  const ensureGasAccountLogin = useCallback(
    async (account: DepositAccount) => {
      if (!sig || !accountId) {
        await login(account);
        await storeApiGasAccount.fetchGasAccountInfo();
      }
    },
    [accountId, login, sig],
  );

  const sendBridgeTxsDirectly = useCallback(
    async (txs: Tx[], account: DepositAccount) => {
      let lastHash = '';

      for (const tx of txs) {
        lastHash = await sendRequest<string>({
          data: {
            method: 'eth_sendTransaction',
            params: [tx],
            $ctx: {
              gasAccountTopUp: true,
            },
          },
          session: INTERNAL_REQUEST_SESSION,
          account,
        });
      }

      return lastHash;
    },
    [],
  );

  const fetchTopUpUsedNonce = useCallback(
    async (txHash: string, chainServerId: string, account: DepositAccount) => {
      const tx = await apiProvider.requestETHRpc<{ nonce?: string }>(
        {
          method: 'eth_getTransactionByHash',
          params: [txHash],
        },
        chainServerId,
        account,
      );

      return tx?.nonce;
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (!selectedToken || !selectedOwnerAccount || !amountValidation.isValid) {
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    try {
      await ensureGasAccountLogin(selectedOwnerAccount);

      let depositTxHash = '';

      if (selectedToken.gasAccountDepositType === 'direct') {
        const chainEnum = findChainByServerID(selectedToken.chain);
        const depositAddress = chainEnum
          ? L2_DEPOSIT_ADDRESS_MAP[chainEnum.enum]
          : undefined;
        if (!chainEnum || !depositAddress) {
          return;
        }

        const params = {
          to: depositAddress,
          chainServerId: chainEnum.serverId,
          tokenId: selectedToken.id,
          amount: amountValue,
          rawAmount: new BigNumber(amountValue)
            .times(10 ** selectedToken.decimals)
            .toFixed(0),
          account: selectedOwnerAccount,
        };

        if (isAccountSupportMiniApproval(selectedOwnerAccount.type)) {
          const tx = await buildTopUpGasAccount(params);

          if (tx) {
            resetGasStore();
            closeMiniSign();
            const res = await openUI({
              txs: [tx],
              autoUseGasFree: true,
              purpose: 'gasAccountTopUp',
            });
            const hash = res?.[0];
            await afterTopUpGasAccount({
              ...params,
              tx: hash,
            });
            depositTxHash = hash || '';
          }
        } else {
          depositTxHash = (await topUpGasAccount(params)) || '';
        }
      } else {
        if (!bridgeQuote?.tx || quoteAmountValue !== amountValue) {
          return;
        }

        const bridgeTxs = await buildGasAccountBridgeTxs({
          token: selectedToken,
          account: selectedOwnerAccount,
          quote: bridgeQuote,
          usdValue: amountValue,
        });

        let lastHash = '';
        if (isAccountSupportMiniApproval(selectedOwnerAccount.type)) {
          resetGasStore();
          closeMiniSign();
          const hashes = await openUI({
            txs: bridgeTxs,
            autoUseGasFree: true,
            purpose: 'gasAccountTopUp',
          });
          lastHash = hashes?.[hashes.length - 1] || '';
        } else {
          lastHash = await sendBridgeTxsDirectly(
            bridgeTxs,
            selectedOwnerAccount,
          );
        }

        if (!lastHash) {
          return;
        }

        await afterBridgeTopUpGasAccount({
          chainServerId: selectedToken.chain,
          tokenId: selectedToken.id,
          tokenAmount: bridgeFromTokenAmount,
          usdValue: amountValue,
          txId: lastHash,
          account: selectedOwnerAccount,
        });
        depositTxHash = lastHash;
      }

      if (onWaitDepositResult && depositTxHash) {
        const { promise: pollPromise, cancel } = pollDepositStatus({
          params: {
            from_chain_id: selectedToken.chain,
            tx_id: depositTxHash,
          },
        });
        pollCancelRef.current = cancel;
        const success = await pollPromise;
        pollCancelRef.current = null;
        if (success !== 'cancel') {
          if (success) {
            storeApiGasAccount.markSnapshotDirty('deposit_confirmed');
            const usedNonce = await fetchTopUpUsedNonce(
              depositTxHash,
              selectedToken.chain,
              selectedOwnerAccount,
            );
            await onWaitDepositResult({
              type: 'token',
              ownerAddress: selectedOwnerAccount.address,
              chainServerId: selectedToken.chain,
              usedNonce,
            });
            await onDeposit?.();
          } else {
            toast.info(
              t('page.gasAccount.depositFailed', {
                defaultValue: 'Deposit failed',
              }),
              { position: toast.positions.CENTER },
            );
          }
        }

        await storeApiGasAccount.refreshHistory();
        onClose?.();
        return;
      }

      storeApiGasAccount.markSnapshotDirty('deposit_submitted');
      await storeApiGasAccount.refreshHistory();
      if (onDeposit) {
        await onDeposit();
      } else {
        toast.success(
          t('page.gasAccount.depositSuccess', {
            defaultValue: 'Deposit successful',
          }),
          { position: toast.positions.CENTER },
        );
        onClose?.();
      }
    } catch (error) {
      console.error('GasAccountDepositTokenForm handleSubmit error', error);
      const message =
        error instanceof Error ? error.message : String(error ?? '').trim();
      toast.error(
        t(
          message.toLowerCase().includes('cancel')
            ? 'page.gasAccount.depositCanceled'
            : 'page.gasAccount.depositFailed',
        ),
        {
          position: toast.positions.CENTER,
        },
      );
    } finally {
      setLoading(false);
    }
  }, [
    amountValidation.isValid,
    amountValue,
    bridgeFromTokenAmount,
    bridgeQuote,
    closeMiniSign,
    ensureGasAccountLogin,
    fetchTopUpUsedNonce,
    onClose,
    onDeposit,
    onWaitDepositResult,
    openUI,
    quoteAmountValue,
    resetGasStore,
    selectedOwnerAccount,
    selectedToken,
    sendBridgeTxsDirectly,
    t,
  ]);

  const quoteError =
    !isBridgeDeposit || !amountValidation.isValid || quoteLoading
      ? ''
      : bridgeQuoteError;
  const estReceiveUsdNumber = selectedToken
    ? selectedToken.gasAccountDepositType === 'direct'
      ? amountValue
      : Number(bridgeQuote?.to_token_amount || 0)
    : 0;
  const estReceiveUsdValue = formatUsdValue(estReceiveUsdNumber);
  const canSubmit =
    !!selectedToken &&
    !!selectedOwnerAccount &&
    amountValidation.isValid &&
    !loading &&
    (selectedToken.gasAccountDepositType !== 'bridge' ||
      (!quoteLoading &&
        quoteAmountValue === amountValue &&
        !!bridgeQuote?.tx &&
        !quoteError));

  const tokenSymbol = selectedToken ? getTokenSymbol(selectedToken) : '';
  const balanceCopy = getDepositBalanceCopy({
    hasSelectedToken: !!selectedToken,
    tokenBalanceUsd,
    amountValue,
    formattedBalance: selectedToken ? balanceDisplayText : balanceText,
    balanceLabel: t('page.gasAccount.depositPopup.balanceLabel'),
    insufficientBalanceLabel: validationMessages.insufficientBalanceLabel,
  });
  const getNativeReserveUsdForBridge = useCallback(
    async (token: GasAccountAvailableToken) => {
      const chain = findChainByServerID(token.chain);
      if (!chain || !isSameAddress(token.id, chain.nativeTokenAddress || '')) {
        return new BigNumber(0);
      }

      try {
        const gasList = await apiProvider.gasMarketV2(
          {
            chainId: chain.serverId,
          },
          signerAccount,
        );
        const normalGasPrice = gasList?.find(
          item => item.level === 'normal',
        )?.price;

        if (!normalGasPrice) {
          return new BigNumber(0);
        }

        // Align with swap MAX reserve strategy.
        const reserveGasLimit =
          chain.enum === CHAINS_ENUM.ETH ? 1000000 : 2000000;
        const reserveNativeAmount = new BigNumber(reserveGasLimit)
          .times(normalGasPrice)
          .div(new BigNumber(10).pow(chain.nativeTokenDecimals || 18));
        return reserveNativeAmount.times(token.price || 0);
      } catch (error) {
        console.error(
          'GasAccountDepositTokenForm getSwapStyleNativeReserveUsdForBridge error',
          error,
        );
        return new BigNumber(0);
      }
    },
    [signerAccount],
  );

  const handleMax = useCallback(async () => {
    if (!selectedToken) {
      return;
    }

    const rawMaxValue = new BigNumber(
      isBridgeDeposit ? tokenBalanceUsd : directTokenBalance,
    );
    let maxValue = rawMaxValue;

    if (isBridgeDeposit) {
      const reserveUsd = await getNativeReserveUsdForBridge(selectedToken);
      if (reserveUsd.gt(0)) {
        const deducted = rawMaxValue.minus(reserveUsd);
        maxValue = deducted.lt(0) ? rawMaxValue : deducted;
      }
    }

    setUsdValue(maxValue.decimalPlaces(2, BigNumber.ROUND_DOWN).toFixed());
  }, [
    directTokenBalance,
    getNativeReserveUsdForBridge,
    isBridgeDeposit,
    selectedToken,
    setUsdValue,
    tokenBalanceUsd,
  ]);

  const realGasAccountAddress = accountId || selectedOwnerAccount?.address;

  const { data: gasAccountInfo, runAsync: fetchGasAccountInfo } = useRequest(
    async (address: string) => {
      return openapi.getGasAccountInfoV2({ id: address });
    },
    {
      manual: true,
    },
  );

  useEffect(() => {
    if (minDepositPrice && realGasAccountAddress) {
      fetchGasAccountInfo(realGasAccountAddress);
    }
  }, [minDepositPrice, realGasAccountAddress, fetchGasAccountInfo]);

  const estReceiveLabel = t('page.gasAccount.depositPopup.estReceiveLabel', {
    usd: estReceiveUsdValue,
  });

  const estReceiveUsdNumberBN = useMemo(
    () =>
      minDepositPrice
        ? new BigNumber(estReceiveUsdNumber)
            .plus(gasAccountInfo?.account?.balance || 0)
            .minus(minDepositPrice)
        : new BigNumber(estReceiveUsdNumber),
    [estReceiveUsdNumber, gasAccountInfo?.account?.balance, minDepositPrice],
  );

  const displayedEstReceiveLabel = minDepositPrice
    ? t('page.gasAccount.depositPayPopup.topUpPayTips', {
        topUpUsd: formatUsdValue(minDepositPrice),
        balance: formatUsdValue(
          estReceiveUsdNumberBN.lt(0) ? 0 : estReceiveUsdNumberBN.toFixed(),
        ),
      })
    : estReceiveLabel;

  const estReceiveTip = t('page.gasAccount.depositPopup.estReceiveTip', {
    name: bridgeQuote?.bridge_id,
  });
  const isInteractionLocked = loading;

  let bottomContent: React.ReactNode = null;
  if (!isCheckingAvailability && !availableTokens.length) {
    bottomContent = (
      <Text style={styles.errorText}>
        {t('page.gasAccount.depositPopup.noAvailableToken')}
      </Text>
    );
  } else if (amountValidation.errorMessage) {
    bottomContent = (
      <Text style={styles.errorText}>{amountValidation.errorMessage}</Text>
    );
  } else if (selectedToken && amountValidation.isValid) {
    if (selectedToken.gasAccountDepositType === 'bridge' && quoteError) {
      bottomContent = <Text style={styles.errorText}>{quoteError}</Text>;
    } else if (
      selectedToken.gasAccountDepositType === 'bridge' &&
      (quoteLoading || quoteAmountValue !== amountValue)
    ) {
      bottomContent = (
        <Skeleton
          LinearGradientComponent={Linear}
          animation="wave"
          width={120}
          height={18}
          style={styles.skeleton}
        />
      );
    } else {
      bottomContent = (
        <View style={styles.estimateRow}>
          <Text style={styles.estimateText}>{displayedEstReceiveLabel}</Text>
          {selectedToken.gasAccountDepositType === 'bridge' ? (
            <Tip
              placement="top"
              isVisible={showEstimateTip}
              onClose={() => setShowEstimateTip(false)}
              content={
                <View style={styles.tipContent}>
                  <Text style={styles.tipDesc}>{estReceiveLabel}</Text>
                  <Text style={styles.tipDesc}>{estReceiveTip}</Text>
                </View>
              }
              contentStyle={styles.tipContentStyle}
              tooltipStyle={styles.tipTooltipStyle}>
              <CustomTouchableOpacity
                onPress={() => setShowEstimateTip(true)}
                style={styles.tipTrigger}>
                <RcIconSwapReceiveInfo />
              </CustomTouchableOpacity>
            </Tip>
          ) : null}
        </View>
      );
    }
  }

  return (
    <>
      <BottomSheetView style={styles.container}>
        <Text style={styles.title}>
          {t('page.gasAccount.depositPopup.gasDepositTitle')}
        </Text>

        <View style={styles.formItem}>
          <View style={styles.formItemLabelRow}>
            <Text style={styles.formItemLabel}>
              {t('page.gasAccount.depositPopup.amount')}
            </Text>
            <Text
              style={[
                styles.formItemDesc,
                balanceCopy.isInsufficient ? styles.formItemDescError : null,
              ]}>
              {balanceCopy.copy}
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
              editable={!isInteractionLocked}
              textAlignVertical="center"
              placeholder="$0"
              value={displayedValue}
              onChangeText={setUsdValue}
              numberOfLines={1}
            />
            {!usdValue && (
              <CustomTouchableOpacity
                style={styles.maxButtonWrapper}
                onPress={handleMax}>
                <Text style={styles.maxButtonText}>MAX</Text>
              </CustomTouchableOpacity>
            )}
            <View style={styles.inputDivider} />
            <CustomTouchableOpacity
              style={styles.wrapper}
              disabled={isInteractionLocked}
              onPress={() => {
                if (isInteractionLocked) {
                  return;
                }
                setTokenPickerVisible(true);
              }}>
              <View style={styles.tokenContainer}>
                {selectedToken ? (
                  <>
                    <AssetAvatar
                      size={26}
                      chain={selectedToken.chain}
                      logo={selectedToken.logo_url}
                      chainSize={12}
                    />
                    <Text style={styles.tokenText}>{tokenSymbol}</Text>
                  </>
                ) : (
                  <Text style={styles.tokenPlaceholder}>
                    {t('page.gasAccount.depositPopup.selectToken')}
                  </Text>
                )}
                <RcIconSwapBottomArrow />
              </View>
            </CustomTouchableOpacity>
          </View>

          <View style={styles.bottomContainer}>{bottomContent}</View>
        </View>

        <Button
          type="primary"
          loading={loading}
          disabled={!canSubmit}
          onPress={handleSubmit}
          buttonStyle={styles.depositButton}
          titleStyle={styles.depositButtonTitle}
          title={t('page.gasAccount.depositPopup.gasDepositButton', {
            defaultValue: 'Deposit',
          })}
        />
      </BottomSheetView>

      {tokenPickerVisible ? (
        <GasAccountDepositTokenPicker
          visible={tokenPickerVisible}
          availableTokens={availableTokens}
          isCheckingAvailability={isCheckingAvailability}
          onClose={() => setTokenPickerVisible(false)}
          onSelect={token => {
            setSelectedToken(token);
            setTokenPickerVisible(false);
          }}
        />
      ) : null}
    </>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 48,
    display: 'flex',
    flexDirection: 'column',
  },
  formItem: {
    marginBottom: 28,
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
  formItemDescError: {
    color: ctx.colors2024['red-default'],
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
      fontFamily: 'SF Pro Rounded',
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
  inputDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: ctx.colors2024['neutral-line'],
    opacity: 0.7,
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
  wrapper: {
    backgroundColor: ctx.colors2024['neutral-line'],
    padding: 4,
    borderRadius: 100,
  },
  tokenContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 144,
  },
  tokenText: {
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    maxWidth: 74,
  },
  tokenPlaceholder: {
    color: ctx.colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    maxWidth: 84,
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
  bottomContainer: {
    marginTop: 8,
    minHeight: 18,
    marginLeft: 8,
  },
  estimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  estimateText: {
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
  },
  errorText: {
    color: ctx.colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
  },
  skeleton: {
    borderRadius: 100,
    backgroundColor: ctx.colors2024['neutral-bg-5'],
  },
  tipTrigger: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  tipTitle: {
    color: ctx.colors2024['neutral-InvertHighlight'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  tipDesc: {
    color: ctx.colors2024['neutral-InvertHighlight'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
  },
  tipContentStyle: {
    backgroundColor: ctx.colors2024['neutral-black'],
    borderRadius: 8,
    padding: 0,
  },
  tipTooltipStyle: {
    shadowColor: 'rgba(0, 0, 0, 0.06)',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 20,
  },
  depositButton: {
    height: 58,
    borderRadius: 16,
  },
  depositButtonTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
}));
