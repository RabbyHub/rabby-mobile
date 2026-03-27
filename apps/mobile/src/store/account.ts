import {
  accountEvents,
  fetchAllAccounts,
  KeyringAccountWithAlias,
} from '@/core/apis/account';
import { getAllAccounts, removeAddress } from '@/core/apis/address';
import { AccountInfoEntity } from '@/databases/entities/accountInfo';
import { EntityAccountBase } from '@/databases/entities/base';
import { ormEvents } from '@/databases/entities/_helpers';
import { deleteDBResourceForAddress } from '@/databases/sync/assets';
import { BaseStore } from './_base';
import { InteractionManager } from 'react-native';
import { isEqual } from 'lodash';
import { Account, IPinAddress } from '@/core/services/preference';
import {
  keyringService,
  preferenceService,
  transactionHistoryService,
} from '@/core/services';
import { perfEvents } from '@/core/utils/perf';
import { UpdaterOrPartials } from '@/core/utils/store';
import { EVENT_SWITCH_ACCOUNT, eventBus } from '@/utils/events';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KeyringAccount } from '@rabby-wallet/keyring-utils';
import { matomoRequestEvent } from '@/utils/analytics';
import { updateHistoryTimeSingleAddress } from '@/hooks/historyTokenDict';

export interface AccountStoreState {
  accounts: KeyringAccountWithAlias[];
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

  private readonly fetchAccountsInParallel =
    this.createAvoidParallelAsyncMethod(async () => {
      const accounts = await fetchAllAccounts();
      this.setAccounts(accounts);
      return accounts;
    });

  constructor() {
    super({
      accounts: [],
      pinnedAddresses: preferenceService.getPinAddresses(),
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

  fetchAccounts = async () => {
    return this.fetchAccountsInParallel();
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
    const allPinAddresses = preferenceService.getPinAddresses();
    const nextPinned =
      payload.nextPinned ??
      !allPinAddresses.some(
        item =>
          isSameAddress(item.address, payload.address) &&
          item.brandName === payload.brandName,
      );

    const nextAddresses = [...allPinAddresses];
    const newItem = {
      brandName: payload.brandName,
      address: payload.address,
    };

    if (nextPinned) {
      nextAddresses.unshift(newItem);
      preferenceService.updatePinAddresses(nextAddresses);
      matomoRequestEvent({
        category: 'Pin Address',
        action: 'PinAddress_Finish',
      });
    } else {
      const index = nextAddresses.findIndex(
        item =>
          item.brandName === payload.brandName &&
          isSameAddress(item.address, payload.address),
      );
      if (index > -1) {
        nextAddresses.splice(index, 1);
      }
      preferenceService.updatePinAddresses(nextAddresses);
    }

    this.setPinnedAddresses(nextAddresses);
    return nextAddresses;
  };

  removeAccount = async (account: KeyringAccountWithAlias) => {
    const accounts = await getAllAccounts();

    await this.togglePinAddressAsync({ ...account, nextPinned: false });
    await removeAddress(account);
    await this.fetchAccounts();

    if (
      accounts.filter(acc => isSameAddress(acc.address, account.address))
        .length === 1
    ) {
      await deleteDBResourceForAddress(account.address);
      updateHistoryTimeSingleAddress(account.address, 0);
      transactionHistoryService.clearSuccessAndFailList(account.address);
    }
  };

  startLifecycle = () => {
    if (this.hasStartedLifecycle) {
      return;
    }
    this.hasStartedLifecycle = true;

    perfEvents.subscribe('USER_MANUALLY_UNLOCK', () => {
      this.fetchAccounts();
    });

    keyringService.on('newAccount', () => {
      this.fetchAccounts();
    });

    keyringService.on('removedAccount', async account => {
      await this.fetchAccounts();
      accountEvents.emit('ACCOUNT_REMOVED', {
        removedAccounts: [account],
      });
      await AccountInfoEntity.deleteByAccount(account);
      await this.fetchNewlyAddedAccounts();
    });

    keyringService.store.subscribe(state => {
      if (state.booted && state.vault) {
        this.fetchAccounts();
      }
    });

    accountEvents.on('ACCOUNT_ADDED', async ({ accounts }) => {
      await AccountInfoEntity.recordNewAccount(accounts);
      await this.fetchNewlyAddedAccounts();
    });

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
