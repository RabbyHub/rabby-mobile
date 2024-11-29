import { useCallback, useMemo } from 'react';

import { atom, useAtom } from 'jotai';
import { useBiometrics } from '../biometrics';
import { apisLock } from '@/core/apis';
import { toast } from '@/components2024/Toast';

export const enum ProcDataType {
  Seed = 1,
  PrivateKey = 2,

  Hardware = 3,
}

type CreateAdressProcess = {
  type: ProcDataType;
  typedData: string;
  addressList: {
    address: string;
    aliasName: string;
    index?: number;
  }[];

  passwordForm: {
    password: string;
    confirmPassword: string;
    enableBiometrics?: boolean;
  };
};

function getDefaultCreateAddressProc(): CreateAdressProcess {
  return {
    type: ProcDataType.Seed,
    typedData: '',
    addressList: [],
    passwordForm: {
      password: '',
      confirmPassword: '',
      enableBiometrics: false,
    },
  };
}
const createAddressAtom = atom<CreateAdressProcess>(
  getDefaultCreateAddressProc(),
);

export function useCreateAddressProc() {
  const [createAddressProc, setCreateAddressProc] = useAtom(createAddressAtom);

  const startCreateAddressProc = useCallback(
    (
      type: CreateAdressProcess['type'],
      data: CreateAdressProcess['typedData'] = '',
    ) => {
      setCreateAddressProc(prev => ({
        ...prev,
        type,
        typedData: data,
      }));
    },
    [setCreateAddressProc],
  );

  const storePassword = useCallback(
    (passwordForm: CreateAdressProcess['passwordForm']) => {
      setCreateAddressProc(prev => ({
        ...prev,
        passwordForm: {
          ...prev.passwordForm,
          ...passwordForm,
        },
      }));
    },
    [setCreateAddressProc],
  );

  const storeAddressList = useCallback(
    (addressList: CreateAdressProcess['addressList']) => {
      setCreateAddressProc(prev => ({
        ...prev,
        addressList: addressList,
      }));
    },
    [setCreateAddressProc],
  );

  const resetCreateAddressProc = useCallback(() => {
    setCreateAddressProc(getDefaultCreateAddressProc());
  }, [setCreateAddressProc]);

  const storeSeedPharse = useCallback(
    (seedPharse: string) => {
      setCreateAddressProc(prev => ({
        ...prev,
        typedData: seedPharse,
      }));
    },
    [setCreateAddressProc],
  );

  const { toggleBiometrics } = useBiometrics();

  const confirmPassword = useCallback(async () => {
    const { password, enableBiometrics } = createAddressProc.passwordForm;
    const result = await apisLock.resetPasswordOnUI(password);
    if (result.error) {
      toast.show(result.error);
      return false;
    } else {
      try {
        await toggleBiometrics?.(Boolean(enableBiometrics), {
          validatedPassword: password,
        });
        return true;
      } catch (e) {
        console.log('toggleBiometrics error', e);
        toast.show('Enable biometrics fail');
      }
    }
  }, [createAddressProc.passwordForm, toggleBiometrics]);

  const { seedPharseData, privateKeyData, addressList } = useMemo(() => {
    return {
      addressList:
        createAddressProc.type === ProcDataType.Seed
          ? createAddressProc.addressList
          : null,
      seedPharseData:
        createAddressProc.type === ProcDataType.Seed
          ? createAddressProc.typedData
          : '',
      privateKeyData:
        createAddressProc.type === ProcDataType.PrivateKey
          ? createAddressProc.typedData
          : null,
    };
  }, [
    createAddressProc.type,
    createAddressProc.typedData,
    createAddressProc.addressList,
  ]);

  return {
    seedPharseData,
    storeSeedPharse,
    addressList,
    storeAddressList,
    privateKeyData,
    startCreateAddressProc,
    storePassword,
    resetCreateAddressProc,
    confirmPassword,
    isCorrectPassword: (password: string) => {
      return createAddressProc.passwordForm.password === password;
    },
  };
}

type AnyPromiseFn = () => Promise<any>;
type ImportAdressProcess = {
  confirmPasswordCB?: AnyPromiseFn;
  passwordForm: {
    password: string;
    confirmPassword: string;
    enableBiometrics?: boolean;
  };
};

function getDefaultImportAddressProc(): ImportAdressProcess {
  return {
    passwordForm: {
      password: '',
      confirmPassword: '',
      enableBiometrics: false,
    },
    confirmPasswordCB: () => Promise.resolve(undefined),
  };
}
const importAddressAtom = atom<ImportAdressProcess>(
  getDefaultImportAddressProc(),
);

export function useImportAddressProc() {
  const [importAddressProc, setImportAddressProc] = useAtom(importAddressAtom);

  const storePassword = useCallback(
    (passwordForm: ImportAdressProcess['passwordForm']) => {
      setImportAddressProc(prev => ({
        ...prev,
        passwordForm: {
          ...prev.passwordForm,
          ...passwordForm,
        },
      }));
    },
    [setImportAddressProc],
  );

  const resetImportAddressProc = useCallback(() => {
    setImportAddressProc(getDefaultImportAddressProc());
  }, [setImportAddressProc]);

  const setConfirmCB = (cb: AnyPromiseFn) => {
    setImportAddressProc(prev => ({
      ...prev,
      confirmPasswordCB: cb,
    }));
  };

  return {
    confirmCB: importAddressProc.confirmPasswordCB,
    setConfirmCB,
    storePassword,
    resetImportAddressProc,
  };
}
