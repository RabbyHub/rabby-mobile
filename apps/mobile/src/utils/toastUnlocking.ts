import i18next from 'i18next';

import { toastIndicator } from '@/components2024/Toast';

export const toastUnlocking = () =>
  toastIndicator(i18next.t('page.unlock.unlocking'), {
    isTop: true,
  });
