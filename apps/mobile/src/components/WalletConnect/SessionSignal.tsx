import React from 'react';
import { Signal, SignalProps } from '../Signal';
import { useSessionStatus } from '@/hooks/useSessionStatus';
import { useSessionChainId } from '@/hooks/walletconnect/useSessionChainId';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

interface Props extends SignalProps {
  size?: 'small' | 'normal';
  isBadge?: boolean;
  address: string;
  brandName: string;
  pendingConnect?: boolean;
  chainId?: number;
}

export const SessionSignal: React.FC<Props> = ({
  size = 'normal',
  isBadge,
  address,
  brandName,
  style,
  pendingConnect,
  chainId,
}) => {
  const { status } = useSessionStatus(
    {
      address,
      brandName,
    },
    pendingConnect,
  );
  const sessionChainId = useSessionChainId({
    address,
    brandName,
  });

  const bgColor = React.useMemo(() => {
    if (chainId && chainId !== sessionChainId && status === 'CONNECTED') {
      return 'orange';
    }

    switch (status) {
      case 'ACCOUNT_ERROR':
      case 'BRAND_NAME_ERROR':
        return 'orange';

      case undefined:
      case 'DISCONNECTED':
      case 'RECEIVED':
      case 'REJECTED':
        return 'gray';

      default:
        return 'green';
    }
  }, [status, chainId, sessionChainId]);

  return <Signal style={style} size={size} isBadge={isBadge} color={bgColor} />;
};

export const CommonSignal: React.FC<Props & { type?: KEYRING_TYPE }> = ({
  type,
  ...props
}) => {
  return (
    <>
      {type === KEYRING_TYPE.WalletConnectKeyring && (
        <SessionSignal isBadge pendingConnect style={props.style} {...props} />
      )}
    </>
  );
};
