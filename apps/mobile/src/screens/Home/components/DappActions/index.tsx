import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleProp, TouchableOpacity, View, ViewStyle } from 'react-native';
import {
  ExplainTxResponse,
  PortfolioItem,
  Tx,
  WithdrawAction,
} from '@rabby-wallet/rabby-api/dist/types';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  findTypedWithdrawAction,
  useDappAction,
  useDappActionRequest,
} from './hook';
import { sendRequest } from '@/core/apis/provider';
import { toast } from '@/components2024/Toast';
import { DappActionHeader } from './DappActionHeader';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { isAccountSupportMiniApproval } from '@/utils/account';
import { debounce } from 'lodash';
import { useMiniSigner } from '@/hooks/useSigner';
import { Text } from '@/components/Typography';

export const enum ActionType {
  Withdraw = 'withdraw',
  Claim = 'claim',
  Queue = 'queue',
}

interface ActionButtonProps {
  style?: StyleProp<ViewStyle>;
  text: string;
  onPress: () => void;
  disabled?: boolean;
}

const ActionButton = ({
  text,
  onPress,
  style,
  disabled,
}: ActionButtonProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const onPressRef = useRef(onPress);
  onPressRef.current = () => {
    if (!disabled) {
      onPress();
    }
  };
  const debounceOnPress = useMemo(
    () =>
      debounce(() => {
        onPressRef.current();
      }, 200),
    [],
  );
  useEffect(() => () => debounceOnPress.cancel(), [debounceOnPress]);
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.buttonDisabled, style]}
      disabled={disabled}
      onPress={disabled ? undefined : debounceOnPress}>
      <Text style={styles.buttonText}>{text}</Text>
    </TouchableOpacity>
  );
};

export const DappActions = ({
  data,
  portfolio,
  chain,
  protocolLogo,
  currentAccount,
  onRefresh,
  session = INTERNAL_REQUEST_SESSION,
  style,
  disableAction,
}: {
  data?: WithdrawAction[];
  portfolio: PortfolioItem;
  chain?: string;
  protocolLogo?: string;
  currentAccount?: KeyringAccountWithAlias;
  onRefresh?: () => Promise<void>;
  session?: typeof INTERNAL_REQUEST_SESSION;
  style?: StyleProp<ViewStyle>;
  disableAction?: boolean;
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { valid: showWithdraw, action } = useDappAction(
    findTypedWithdrawAction(data, 'withdraw'),
    chain,
    currentAccount,
  );
  const { valid: showClaim } = useDappAction(
    findTypedWithdrawAction(data, 'claim'),
    chain,
    currentAccount,
  );
  const { pending, run } = useDappActionRequest(
    portfolio,
    currentAccount,
    action,
  );

  const {
    openUI,
    close: closeMiniSigner,
    updateConfig,
    resetGasStore,
  } = useMiniSigner({
    account: currentAccount!,
  });

  const onPreExecChange = useCallback(
    (r: ExplainTxResponse, isQueueWithdraw: boolean) => {
      const hasReceivedAssets =
        !!r.balance_change?.receive_nft_list?.length ||
        !!r.balance_change?.receive_token_list?.length;
      // Queue withdrawals do not receive assets immediately.
      updateConfig({
        disableSignBtn:
          !r.pre_exec.success || (!isQueueWithdraw && !hasReceivedAssets),
      });
    },
    [updateConfig],
  );
  const canDirectSign = useMemo(() => {
    return isAccountSupportMiniApproval(currentAccount?.type || '');
  }, [currentAccount?.type]);

  const handleSubmit = useCallback(
    async (txs: Tx[], actionType: WithdrawAction['type']) => {
      const isQueueWithdraw = actionType === ActionType.Queue;
      const title = actionType === ActionType.Claim ? 'Claim' : 'Withdraw';
      if (!txs?.length) {
        return;
      }

      if (canDirectSign) {
        try {
          closeMiniSigner();
          resetGasStore();
          await openUI({
            txs: txs,
            title: (
              <DappActionHeader
                logo={protocolLogo}
                chain={chain}
                title={title}
                showQueueDesc={isQueueWithdraw}
              />
            ),
            enableSecurityEngine: true,
            showSimulateChange: true,
            onPreExecChange: r => onPreExecChange(r, isQueueWithdraw),
            disableSignBtn: false,
            ga: {
              category: 'DappActions',
              action: title,
            },
            showCheck: true,
            session,
          });
          setTimeout(() => {
            onRefresh?.();
            closeMiniSigner();
          }, 500);
        } catch (error) {
          console.error('error occur', error);
        }
      } else {
        try {
          for await (const tx of txs) {
            await sendRequest({
              data: {
                method: 'eth_sendTransaction',
                params: [tx],
              },
              session: INTERNAL_REQUEST_SESSION,
              account: currentAccount!,
            });
          }
          setTimeout(() => {
            onRefresh?.();
          }, 500);
        } catch (error) {
          console.error('Transaction failed:', error);
          toast.error(
            typeof (error as any)?.message === 'string'
              ? (error as any)?.message
              : 'Transaction failed',
          );
        }
      }
    },
    [
      canDirectSign,
      chain,
      closeMiniSigner,
      currentAccount,
      onPreExecChange,
      onRefresh,
      openUI,
      protocolLogo,
      resetGasStore,
      session,
    ],
  );
  if (!showWithdraw && !showClaim) {
    return null;
  }
  return (
    <View style={[styles.container, style]}>
      {showWithdraw && (
        <ActionButton
          text="Withdraw"
          disabled={disableAction || pending}
          onPress={() => run('withdraw', handleSubmit)}
        />
      )}
      {showClaim && (
        <ActionButton
          text="Claim"
          disabled={disableAction || pending}
          onPress={() => run('claim', handleSubmit)}
        />
      )}
    </View>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    display: 'flex',
    flexDirection: 'row',
    gap: 12,
    // marginLeft: 8,
    // marginRight: 8,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    // backgroundColor: colors2024['neutral-InvertHighlight'],
    borderWidth: 1,
    borderColor: colors2024['brand-default'],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors2024['brand-default'],
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
}));
