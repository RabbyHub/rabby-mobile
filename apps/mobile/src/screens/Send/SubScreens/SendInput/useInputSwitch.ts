import React from 'react';

export const useInputSwitch = () => {
  const [isInputAddress, setIsInputAddress] = React.useState(false);

  const toggle = React.useCallback(() => {
    setIsInputAddress(pre => !pre);
  }, [setIsInputAddress]);

  const clean = React.useCallback(() => {
    setIsInputAddress(false);
  }, [setIsInputAddress]);

  return {
    isInputAddress,
    toggle,
    clean,
  };
};
