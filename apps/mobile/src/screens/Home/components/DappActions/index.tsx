import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import {
  ExplainTxResponse,
  Tx,
  WithdrawAction,
} from '@rabby-wallet/rabby-api/dist/types';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useDappAction } from './hook';
import { useCanProcessDirectSubmit } from '@/hooks/useMiniApprovalDirectSign';
import { sendRequest } from '@/core/apis/provider';
import { toast } from '@/components2024/Toast';
import { useMiniApproval } from '@/hooks/useMiniApproval';
import { Account } from '@/core/services/preference';
import { DappActionHeader } from './DappActionHeader';
import { INTERNAL_REQUEST_SESSION } from '@/constant';

export const enum ActionType {
  Withdraw = 'withdraw',
  Claim = 'claim',
  Queue = 'queue',
}

interface ActionButtonProps {
  style?: StyleProp<ViewStyle>;
  text: string;
  onPress: () => void;
}

const ActionButton = ({ text, onPress, style }: ActionButtonProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  return (
    <Pressable style={[styles.button, style]} onPress={onPress}>
      <Text style={styles.buttonText}>{text}</Text>
    </Pressable>
  );
};

export const DappActions = ({
  data,
  chain,
  protocolLogo,
  currentAccount,
}: {
  data?: WithdrawAction[];
  chain?: string;
  protocolLogo?: string;
  currentAccount?: Account;
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const [disableSignBtn, setDisableSignBtn] = useState(false);

  const withdrawAction = useMemo(
    () =>
      data?.find(
        item =>
          item.type === ActionType.Withdraw || item.type === ActionType.Queue,
      ),
    [data],
  );
  const claimAction = useMemo(
    () => data?.find(item => item.type === ActionType.Claim),
    [data],
  );
  const isQueueWithdraw = useMemo(
    () => withdrawAction?.type === ActionType.Queue,
    [withdrawAction?.type],
  );

  const { valid: showWithdraw, action: actionWithdraw } = useDappAction(
    withdrawAction,
    chain,
    currentAccount,
  );
  const { valid: showClaim, action: actionClaim } = useDappAction(
    claimAction,
    chain,
    currentAccount,
  );
  const {
    sendMiniTransactions,
    setMiniSignExtraProps,
    resetMiniSignExtraProps,
  } = useMiniApproval();

  const onPreExecChange = useCallback(
    (r: ExplainTxResponse) => {
      if (!r.pre_exec.success) {
        setDisableSignBtn(true);
        return;
      }
      if (
        !r?.balance_change?.receive_nft_list?.length &&
        !r?.balance_change?.receive_token_list?.length
      ) {
        // queue withdraw not need to check balance change
        if (!isQueueWithdraw) {
          setDisableSignBtn(true);
          return;
        }
      }
      setDisableSignBtn(false);
    },
    [isQueueWithdraw],
  );
  const canDirectSign = useCanProcessDirectSubmit();

  useEffect(() => {
    setMiniSignExtraProps(pre => ({ ...pre, disableSignBtn }));
  }, [setMiniSignExtraProps, disableSignBtn]);

  const handleSubmit = useCallback(
    async (action: () => Promise<Tx[]>, title?: string) => {
      const txs = await action();
      if (canDirectSign) {
        resetMiniSignExtraProps();
        setMiniSignExtraProps(pre => ({
          ...pre,
          title: (
            <DappActionHeader
              logo={protocolLogo}
              chain={chain}
              title={title}
              showQueueDesc={isQueueWithdraw}
            />
          ),
          showSimulateChange: true,
          autoThrowPreExecError: false,
          onPreExecChange,
        }));
        try {
          const res = await sendMiniTransactions({
            txs: txs,
            account: currentAccount!,
          });
          const hash = res[res.length - 1].txHash;
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
                // TODO: add ga
              },
              session: INTERNAL_REQUEST_SESSION,
              account: currentAccount!,
            });
          }
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
      currentAccount,
      isQueueWithdraw,
      onPreExecChange,
      protocolLogo,
      resetMiniSignExtraProps,
      sendMiniTransactions,
      setMiniSignExtraProps,
    ],
  );
  return (
    <View style={styles.container}>
      {showWithdraw && (
        <ActionButton
          text="Withdraw"
          onPress={() => {
            handleSubmit(actionWithdraw, 'Withdraw');
          }}
        />
      )}
      {showClaim && (
        <ActionButton
          text="Claim"
          onPress={() => {
            handleSubmit(actionClaim, 'Claim');
          }}
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
    paddingHorizontal: 16,
    marginTop: 12,
  },
  button: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors2024['brand-light-1'],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors2024['brand-default'],
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
}));
