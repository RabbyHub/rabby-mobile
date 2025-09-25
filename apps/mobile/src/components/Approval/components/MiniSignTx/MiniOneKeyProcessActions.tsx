import OneKeySvg from '@/assets/icons/wallet/onekey.svg';
import { useOneKeyStatus } from '@/hooks/onekey/useOneKeyStatus';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Props } from '../FooterBar/ActionsContainer';
import { MiniProcessActions } from './MiniProcessActions';
import { apiOneKey } from '@/core/apis';
import { useSetHardWareWalletSignBleStatus } from './atom';

export const MiniOneKeyProcessActions: React.FC<Props> = props => {
  const { disabledProcess, account } = props;
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const { onClickConnect } = useOneKeyStatus(account.address, {
    onDismiss: () => {
      setIsSubmitting(false);
    },
    autoConnect: false,
  });

  const { t } = useTranslation();

  const isConnectedPromise = React.useMemo(
    () => apiOneKey.isConnected(account.address),
    [account.address],
  );

  const { setOneKeyCheckBlePending } = useSetHardWareWalletSignBleStatus();

  const handleSubmit = React.useCallback(() => {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setOneKeyCheckBlePending(true);
    isConnectedPromise
      .then(([isConnected]) => {
        setOneKeyCheckBlePending(false);
        if (!isConnected) {
          onClickConnect(
            () => {
              props.onSubmit();
              setIsSubmitting(false);
            },
            () => {
              props.onCancel?.();
            },
          );
          return;
        }
        props.onSubmit();
        setIsSubmitting(false);
      })
      .finally(() => {
        setOneKeyCheckBlePending(false);
      });
  }, [
    isSubmitting,
    setOneKeyCheckBlePending,
    isConnectedPromise,
    props,
    onClickConnect,
  ]);

  return (
    <MiniProcessActions
      {...props}
      onSubmit={handleSubmit}
      submitText={t('page.signFooterBar.oneKeyConfirm')}
      disabledProcess={disabledProcess}
      buttonIcon={<OneKeySvg width={22} height={22} viewBox="0 0 28 28" />}
    />
  );
};
