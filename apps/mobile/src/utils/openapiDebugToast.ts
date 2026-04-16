import { toast } from '@/components2024/Toast';
import { storeApiExpSettingData } from '@/hooks/appSettings';
import {
  openApiDebugEvents,
  OPENAPI_HTTP_ERROR_DEBUG,
  OpenApiDebugEventBusListeners,
} from './openapiDebugEvents';

const OPENAPI_HTTP_TOAST_DEDUPE_MS = 3000;

const openApiHttpToastState = {
  started: false,
  at: 0,
  signature: '',
};

export function startSubscribeOpenApiHttpErrorDebugToast() {
  if (openApiHttpToastState.started) {
    return;
  }

  openApiHttpToastState.started = true;

  const onOpenApiHttpError: OpenApiDebugEventBusListeners[typeof OPENAPI_HTTP_ERROR_DEBUG] =
    detail => {
      if (!storeApiExpSettingData.get().toastOpenApiHttpErrorStatus) {
        return;
      }

      const now = Date.now();
      if (
        openApiHttpToastState.signature === detail.message &&
        now - openApiHttpToastState.at < OPENAPI_HTTP_TOAST_DEDUPE_MS
      ) {
        return;
      }

      openApiHttpToastState.at = now;
      openApiHttpToastState.signature = detail.message;
      toast.error(detail.message);
    };

  openApiDebugEvents.on(OPENAPI_HTTP_ERROR_DEBUG, onOpenApiHttpError);
}
