import React from 'react';

/**
 * some devices require a connection to the device to sign transactions
 */
export const useDeviceConnect = () => {
  /**
   * @returns {boolean} true if connected, false if not connected and popup is shown
   */
  const connect = React.useCallback((data: any) => {
    return true;
  }, []);

  return connect;
};
