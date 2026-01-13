import { keyringService, preferenceService } from '../services/shared';

import { ethers } from 'ethers';
// import { preferenceService } from '../service';
// import { EthereumProvider } from './buildinProvider';
import { Chain } from '@/constant/chains';
import { findChain } from '@/utils/chain';
import Safe, { SafeMessage } from '@rabby-wallet/gnosis-sdk';
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
import { isEqual, sortBy, uniq, without } from 'lodash';
import { toChecksumAddress } from '@ethereumjs/util';
import { hashSafeMessage } from '@safe-global/protocol-kit/dist/src/utils/eip-712';
import PQueue from 'p-queue';
import {
  GNOSIS_SUPPORT_CHAINS,
  SafeTransactionItem,
} from '@rabby-wallet/gnosis-sdk/dist/api';

const gnosisPQueue = new PQueue({
  interval: 1000,
  intervalCap: 5,
  carryoverConcurrencyCount: false,
  concurrency: 2,
});

export const createSafeService = async ({
  address,
  networkId,
}: {
  address: string;
  networkId: string;
}) => {
  const account = preferenceService.getFallbackAccount();
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
  fetchGnosisChainList = (address: string, excludeChains?: string[]) => {
    if (!isAddress(address)) {
      return Promise.reject(new Error(t('background.error.invalidAddress')));
    }
    return Promise.all(
      without(GNOSIS_SUPPORT_CHAINS, ...(excludeChains || [])).map(
        async chainEnum => {
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
            // console.error(e);
            return null;
          }
        },
      ),
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
    preferenceService.initCurrentAccount();
  };
  syncAllGnosisNetworks = async () => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_TYPE.GnosisKeyring);
    if (!keyring) {
      return;
    }
    let isChanged = false;
    Object.entries(keyring.networkIdsMap).forEach(
      async ([address, networks]) => {
        const chainList = await this.fetchGnosisChainList(
          address,
          networks.map(id => findChain({ networkId: id })?.enum || ''),
        );
        const nextNetworks = uniq(
          (networks || []).concat(chainList.map(chain => chain.network)),
        );
        const isSame = isEqual(sortBy(networks), sortBy(nextNetworks));
        if (isSame) {
          return;
        }
        isChanged = true;
        keyring.setNetworkIds(address, nextNetworks);
      },
    );
    if (isChanged) {
      await keyringService.persistAllKeyrings();
    }
  };

  syncGnosisNetworks = async (address: string) => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_TYPE.GnosisKeyring);
    if (!keyring) {
      return;
    }
    const networks = keyring.networkIdsMap[address];
    const chainList = await this.fetchGnosisChainList(
      address,
      (networks || []).map(id => findChain({ networkId: id })?.enum || ''),
    );
    const nextNetworks = uniq(
      (networks || []).concat(chainList.map(chain => chain.network)),
    );
    const isSame = isEqual(sortBy(networks), sortBy(nextNetworks));
    if (isSame) {
      return;
    }
    keyring.setNetworkIds(address, nextNetworks);
    await keyringService.persistAllKeyrings();
  };
  getSafeVersion = async ({
    address,
    networkId,
  }: {
    address: string;
    networkId: string;
  }) => {
    const account = preferenceService.getFallbackAccount();
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
      const currentProvider = new EthereumProvider();
      currentProvider.currentAccount = account.address;
      currentProvider.currentAccountType = account.type;
      currentProvider.currentAccountBrand = account.brandName;
      currentProvider.chainId = networkId;
      await keyring.buildTransaction(
        safeAddress,
        tx,
        new ethers.providers.Web3Provider(currentProvider),
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
    const results = (
      await Promise.all(
        networks.map(async networkId => {
          return gnosisPQueue.add(async () => {
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
          });
        }),
      )
    ).filter(Boolean);

    const total = results.reduce((t, item) => {
      return t + (item ? item.txs.length : 0);
    }, 0);

    return {
      total,
      results: results as { networkId: string; txs: SafeTransactionItem[] }[],
    };
  };

  getGnosisAllPendingMessages = async (address: string) => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_TYPE.GnosisKeyring);
    if (!keyring) {
      throw new Error(t('background.error.notFoundGnosisKeyring'));
    }
    const networks = keyring.networkIdsMap[address.toLowerCase()];
    if (!networks || !networks.length) {
      return null;
    }
    const safeAddress = toChecksumAddress(address);
    const results = (
      await Promise.all(
        networks.map(async networkId => {
          return gnosisPQueue.add(async () => {
            try {
              const safe = await createSafeService({
                networkId: networkId,
                address: safeAddress,
              });
              const threshold = await safe.getThreshold();
              const { results } = await safe.apiKit.getMessages(safeAddress);
              return {
                networkId,
                messages: results.filter(
                  item => item.confirmations.length < threshold,
                ),
              };
            } catch (e) {
              console.error(e);
              return {
                networkId,
                messages: [],
              };
            }
          });
        }),
      )
    ).filter(Boolean);

    const total = results.reduce((t, item) => {
      return t + (item ? item.messages.length : 0);
    }, 0);

    return {
      total,
      results: results as { networkId: string; messages: SafeMessage[] }[],
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
      buildinProvider.currentProvider.chainId = keyring.safeInstance.network;
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
      buildinProvider.currentProvider.chainId = keyring.safeInstance.network;
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

  clearGnosisTransaction = async () => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_TYPE.GnosisKeyring);
    if (keyring.currentTransaction || keyring.safeInstance) {
      keyring.currentTransaction = null;
      keyring.safeInstance = null;
    }
  };

  buildGnosisMessage = async ({
    account,
    safeAddress,
    networkId,
    version,
    message,
  }: {
    safeAddress: string;
    account: Account;
    version: string;
    networkId: string;
    message: string | Record<string, any>;
  }) => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_CLASS.GNOSIS);
    if (keyring) {
      const currentProvider = new EthereumProvider();
      currentProvider.currentAccount = account.address;
      currentProvider.currentAccountType = account.type;
      currentProvider.currentAccountBrand = account.brandName;
      currentProvider.chainId = networkId;
      return keyring.buildMessage({
        address: safeAddress,
        provider: new ethers.providers.Web3Provider(currentProvider),
        version,
        networkId,
        message: message as any,
      });
    } else {
      throw new Error(t('background.error.notFoundGnosisKeyring'));
    }
  };

  // getGnosisSafeMessageInfo = async () => {
  //   const keyring: GnosisKeyring = await getKeyring(KEYRING_CLASS.GNOSIS);
  //   if (!keyring) {
  //     throw new Error(t('background.error.notFoundGnosisKeyring'));
  //   }
  //   return keyring.getMessageInfo();
  // };

  addGnosisMessage = async ({
    signerAddress,
    signature,
  }: {
    signerAddress: string;
    signature: string;
  }) => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_CLASS.GNOSIS);
    if (!keyring) throw new Error(t('background.error.notFoundGnosisKeyring'));
    return keyring.addMessage({
      signerAddress,
      signature,
    });
  };

  addGnosisMessageSignature = async ({
    signerAddress,
    signature,
  }: {
    signerAddress: string;
    signature: string;
  }) => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_CLASS.GNOSIS);
    if (!keyring) throw new Error(t('background.error.notFoundGnosisKeyring'));
    return keyring.addMessageSignature({
      signerAddress,
      signature,
    });
  };

  handleGnosisMessage = async ({
    signerAddress,
    signature,
  }: {
    signerAddress: string;
    signature: string;
  }) => {
    const sigs = await this.getGnosisMessageSignatures();
    if (sigs.length > 0) {
      await this.addGnosisMessageSignature({
        signature: signature,
        signerAddress: signerAddress,
      });
    } else {
      await this.addGnosisMessage({
        signature: signature,
        signerAddress: signerAddress,
      });
    }
  };

  addPureGnosisMessageSignature = async ({
    signerAddress,
    signature,
  }: {
    signerAddress: string;
    signature: string;
  }) => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_CLASS.GNOSIS);
    if (!keyring) throw new Error(t('background.error.notFoundGnosisKeyring'));
    return keyring.addPureMessageSignature({
      signerAddress,
      signature,
    });
  };

  getGnosisMessage = async ({
    chainId,
    messageHash,
  }: {
    chainId: number;
    messageHash: string;
  }) => {
    const apiKit = Safe.createSafeApiKit(String(chainId));
    return apiKit.getMessage(messageHash);
  };

  getGnosisMessageHash = async ({
    safeAddress,
    chainId,
    message,
  }: {
    safeAddress: string;
    chainId: number;
    message: string | Record<string, any>;
  }) => {
    const safe = await createSafeService({
      address: safeAddress,
      networkId: String(chainId),
    });
    return safe.getSafeMessageHash(hashSafeMessage(message as any));
  };

  getGnosisMessageSignatures = async () => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_CLASS.GNOSIS);
    if (keyring.currentSafeMessage) {
      const sigs = Array.from(keyring.currentSafeMessage.signatures.values());
      return sigs.map(sig => ({ data: sig.data, signer: sig.signer }));
    }
    return [];
  };

  validateGnosisMessage = async (
    {
      address,
      chainId,
      message,
    }: {
      address: string;
      chainId: number;
      message: string | Record<string, any>;
    },
    hash: string,
  ) => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_CLASS.GNOSIS);
    if (!keyring) {
      throw new Error(t('background.error.notFoundGnosisKeyring'));
    }

    if (
      !keyring.accounts.find(
        account => account.toLowerCase() === address.toLowerCase(),
      )
    ) {
      throw new Error('Can not find this address');
    }
    const checksumAddress = toChecksumAddress(address);

    const safe = await createSafeService({
      address: checksumAddress,
      networkId: String(chainId),
    });
    const currentSafeMessageHash = await safe.getSafeMessageHash(
      hashSafeMessage(message as any),
    );
    return currentSafeMessageHash === hash;
  };

  clearGnosisMessage = async () => {
    const keyring: GnosisKeyring = await getKeyring(KEYRING_CLASS.GNOSIS);
    if (keyring.currentSafeMessage || keyring.safeInstance) {
      keyring.currentSafeMessage = null;
      keyring.safeInstance = null;
    }
  };
}

export const apisSafe = new ApisSafe();
