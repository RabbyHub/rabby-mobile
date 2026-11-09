import { captureAndOpenScreenshotFeedback } from '@/components/Screenshot/hooks';
import { toast } from '@/components2024/Toast';
import i18next from 'i18next';

export function openBridgeSupport() {
  captureAndOpenScreenshotFeedback().catch(() => {
    toast.error(i18next.t('page.bridge.status.captureFailed'));
  });
}
