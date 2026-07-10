import type { Account } from '@/core/services/preference';
import { makeJsEEClass } from '@/core/utils/makeJsEEClass';

const { EventEmitter: AppServiceEvents } = makeJsEEClass<{
  currentAccountChanged: (account: Account) => void;
  backupReminderChanged: (dbId: string) => void;
}>();

export const appServiceEvents = new AppServiceEvents();
