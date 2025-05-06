import OneKeySvg from '@/assets/icons/wallet/onekey.svg';
import { useOneKeyStatus } from '@/hooks/onekey/useOneKeyStatus';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Props } from '../FooterBar/ActionsContainer';
import { MiniProcessActions } from './MiniProcessActions';

export const MiniOneKeyProcessActions: React.FC<Props> = props => {
  const { disabledProcess, account } = props;
  const { status, onClickConnect } = useOneKeyStatus(account.address);
  const { t } = useTranslation();

  const handleSubmit = React.useCallback(() => {
    if (status !== 'CONNECTED') {
      onClickConnect(() => {
        props.onSubmit();
      });
      return;
    }
    props.onSubmit();
  }, [status, onClickConnect, props]);

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
