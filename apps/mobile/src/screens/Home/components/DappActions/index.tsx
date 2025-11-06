import React, { useCallback, useMemo } from 'react';
import {
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import {
  ExplainTxResponse,
  Tx,
  WithdrawAction,
} from '@rabby-wallet/rabby-api/dist/types';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useDappAction } from './hook';
import { sendRequest } from '@/core/apis/provider';
import { toast } from '@/components2024/Toast';
import { DappActionHeader } from './DappActionHeader';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { isAccountSupportMiniApproval } from '@/utils/account';
import { debounce } from 'lodash';
import { useMiniSigner } from '@/hooks/useSigner';

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
  const debounceOnPress = useMemo(() => debounce(onPress, 200), [onPress]);
  return (
    <TouchableOpacity style={[styles.button, style]} onPress={debounceOnPress}>
      <Text style={styles.buttonText}>{text}</Text>
    </TouchableOpacity>
  );
};

export const DappActions = ({
  data,
  chain,
  protocolLogo,
  currentAccount,
  onRefresh,
  session = INTERNAL_REQUEST_SESSION,
}: {
  data?: WithdrawAction[];
  chain?: string;
  protocolLogo?: string;
  currentAccount?: KeyringAccountWithAlias;
  onRefresh?: () => Promise<void>;
  session?: typeof INTERNAL_REQUEST_SESSION;
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

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
    openUI,
    close: closeMiniSigner,
    updateConfig,
    resetGasStore,
  } = useMiniSigner({
    account: currentAccount!,
  });

  const setDisableSignBtn = useCallback(
    (v: boolean) => {
      updateConfig({ disableSignBtn: v });
    },
    [updateConfig],
  );
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
    [isQueueWithdraw, setDisableSignBtn],
  );
  const canDirectSign = useMemo(() => {
    return isAccountSupportMiniApproval(currentAccount?.type || '');
  }, [currentAccount?.type]);

  const handleSubmit = useCallback(
    async (action: () => Promise<Tx[]>, title?: string) => {
      const txs = await action();
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
            onPreExecChange,
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
      isQueueWithdraw,
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
    marginTop: 12,
  },
  button: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors2024['neutral-bg-5'],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors2024['neutral-title-1'],
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
}));
