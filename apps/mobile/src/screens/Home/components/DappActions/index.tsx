import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ExplainTxResponse,
  Tx,
  WithdrawAction,
} from '@rabby-wallet/rabby-api/dist/types';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useDappAction } from './hook';

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
}: {
  data?: WithdrawAction[];
  chain?: string;
  protocolLogo?: string;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  const [disabledSign, setDisabledSign] = useState(false);
  const [isShowMiniSign, setIsShowMiniSign] = useState(false);
  const [miniSignTxs, setMiniSignTxs] = useState<Tx[]>([]);
  const [title, setTitle] = useState<string>('');

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
  );
  const { valid: showClaim, action: actionClaim } = useDappAction(
    claimAction,
    chain,
  );

  const onPreExecChange = useCallback(
    (r: ExplainTxResponse) => {
      if (!r.pre_exec.success) {
        setDisabledSign(true);
        return;
      }
      if (
        !r?.balance_change?.receive_nft_list?.length &&
        !r?.balance_change?.receive_token_list?.length
      ) {
        // queue withdraw not need to check balance change
        if (!isQueueWithdraw) {
          setDisabledSign(true);
          return;
        }
      }
      setDisabledSign(false);
    },
    [isQueueWithdraw],
  );
  return (
    <View style={styles.container}>
      {showWithdraw && (
        <ActionButton
          text="Withdraw"
          // className={`${showClaim ? 'w-[216px]' : 'flex-1'}`}
          onPress={
            () => {}
            // handleSubmit(actionWithdraw, t('component.DappActions.withdraw'))
          }
        />
      )}
      {showClaim && (
        <ActionButton
          text="Claim"
          // className={`${showWithdraw ? 'w-[108px]' : 'flex-1'}`}
          onPress={
            () => {}
            // handleSubmit(actionClaim, t('component.DappActions.claim'))
          }
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
