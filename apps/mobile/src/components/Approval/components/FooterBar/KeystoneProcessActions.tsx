import React from 'react';
import { useTranslation } from 'react-i18next';
import { Props } from './ActionsContainer';
import { ProcessActions } from './ProcessActions';
import KeystoneSvg from '@/assets/icons/wallet/keystone.svg';

export const KeystoneProcessActions: React.FC<Props> = props => {
  const { disabledProcess } = props;
  const { t } = useTranslation();

  return (
    <ProcessActions
      {...props}
      submitText={t('page.signFooterBar.keystoneSign')}
      disabledProcess={disabledProcess}
      buttonIcon={<KeystoneSvg width={22} height={22} viewBox="0 0 640 640" />}
    />
  );
};
