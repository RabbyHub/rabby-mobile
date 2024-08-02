import React from 'react';
import { Props } from './ActionsContainer';
import { SubmitActions } from './SubmitActions';

export const PrivateKeyActions: React.FC<Props> = props => {
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
