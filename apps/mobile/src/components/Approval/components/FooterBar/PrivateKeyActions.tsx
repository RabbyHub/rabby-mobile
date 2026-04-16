import React from 'react';
import { PropsWithAuthSession } from './ActionsContainer';
import { SubmitActions } from './SubmitActions';

export const PrivateKeyActions: React.FC<PropsWithAuthSession> = props => {
  const { disabledProcess } = props;

  const handleSubmit = React.useCallback(() => {
    props.onSubmit();
  }, [props]);

  return (
    <SubmitActions
      {...props}
      onSubmit={handleSubmit}
      disabledProcess={disabledProcess}
    />
  );
};
