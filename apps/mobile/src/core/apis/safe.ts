import { keyringService, preferenceService } from '../services/shared';

import { ethers } from 'ethers';
// import { preferenceService } from '../service';
// import { EthereumProvider } from './buildinProvider';
import { GNOSIS_SUPPORT_CHAINS } from '@/constant';
import { Chain } from '@/constant/chains';
import { findChain } from '@/utils/chain';
import Safe from '@rabby-wallet/gnosis-sdk';
import { t } from 'i18next';
import { isAddress } from 'web3-utils';
import buildinProvider, { EthereumProvider } from './buildinProvider';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { getKeyring } from './keyring';
import {
  GnosisKeyring,
  TransactionBuiltEvent,
  TransactionConfirmedEvent,
} from '@rabby-wallet/eth-keyring-gnosis';
import { EVENTS, eventBus } from '@/utils/events';
import { Account } from '../services/preference';
import { uniq } from 'lodash';

export const createSafeService = async ({
  address,
  networkId,
}: {
  address: string;
  networkId: string;
}) => {
  const account = await preferenceService.getCurrentAccount();
  const currentProvider = new EthereumProvider();
  if (account) {
    currentProvider.currentAccount = account.address;
    currentProvider.currentAccountType = account.type;
    currentProvider.currentAccountBrand = account.brandName;
  }
  currentProvider.chainId = networkId;

  const provider = new ethers.providers.Web3Provider(currentProvider) as any;

  const version = await Safe.getSafeVersion({
    address,
    provider,
  });

  const safe = new Safe(address, version, provider, networkId);
  return safe;
};

class ApisSafe {
  fetchGnosisChainList = (address: string) => {
    if (!isAddress(address)) {
      return Promise.reject(new Error(t('background.error.invalidAddress')));
    }
    return Promise.all(
      GNOSIS_SUPPORT_CHAINS.map(async chainEnum => {
        const chain = findChain({ enum: chainEnum });
        try {
          const safe = await createSafeService({
            address,
            networkId: chain!.network,
          });
          const owners = await safe.getOwners();
          if (owners) {
            return chain;
          }
        } catch (e) {
          console.error(e);
          return null;
        }
      }),
    ).then(chains => chains.filter((chain): chain is Chain => !!chain));
  };
  importGnosisAddress = async (address: string, networkIds: string[]) => {
    let keyring, isNewKey;
    const keyringType = KEYRING_TYPE.GnosisKeyring;
    try {
      keyring = await getKeyring(keyringType);
    } catch {
      const GnosisKeyring = keyringService.getKeyringClassForType(keyringType);
      keyring = new GnosisKeyring({});
      isNewKey = true;
    }

    keyring.setAccountToAdd(address);
    keyring.setNetworkIds(address, networkIds);
    await keyringService.addNewAccount(keyring);
    if (isNewKey) {
      await keyringService.addKeyring(keyring);
    }
    (keyring as GnosisKeyring).on(TransactionBuiltEvent, data => {
      eventBus.emit(EVENTS.broadcastToUI, {
        method: TransactionBuiltEvent,
        params: data,
      });
      (keyring as GnosisKeyring).on(TransactionConfirmedEvent, data => {
        eventBus.emit(EVENTS.broadcastToUI, {
          method: TransactionConfirmedEvent,
          params: data,
        });
      });
    });
  };
  syncAllGnosisNetworks = async () => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_TYPE.GnosisKeyring);
    if (!keyring) {
      return;
    }
    Object.entries(keyring.networkIdsMap).forEach(
      async ([address, networks]) => {
        const chainList = await this.fetchGnosisChainList(address);
        keyring.setNetworkIds(
          address,
          uniq((networks || []).concat(chainList.map(chain => chain.network))),
        );
      },
    );
  };

  syncGnosisNetworks = async (address: string) => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_TYPE.GnosisKeyring);
    if (!keyring) {
      return;
    }
    const networks = keyring.networkIdsMap[address];
    const chainList = await this.fetchGnosisChainList(address);
    keyring.setNetworkIds(
      address,
      uniq((networks || []).concat(chainList.map(chain => chain.network))),
    );
  };
  getSafeVersion = async ({
    address,
    networkId,
  }: {
    address: string;
    networkId: string;
  }) => {
    const account = await preferenceService.getCurrentAccount();
    if (!account) {
      throw new Error(t('background.error.noCurrentAccount'));
    }
    const currentProvider = new EthereumProvider();
    currentProvider.currentAccount = account.address;
    currentProvider.currentAccountType = account.type;
    currentProvider.currentAccountBrand = account.brandName;
    currentProvider.chainId = networkId;

    return Safe.getSafeVersion({
      address,
      provider: new ethers.providers.Web3Provider(currentProvider) as any,
    });
  };

  getBasicSafeInfo = async ({
    address,
    networkId,
  }: {
    address: string;
    networkId: string;
  }) => {
    const safe = await createSafeService({ address, networkId });
    return safe.getBasicSafeInfo();
  };

  getGnosisNetworkIds = async (address: string) => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_TYPE.GnosisKeyring);
    const networkId = keyring.networkIdsMap[address.toLowerCase()];
    if (networkId === undefined) {
      throw new Error(`Address ${address} is not in keyring"`);
    }
    return networkId;
  };

  getGnosisTransactionHash = async () => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_TYPE.GnosisKeyring);
    if (keyring.currentTransaction) {
      return keyring.getTransactionHash();
    }
    return null;
  };

  getGnosisTransactionSignatures = async () => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_TYPE.GnosisKeyring);
    if (keyring.currentTransaction) {
      const sigs = Array.from(keyring.currentTransaction.signatures.values());
      return sigs.map(sig => ({ data: sig.data, signer: sig.signer }));
    }
    return [];
  };

  setGnosisTransactionHash = async (hash: string) => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_TYPE.GnosisKeyring);
    keyring.currentTransactionHash = hash;
  };

  buildGnosisTransaction = async (
    safeAddress: string,
    account: Account,
    tx,
    version: string,
    networkId: string,
  ) => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_TYPE.GnosisKeyring);
    if (keyring) {
      buildinProvider.currentProvider.currentAccount = account.address;
      buildinProvider.currentProvider.currentAccountType = account.type;
      buildinProvider.currentProvider.currentAccountBrand = account.brandName;
      buildinProvider.currentProvider.chainId = networkId;
      await keyring.buildTransaction(
        safeAddress,
        tx,
        new ethers.providers.Web3Provider(buildinProvider.currentProvider),
        version,
        networkId,
      );
    } else {
      throw new Error(t('background.error.notFoundGnosisKeyring'));
    }
  };

  validateGnosisTransaction = async (
    {
      account,
      tx,
      version,
      networkId,
    }: {
      account: Account;
      tx;
      version: string;
      networkId: string;
    },
    hash: string,
  ) => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_TYPE.GnosisKeyring);
    if (keyring) {
      buildinProvider.currentProvider.currentAccount = account.address;
      buildinProvider.currentProvider.currentAccountType = account.type;
      buildinProvider.currentProvider.currentAccountBrand = account.brandName;
      buildinProvider.currentProvider.chainId = networkId;
      return keyring.validateTransaction(
        {
          address: account.address,
          transaction: tx,
          provider: new ethers.providers.Web3Provider(
            buildinProvider.currentProvider,
          ),
          version,
          networkId,
        },
        hash,
      );
    } else {
      throw new Error(t('background.error.notFoundGnosisKeyring'));
    }
  };

  postGnosisTransaction = async () => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_TYPE.GnosisKeyring);
    if (!keyring || !keyring.currentTransaction) {
      throw new Error(t('background.error.notFoundTxGnosisKeyring'));
    }
    return keyring.postTransaction();
  };

  getGnosisAllPendingTxs = async (address: string) => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_TYPE.GnosisKeyring);
    if (!keyring) {
      throw new Error(t('background.error.notFoundGnosisKeyring'));
    }
    const networks = keyring.networkIdsMap[address];
    if (!networks || !networks.length) {
      return null;
    }
    const results = await Promise.all(
      networks.map(async networkId => {
        try {
          const safe = await createSafeService({
            networkId: networkId,
            address,
          });
          const { results } = await safe.getPendingTransactions();
          return {
            networkId,
            txs: results,
          };
        } catch (e) {
          console.error(e);
          return {
            networkId,
            txs: [],
          };
        }
      }),
    );

    const total = results.reduce((t, item) => {
      return t + item.txs.length;
    }, 0);

    return {
      total,
      results,
    };
  };

  getGnosisPendingTxs = async (address: string, networkId: string) => {
    if (!networkId) {
      return [];
    }
    const safe = await createSafeService({
      networkId: networkId,
      address,
    });
    const { results } = await safe.getPendingTransactions();
    return results;
  };

  getGnosisOwners = async (
    account: Account,
    safeAddress: string,
    version: string,
    networkId: string,
  ) => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_TYPE.GnosisKeyring);
    if (!keyring) {
      throw new Error(t('background.error.notFoundGnosisKeyring'));
    }
    const currentProvider = new EthereumProvider();
    currentProvider.currentAccount = account.address;
    currentProvider.currentAccountType = account.type;
    currentProvider.currentAccountBrand = account.brandName;
    currentProvider.chainId = networkId;

    const owners = await keyring.getOwners(
      safeAddress,
      version,
      new ethers.providers.Web3Provider(currentProvider),
      networkId,
    );
    return owners;
  };

  signGnosisTransaction = async (account: Account) => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_TYPE.GnosisKeyring);
    if (keyring.currentTransaction && keyring.safeInstance) {
      buildinProvider.currentProvider.currentAccount = account.address;
      buildinProvider.currentProvider.currentAccountType = account.type;
      buildinProvider.currentProvider.currentAccountBrand = account.brandName;
      return keyring.confirmTransaction({
        safeAddress: keyring.safeInstance.safeAddress,
        transaction: keyring.currentTransaction,
        networkId: keyring.safeInstance.network,
        provider: new ethers.providers.Web3Provider(
          buildinProvider.currentProvider,
        ),
      });
    }
  };

  checkGnosisTransactionCanExec = async () => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_TYPE.GnosisKeyring);
    if (keyring.currentTransaction && keyring.safeInstance) {
      const threshold = await keyring.safeInstance.getThreshold();
      return keyring.currentTransaction.signatures.size >= threshold;
    }
    return false;
  };

  execGnosisTransaction = async (account: Account) => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_TYPE.GnosisKeyring);
    if (keyring.currentTransaction && keyring.safeInstance) {
      buildinProvider.currentProvider.currentAccount = account.address;
      buildinProvider.currentProvider.currentAccountType = account.type;
      buildinProvider.currentProvider.currentAccountBrand = account.brandName;
      await keyring.execTransaction({
        safeAddress: keyring.safeInstance.safeAddress,
        transaction: keyring.currentTransaction,
        networkId: keyring.safeInstance.network,
        provider: new ethers.providers.Web3Provider(
          buildinProvider.currentProvider,
        ),
      });
    }
  };

  gnosisGenerateTypedData = async () => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_TYPE.GnosisKeyring);
    if (!keyring) {
      throw new Error(t('background.error.notFoundGnosisKeyring'));
    }
    if (!keyring.currentTransaction) {
      throw new Error(t('background.error.notFoundTxGnosisKeyring'));
    }
    return keyring.generateTypedData();
  };

  gnosisAddConfirmation = async (address: string, signature: string) => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_TYPE.GnosisKeyring);
    if (!keyring) {
      throw new Error(t('background.error.notFoundGnosisKeyring'));
    }
    if (!keyring.currentTransaction) {
      throw new Error(t('background.error.notFoundTxGnosisKeyring'));
    }
    await keyring.addConfirmation(address, signature);
  };

  gnosisAddPureSignature = async (address: string, signature: string) => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_TYPE.GnosisKeyring);
    if (!keyring) {
      throw new Error(t('background.error.notFoundGnosisKeyring'));
    }
    if (!keyring.currentTransaction) {
      throw new Error(t('background.error.notFoundTxGnosisKeyring'));
    }
    await keyring.addPureSignature(address, signature);
  };

  gnosisAddSignature = async (address: string, signature: string) => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_TYPE.GnosisKeyring);
    if (!keyring) {
      throw new Error(t('background.error.notFoundGnosisKeyring'));
    }
    if (!keyring.currentTransaction) {
      throw new Error(t('background.error.notFoundTxGnosisKeyring'));
    }
    await keyring.addSignature(address, signature);
  };
}

export const apisSafe = new ApisSafe();
