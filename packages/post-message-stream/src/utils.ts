import { isObject } from '@metamask/utils';

export const DEDICATED_WORKER_NAME = 'dedicatedWorker';

export type StreamData = number | string | Record<string, unknown> | unknown[];

export interface StreamMessage {
  data: StreamData;
  [key: string]: unknown;
}

/**
 * Checks whether the specified stream event message is valid per the
 * expectations of this library.
 *
 * @param message - The stream event message property.
 * @returns Whether the `message` is a valid stream message.
 */
export function isValidStreamMessage(
  message: unknown,
): message is StreamMessage {
  return (
    isObject(message) &&
    Boolean(message.data) &&
    (typeof message.data === 'number' ||
      typeof message.data === 'object' ||
      typeof message.data === 'string')
  );
}
