import {
  accountEvents,
  fetchAllAccounts,
  invalidateFetchAllAccountsCache,
} from '@/core/apis/account';
import * as apiMnemonic from '@/core/apis/mnemonic';
import { getAllAccounts, removeAddress } from '@/core/apis/address';
import { AccountInfoEntity } from '@/databases/entities/accountInfo';
import { EntityAccountBase } from '@/databases/entities/base';
import { ormEvents } from '@/databases/entities/_helpers';
import { deleteDBResourceForAddress } from '@/databases/sync/assets';
import { BaseStore } from './_base';
import { InteractionManager } from 'react-native';
import { isEqual } from 'lodash';
import type {
  Account,
  IPinAddress,
  KeyringAccountWithAlias,
} from '@/types/account';
import { bindKeyringEvent, bindKeyringStore } from '@/core/serviceApi/keyring';
import {
  clearNeedsBackupReminder,
  getPinnedAddresses,
  getPinnedAddressSnapshot,
  setNeedsBackupReminder,
  updatePinnedAddresses,
} from '@/core/serviceApi/preference';
import { transactionHistoryServiceApi } from '@/core/serviceApi/transactionHistory';
import { perfEvents } from '@/core/utils/perf';
import type { UpdaterOrPartials } from '@/core/utils/store';
import { EVENT_SWITCH_ACCOUNT, eventBus } from '@/utils/events';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import type { KeyringAccount } from '@rabby-wallet/keyring-utils';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { matomoRequestEvent } from '@/utils/analytics';
import { updateHistoryTimeSingleAddress } from '@/hooks/historyTokenDict';
import { checkAddedAccountsGasAccountIfNeeded } from '@/utils/autoLoginGasAccount';
import { runAfterHomePostStartupReady } from '@/core/utils/homeStartupReady';
import {
  normalizePinnedAddresses,
  updatePinnedAddressList,
} from './pinnedAddresses';

export interface AccountStoreState {
  accounts: KeyringAccountWithAlias[];
  hasFetchedAccounts: boolean;
  isFetchingAccounts: boolean;
  pinnedAddresses: IPinAddress[];
  currentAccount: KeyringAccountWithAlias | null;
  newlyAddedAccounts: Record<
    AccountInfoEntity['_db_id'],
    Awaited<ReturnType<typeof AccountInfoEntity.getAccountsAddedIn>>[0]
  >;
}

export const NEWLY_ADDED_ACCOUNT_DURATION = 10 * 60 * 1000;

class AccountStore extends BaseStore<AccountStoreState> {
  private hasStartedLifecycle = false;
  private hasHydratedPinnedAddresses = false;
  private deferredFetchAccountReasons = new Set<string>();

  private readonly hydratePinnedAddressesInParallel =
    this.createAvoidParallelAsyncMethod(async () => {
      const addresses = normalizePinnedAddresses(await getPinnedAddresses());
      this.hasHydratedPinnedAddresses = true;
      this.setPinnedAddresses(addresses);
      return addresses;
    });

  private readonly fetchAccountsInParallel =
    this.createAvoidParallelAsyncMethod(
      async (options?: { force?: boolean }) => {
        this.setState(prev => {
          if (prev.isFetchingAccounts) {
            return prev;
          }
          return {
            isFetchingAccounts: true,
          };
        });

        try {
          const accounts = await fetchAllAccounts(options);
          this.setState({
            accounts,
            hasFetchedAccounts: true,
            isFetchingAccounts: false,
          });
          return accounts;
        } catch (error) {
          this.setState({
            hasFetchedAccounts: true,
            isFetchingAccounts: false,
          });
          throw error;
        }
      },
    );

  constructor() {
    super({
      accounts: [],
      hasFetchedAccounts: false,
      isFetchingAccounts: false,
      pinnedAddresses: normalizePinnedAddresses(getPinnedAddressSnapshot()),
      currentAccount: null,
      newlyAddedAccounts: {},
    });
  }

  setAccounts = (val: AccountStoreState['accounts']) => {
    this.setField('accounts', val, { strict: true });
  };

  setCurrentAccount = (
    valOrFunc: UpdaterOrPartials<AccountStoreState['currentAccount']>,
  ) => {
    this.setField('currentAccount', valOrFunc, { strict: true });
  };

  setPinnedAddresses = (
    valOrFunc: UpdaterOrPartials<AccountStoreState['pinnedAddresses']>,
  ) => {
    this.setField('pinnedAddresses', valOrFunc);
  };

  ensurePinnedAddressesHydrated = async () => {
    if (this.hasHydratedPinnedAddresses) {
      return this.getState().pinnedAddresses;
    }

    return this.hydratePinnedAddressesInParallel();
  };

  refreshPinnedAddresses = () => this.hydratePinnedAddressesInParallel();

  fetchAccounts = async (options?: { force?: boolean }) => {
    return this.fetchAccountsInParallel(options);
  };

  private scheduleFetchAccountsAfterHomePostStartupReady = (
    reason: string,
    options?: { force?: boolean },
  ) => {
    if (this.deferredFetchAccountReasons.has(reason)) {
      return;
    }

    this.deferredFetchAccountReasons.add(reason);
    runAfterHomePostStartupReady(
      () => {
        this.deferredFetchAccountReasons.delete(reason);
        this.fetchAccounts(options);
      },
      {
        fallbackMs: 5000,
        label: `account_store_${reason}`,
      },
    );
  };

  fetchNewlyAddedAccounts = async () => {
    const accounts = await AccountInfoEntity.getAccountsAddedIn(
      NEWLY_ADDED_ACCOUNT_DURATION,
    );

    const nextValue = accounts.reduce((acc, item) => {
      acc[item._db_id] = item;
      return acc;
    }, {} as AccountStoreState['newlyAddedAccounts']);

    this.setState(prev => {
      if (isEqual(prev.newlyAddedAccounts, nextValue)) {
        return prev;
      }
      return {
        newlyAddedAccounts: nextValue,
      };
    });

    return accounts;
  };

  getIsNewlyAddedAccount = (account: KeyringAccount) => {
    const dbId = EntityAccountBase.buildDBId({
      address: account.address,
      type: account.type,
      brandName: account.brandName,
    });
    const newlyAddedAccount = this.getState().newlyAddedAccounts[dbId] ?? null;

    return {
      newlyAddedAccount,
      isNewlyAdded:
        !!newlyAddedAccount &&
        Date.now() - newlyAddedAccount.updated_at <=
          NEWLY_ADDED_ACCOUNT_DURATION,
    };
  };

  togglePinAddressAsync = async (payload: {
    brandName: Account['brandName'];
    address: Account['address'];
    nextPinned?: boolean;
  }) => {
    const allPinAddresses = await this.ensurePinnedAddressesHydrated();
    const { nextPinned, nextAddresses } = updatePinnedAddressList(
      allPinAddresses,
      payload,
    );

    if (nextPinned) {
      await updatePinnedAddresses(nextAddresses);
      matomoRequestEvent({
        category: 'Pin Address',
        action: 'PinAddress_Finish',
      });
    } else {
      await updatePinnedAddresses(nextAddresses);
    }

    this.setPinnedAddresses(nextAddresses);
    return nextAddresses;
  };

  removeAccount = async (account: KeyringAccountWithAlias) => {
    const accounts = await getAllAccounts();

    await this.togglePinAddressAsync({ ...account, nextPinned: false });
    await removeAddress(account);
    invalidateFetchAllAccountsCache();
    await this.fetchAccounts({ force: true });

    if (
      accounts.filter(acc => isSameAddress(acc.address, account.address))
        .length === 1
    ) {
      await deleteDBResourceForAddress(account.address);
      updateHistoryTimeSingleAddress(account.address, 0);
      await transactionHistoryServiceApi.clearSuccessAndFailList(
        account.address,
      );
    }
  };

  startLifecycle = () => {
    if (this.hasStartedLifecycle) {
      return;
    }
    this.hasStartedLifecycle = true;

    perfEvents.subscribe('POST_UNLOCK_UI_READY', () => {
      this.scheduleFetchAccountsAfterHomePostStartupReady(
        'post_unlock_ui_ready',
      );
    });

    void bindKeyringEvent('newAccount', () => {
      invalidateFetchAllAccountsCache();
      this.fetchAccounts({ force: true });
    }).catch(console.error);

    void bindKeyringEvent('removedAccount', async account => {
      const removedAccount = account as KeyringAccountWithAlias;
      invalidateFetchAllAccountsCache();
      await this.fetchAccounts({ force: true });
      accountEvents.emit('ACCOUNT_REMOVED', {
        removedAccounts: [removedAccount],
      });
      // Clean up backup reminder from preferenceService using basePublicKey
      // so all addresses from the same seed phrase are cleared together
      if (removedAccount.type === KEYRING_TYPE.HdKeyring) {
        try {
          const info = await apiMnemonic.getMnemonicAddressInfo(
            removedAccount.address,
          );
          if (info?.basePublicKey) {
            await clearNeedsBackupReminder(info.basePublicKey);
          }
        } catch {
          // Silently ignore errors
        }
      }

      await AccountInfoEntity.deleteByAccount(removedAccount);
      await this.fetchNewlyAddedAccounts();
    }).catch(console.error);

    void bindKeyringStore(state => {
      if (state.booted && state.vault) {
        this.scheduleFetchAccountsAfterHomePostStartupReady(
          'keyring_store_ready',
        );
      }
    }).catch(console.error);

    accountEvents.on(
      'ACCOUNT_ADDED',
      async ({ accounts, needsBackupReminder }) => {
        invalidateFetchAllAccountsCache();
        // Store backup reminder in preferenceService (MMKV) for reliable persistence
        // Use basePublicKey as the key so all addresses from the same seed phrase
        // share the same backup reminder state
        if (needsBackupReminder) {
          for (const account of accounts) {
            // Only HD keyring accounts have seed phrases
            if (account.type === KEYRING_TYPE.HdKeyring) {
              try {
                const info = await apiMnemonic.getMnemonicAddressInfo(
                  account.address,
                );
                if (info?.basePublicKey) {
                  await setNeedsBackupReminder(info.basePublicKey, true);
                }
              } catch {
                // Silently ignore errors - account might not be from mnemonic
              }
            }
          }
        }
        checkAddedAccountsGasAccountIfNeeded(accounts).catch(error => {
          console.error('checkAddedAccountsGasAccountIfNeeded error', error);
        });
        await AccountInfoEntity.recordNewAccount(accounts);
        await this.fetchNewlyAddedAccounts();
      },
    );

    ormEvents.on('account_info:removed', () => {
      this.fetchNewlyAddedAccounts();
    });

    eventBus.on(EVENT_SWITCH_ACCOUNT, account => {
      this.setCurrentAccount(account);
    });

    this.fetchNewlyAddedAccounts();

    setInterval(() => {
      InteractionManager.runAfterInteractions(() => {
        this.fetchNewlyAddedAccounts();
      });
    }, 10 * 1e3);

    setInterval(() => {
      InteractionManager.runAfterInteractions(() => {
        AccountInfoEntity.trimExpiredAccounts(NEWLY_ADDED_ACCOUNT_DURATION);
      });
    }, 60 * 1e3);
  };
}

export const accountStore = new AccountStore();

export const useAccountStore = accountStore.useStore;

export default accountStore;
