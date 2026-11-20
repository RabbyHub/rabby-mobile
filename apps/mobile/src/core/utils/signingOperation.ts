import { v4 as uuidv4 } from 'uuid';
import { eventBus, EVENTS } from '@/utils/events';

export type SignFinishedEvent = {
  success: boolean;
  data?: any;
  errorMsg?: string;
  signingOperationId?: string;
};

export const createSigningOperationId = () => uuidv4();

export const listenForSignFinished = (
  signingOperationId: string,
  canAccept: () => boolean,
  listener: (data: SignFinishedEvent) => void | Promise<void>,
) => {
  const handleSignFinished = (data: SignFinishedEvent) => {
    if (data?.signingOperationId !== signingOperationId || !canAccept()) {
      return;
    }
    return listener(data);
  };

  eventBus.addListener(EVENTS.SIGN_FINISHED, handleSignFinished);
  return () => {
    eventBus.removeListener(EVENTS.SIGN_FINISHED, handleSignFinished);
  };
};
