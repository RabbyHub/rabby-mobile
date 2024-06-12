import { ServiceEvent } from '@rabby-wallet/biz-utils';

export const enum SignEvent {
  SIGN_WAITING_AMOUNTED = 'SIGN_WAITING_AMOUNTED',
}

export const signEvent = new ServiceEvent<SignEvent>();

export const waitSignComponentAmounted = async () => {
  return new Promise<void>(resolve => {
    signEvent.once(SignEvent.SIGN_WAITING_AMOUNTED, () => {
      resolve();
    });
  });
};

export const emitSignComponentAmounted = () => {
  signEvent.emit(SignEvent.SIGN_WAITING_AMOUNTED);
};
