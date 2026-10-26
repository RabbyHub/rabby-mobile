import type { KeyringEventAccount } from '@rabby-wallet/service-keyring';

import { makeJsEEClass } from '@/core/utils/makeJsEEClass';

export type PerfAccountEventBusListeners = {
  ACCOUNT_ADDED: (ctx: {
    accounts: KeyringEventAccount[];
    scene?: 'privateKey' | 'memonics' | 'hardware' | 'syncExtension';
    needsBackupReminder?: boolean;
  }) => void;
  ACCOUNT_REMOVED: (ctx: { removedAccounts: KeyringEventAccount[] }) => void;
};

type AccountAddedContext = Parameters<
  PerfAccountEventBusListeners['ACCOUNT_ADDED']
>[0];

const { EventEmitter: AccountEE } =
  makeJsEEClass<PerfAccountEventBusListeners>();

export const MAX_PENDING_ACCOUNT_ADDED = 20;

/**
 * `ACCOUNT_ADDED` consumers (newly-added marks, gas account checks, backup
 * reminder persistence) live in the account store lifecycle, which is only
 * registered by a `homePostStartupReady`-staged startup task. On a fresh
 * install Home is never mounted before the first wallet is created, so an
 * emit from the onboarding flow would land on an empty bus and be dropped for
 * good.
 *
 * Buffer those emits until the first listener shows up instead.
 */
export class AccountEventBus extends AccountEE {
  private pendingAccountAdded: AccountAddedContext[] = [];

  emit<T extends keyof PerfAccountEventBusListeners & string>(
    eventType: T,
    ...args: Parameters<PerfAccountEventBusListeners[T]>
  ): boolean {
    if (
      eventType === 'ACCOUNT_ADDED' &&
      this.listenerCount('ACCOUNT_ADDED') === 0
    ) {
      if (this.pendingAccountAdded.length < MAX_PENDING_ACCOUNT_ADDED) {
        this.pendingAccountAdded.push(args[0] as AccountAddedContext);
      }
      return false;
    }

    return super.emit(eventType, ...args);
  }

  on<T extends keyof PerfAccountEventBusListeners & string>(
    eventType: T,
    listener: PerfAccountEventBusListeners[T],
  ): this {
    super.on(eventType, listener);
    this.flushPendingAccountAdded(eventType);

    return this;
  }

  subscribe<T extends keyof PerfAccountEventBusListeners & string>(
    type: T,
    listener: PerfAccountEventBusListeners[T],
  ) {
    const result = super.subscribe(type, listener);
    this.flushPendingAccountAdded(type);

    return result;
  }

  private flushPendingAccountAdded(eventType: string) {
    if (eventType !== 'ACCOUNT_ADDED' || !this.pendingAccountAdded.length) {
      return;
    }

    const pending = this.pendingAccountAdded;
    this.pendingAccountAdded = [];
    pending.forEach(ctx => {
      super.emit('ACCOUNT_ADDED', ctx);
    });
  }
}

export const accountEvents = new AccountEventBus();
