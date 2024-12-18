import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  HARDWARE_KEYRING_TYPES,
  KEYRING_CLASS,
  KEYRING_TYPE,
} from '@rabby-wallet/keyring-utils';

import { WalletIcon } from '../WalletIcon/WalletIcon';
import { RootNames } from '@/constant/layout';
import {
  apiKeyring,
  apiKeystone,
  apiLedger,
  apiMnemonic,
  apiOneKey,
} from '@/core/apis';
import { useTheme2024 } from '@/hooks/theme';
import { replaceToFirst } from '@/utils/navigation';

import { toast } from '@/components2024/Toast';
import { settingAtom } from '@/components/HDSetting/MainContainer';
import { getAccountBalance } from '@/components/HDSetting/util';
import { ledgerErrorHandler, LEDGER_ERROR_CODES } from '@/hooks/ledger/error';
import { activeAndPersistAccountsByMnemonics } from '@/core/apis/mnemonic';

import { createGetStyles2024 } from '@/utils/styles';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { AccountListView, ViewAccount } from './AccountListView';
import SettingSVG from '@/assets2024/icons/common/setting-cc.svg';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { Button } from '../Button';

const { isSameAddress } = addressUtils;

export const MAX_ACCOUNT_COUNT = 50;
const MAX_STEP_COUNT = 10;

export interface Props {
  params: {
    type: KEYRING_TYPE;
    mnemonics?: string;
    passphrase?: string;
    keyringId?: number;
    account?: KeyringAccountWithAlias;
    brand: string;
  };
  onCancel: () => void;
}

export const ImportMoreAddress: React.FC<Props> = ({ params, onCancel }) => {
  const apiHD = React.useMemo(() => {
    switch (params.type) {
      case KEYRING_TYPE.LedgerKeyring:
        return apiLedger;
      case KEYRING_TYPE.OneKeyKeyring:
        return apiOneKey;
      case KEYRING_TYPE.KeystoneKeyring:
        return apiKeystone;
      default:
        return null;
    }
  }, [params]);
  const hdType = React.useMemo(() => {
    switch (params.type) {
      case KEYRING_TYPE.LedgerKeyring:
        return KEYRING_TYPE.LedgerKeyring;
      case KEYRING_TYPE.OneKeyKeyring:
        return KEYRING_TYPE.OneKeyKeyring;
      case KEYRING_TYPE.HdKeyring:
        return KEYRING_TYPE.HdKeyring;
      default:
        return HARDWARE_KEYRING_TYPES.Keystone.type;
    }
  }, [params.type]) as KEYRING_TYPE;
  const hdBrandName = React.useMemo(() => {
    switch (params.type) {
      case KEYRING_TYPE.LedgerKeyring:
        return KEYRING_CLASS.HARDWARE.LEDGER;
      case KEYRING_TYPE.OneKeyKeyring:
        return KEYRING_CLASS.HARDWARE.ONEKEY;
      case KEYRING_TYPE.HdKeyring:
        return KEYRING_CLASS.MNEMONIC;
      default:
        return HARDWARE_KEYRING_TYPES.Keystone.brandName;
    }
  }, [params.type]);
  const [accounts, setAccounts] = React.useState<ViewAccount[]>([]);
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [setting, setSetting] = useAtom(settingAtom);
  const stoppedRef = React.useRef(true);
  const exitRef = React.useRef(false);
  const startNumberRef = React.useRef((setting?.startNumber || 1) - 1);
  const [currentAccounts, setCurrentAccounts] = React.useState<ViewAccount[]>(
    [],
  );
  const { t } = useTranslation();
  const [selectedAccounts, setSelectedAccounts] = React.useState<ViewAccount[]>(
    [],
  );
  const [importing, setImporting] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const maxCountRef = React.useRef(MAX_ACCOUNT_COUNT);
  const stepCountRef = React.useRef(
    params.type === KEYRING_TYPE.HdKeyring ? MAX_STEP_COUNT : 1,
  );

  const mnemonicKeyringRef = React.useRef<
    ReturnType<typeof apiMnemonic.getKeyringByMnemonic> | undefined
  >(undefined);
  const getMnemonicKeyring = React.useCallback(() => {
    if (params.type === KEYRING_TYPE.HdKeyring && params.mnemonics) {
      if (!mnemonicKeyringRef.current) {
        mnemonicKeyringRef.current = apiMnemonic.getKeyringByMnemonic(
          params.mnemonics!,
          params.passphrase!,
        );
      }
      return mnemonicKeyringRef.current;
    }
    return undefined;
  }, [params.mnemonics, params.passphrase, params.type]);

  const loadAddress = React.useCallback(
    async (index: number) => {
      const res =
        params.type === KEYRING_TYPE.HdKeyring
          ? await getMnemonicKeyring()?.getAddresses(
              index,
              index + stepCountRef.current,
            )
          : (await apiHD?.getAddresses(index, index + stepCountRef.current)) ||
            [];

      if (res.length) {
        // avoid blocking the UI thread
        await new Promise(resolve => setTimeout(resolve, 1));
        const balances = await Promise.all(
          res.map(async a => {
            return {
              address: a.address,
              balance: await getAccountBalance(a.address),
            };
          }),
        );
        if (stoppedRef.current) {
          return;
        }
        setAccounts(prev => {
          return [
            ...prev,
            ...balances.map((b, idx) => {
              return {
                address: b.address,
                index: res[idx].index,
                balance: b.balance,
              };
            }),
          ];
        });
      }
    },
    [apiHD, getMnemonicKeyring, params.type],
  );

  const handleLoadAddress = React.useCallback(async () => {
    setLoading(true);
    stoppedRef.current = false;
    const start = startNumberRef.current;
    let i = start;
    try {
      maxCountRef.current =
        (await apiHD?.getMaxAccountLimit()) ?? MAX_ACCOUNT_COUNT;

      for (; i < start + maxCountRef.current; ) {
        if (stoppedRef.current) {
          break;
        }
        await loadAddress(i);
        i += stepCountRef.current;
      }
    } catch (err: any) {
      const errorCode = ledgerErrorHandler(err);
      let errMessage = err.message;
      if (errorCode === LEDGER_ERROR_CODES.LOCKED_OR_NO_ETH_APP) {
        errMessage = t('page.newAddress.ledger.error.lockedOrNoEthApp');
      } else if (errorCode === LEDGER_ERROR_CODES.UNKNOWN) {
        errMessage = t('page.newAddress.ledger.error.unknown');
      }
      if (errMessage) {
        toast.show(errMessage);
      }
    }
    stoppedRef.current = true;
    setLoading(false);
    if (exitRef.current) {
      return;
    }

    if (i !== start + maxCountRef.current) {
      handleLoadAddress();
    }
  }, [apiHD, loadAddress, t]);

  const handleSelectIndex = React.useCallback(
    async (address, index) => {
      setSelectedAccounts(prev => {
        if (prev.length >= maxCountRef.current) {
          toast.info(t('page.newAddress.seedPhrase.maxAccountCount'));
          return prev;
        }
        if (prev.some(a => isSameAddress(a.address, address))) {
          return prev.filter(a => !isSameAddress(a.address, address));
        }
        return [
          ...prev,
          {
            address,
            index,
          },
        ];
      });
    },
    [t],
  );

  React.useEffect(() => {
    startNumberRef.current = (setting?.startNumber || 1) - 1;
  }, [setting?.startNumber]);

  React.useEffect(() => {
    setAccounts([]);
    if (stoppedRef.current) {
      handleLoadAddress();
    } else {
      stoppedRef.current = true;
    }
  }, [handleLoadAddress, setting]);

  React.useEffect(() => {
    if (params.type === KEYRING_TYPE.HdKeyring) {
      const api = getMnemonicKeyring();
      api?.getAccounts().then(res => {
        if (res) {
          const _accounts = res.map((address, idx) => {
            return {
              address,
              index: api?.getInfoByAddress(address)?.index ?? idx,
            };
          });
          setCurrentAccounts(_accounts);
        }
      });
    } else {
      apiHD?.getCurrentAccounts().then(res => {
        if (res) {
          setCurrentAccounts(res);
        }
      });
    }
  }, [apiHD, getMnemonicKeyring, params.type]);

  React.useEffect(() => {
    return () => {
      exitRef.current = true;
      stoppedRef.current = true;
    };
  }, []);

  React.useEffect(() => {
    if (params.type === KEYRING_TYPE.HdKeyring) {
      setSetting({ hdPath: LedgerHDPathType.BIP44, startNumber: 1 });
    }
  }, [setSetting, params.type]);

  const importToastHiddenRef = React.useRef<() => void>(() => {});

  const handleConfirm = React.useCallback(async () => {
    setImporting(true);
    importToastHiddenRef.current = toast.show('Importing...', {
      duration: 100000,
    });

    if (params.type === KEYRING_TYPE.HdKeyring) {
      setTimeout(() => {
        activeAndPersistAccountsByMnemonics(
          params.mnemonics!,
          params.passphrase || '',
          selectedAccounts as any,
          true,
        )
          .then(() => {
            replaceToFirst(RootNames.StackAddress, {
              screen: RootNames.ImportSuccess2024,
              params: {
                type: hdType,
                brandName: hdBrandName,
                address: selectedAccounts.map(a => a.address),
              },
            });
          })
          .catch((err: any) => {
            console.error(err);
            toast.show(err.message);
          })
          .finally(() => {
            importToastHiddenRef.current?.();
            setImporting(false);
            onCancel();
          });
      });

      return;
    }

    try {
      for (const acc of selectedAccounts) {
        await apiHD?.importAddress(acc.index - 1);
      }

      replaceToFirst(RootNames.StackAddress, {
        screen: RootNames.ImportSuccess2024,
        params: {
          type: hdType,
          brandName: hdBrandName,
          address: selectedAccounts.map(a => a.address),
        },
      });
    } catch (err: any) {
      console.error(err);
      toast.show(err.message);
    } finally {
      onCancel();
      importToastHiddenRef.current?.();
    }
    setImporting(false);
  }, [
    params.type,
    params.mnemonics,
    params.passphrase,
    selectedAccounts,
    hdType,
    hdBrandName,
    onCancel,
    apiHD,
  ]);

  React.useEffect(() => {
    return () => {
      importToastHiddenRef.current?.();
    };
  }, []);

  const settingModalName = React.useMemo(() => {
    switch (params.type) {
      case KEYRING_TYPE.HdKeyring:
        return MODAL_NAMES.SETTING_HDKEYRING;
      case KEYRING_TYPE.LedgerKeyring:
        return MODAL_NAMES.SETTING_LEDGER;
      case KEYRING_TYPE.OneKeyKeyring:
        return MODAL_NAMES.SETTING_ONEKEY;
      case KEYRING_TYPE.KeystoneKeyring:
        return MODAL_NAMES.SETTING_KEYSTONE;
      default:
        return null;
    }
  }, [params.type]);

  const handleSetting = React.useCallback(() => {
    const id = createGlobalBottomSheetModal2024({
      name: settingModalName!,
      brand: params.brand,
      onDone: () => {
        removeGlobalBottomSheetModal2024(id);
      },
      ...(params.type
        ? {
            keyringId: params.keyringId,
            mnemonics: params.mnemonics,
            passphrase: params.passphrase,
          }
        : {}),
    });
  }, [
    params.brand,
    params.keyringId,
    params.mnemonics,
    params.passphrase,
    params.type,
    settingModalName,
  ]);

  return (
    <View style={styles.root}>
      <TouchableOpacity
        style={styles.settingButton}
        hitSlop={20}
        onPress={handleSetting}>
        <SettingSVG color={colors2024['neutral-secondary']} />
      </TouchableOpacity>
      <View style={styles.info}>
        {params.account ? (
          <>
            <WalletIcon
              type={params.type}
              width={91}
              height={91}
              borderRadius={25}
            />
            <Text style={styles.nameText}>{params.account.aliasName}</Text>
          </>
        ) : (
          <Text style={styles.title}>Import more address</Text>
        )}
        <View style={styles.loading}>
          <Text style={styles.loadingText}>
            {!accounts.length
              ? 'Generating addresses, please wait...'
              : 'Select addresses to add'}
          </Text>
        </View>
      </View>
      <AccountListView
        accounts={accounts}
        currentAccounts={currentAccounts}
        selectedAccounts={selectedAccounts}
        handleSelectIndex={handleSelectIndex}
        loading={loading}
      />
      {selectedAccounts.length ? (
        <View style={styles.footerButton}>
          <Button
            type="primary"
            title={t('global.confirm')}
            onPress={handleConfirm}
            disabled={importing || !selectedAccounts.length}
            loading={importing}
          />
        </View>
      ) : null}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    height: '100%',
    position: 'relative',
  },
  info: {
    padding: 20,
    alignItems: 'center',
  },
  nameText: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
    marginTop: 25,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
    marginTop: 5,
  },
  loading: {
    marginTop: 15,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 17,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    lineHeight: 22,
    color: colors2024['neutral-secondary'],
  },
  settingButton: {
    position: 'absolute',
    right: 24,
    top: 0,
    zIndex: 1,
  },
  footerButton: {
    position: 'absolute',
    bottom: 54,
    left: 0,
    right: 0,
    marginHorizontal: 24,
  },
}));
