import { makeJsEEClass } from '@/core/services/_utils';

export type OpenApiDebugEventBusListeners = {
  OPENAPI_HTTP_ERROR_DEBUG: (detail: {
    source: 'openapi' | 'testOpenapi' | 'notificationOpenapi';
    status: number;
    method: string;
    url: string;
    message: string;
  }) => void;
};

const { EventEmitter: OpenApiDebugEE } =
  makeJsEEClass<OpenApiDebugEventBusListeners>();

export const openApiDebugEvents = new OpenApiDebugEE();

export const OPENAPI_HTTP_ERROR_DEBUG = 'OPENAPI_HTTP_ERROR_DEBUG';
