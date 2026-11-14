import { ServiceEvent } from '@rabby-wallet/biz-utils';

export const enum SignEvent {
  SIGN_WAITING_AMOUNTED = 'SIGN_WAITING_AMOUNTED',
  SIGN_WAITING_CANCELLED = 'SIGN_WAITING_CANCELLED',
}

export const signEvent = new ServiceEvent<SignEvent>();

export const waitSignComponentAmounted = async (
  signingOperationId?: string,
) => {
  return new Promise<boolean>(resolve => {
    if (!signingOperationId) {
      signEvent.once(SignEvent.SIGN_WAITING_AMOUNTED, () => resolve(true));
      return;
    }

    const cleanup = () => {
      signEvent.off(SignEvent.SIGN_WAITING_AMOUNTED, handleMounted);
      signEvent.off(SignEvent.SIGN_WAITING_CANCELLED, handleCancelled);
    };
    const handleMounted = (mountedOperationId: string) => {
      if (mountedOperationId !== signingOperationId) return;
      cleanup();
      resolve(true);
    };
    const handleCancelled = (cancelledOperationId: string) => {
      if (cancelledOperationId !== signingOperationId) return;
      cleanup();
      resolve(false);
    };

    signEvent.on(SignEvent.SIGN_WAITING_AMOUNTED, handleMounted);
    signEvent.on(SignEvent.SIGN_WAITING_CANCELLED, handleCancelled);
  });
};

export const emitSignComponentAmounted = (signingOperationId?: string) => {
  signEvent.emit(SignEvent.SIGN_WAITING_AMOUNTED, signingOperationId);
};

export const cancelSignComponentAmounted = (signingOperationId: string) => {
  signEvent.emit(SignEvent.SIGN_WAITING_CANCELLED, signingOperationId);
};
