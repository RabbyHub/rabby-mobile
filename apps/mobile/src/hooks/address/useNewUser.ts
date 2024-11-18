import { useCallback, useMemo } from 'react';

import { atom, useAtom } from 'jotai';

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

  const { seedPharseData, privateKeyData } = useMemo(() => {
    return {
      seedPharseData:
        createAddressProc.type === ProcDataType.Seed
          ? createAddressProc.typedData
          : null,
      privateKeyData:
        createAddressProc.type === ProcDataType.PrivateKey
          ? createAddressProc.typedData
          : null,
    };
  }, [createAddressProc.type, createAddressProc.typedData]);

  return {
    seedPharseData,
    storeSeedPharse,

    privateKeyData,
    startCreateAddressProc,
    storePassword,
    resetCreateAddressProc,
  };
}

type ImportAdressProcess = {
  type: ProcDataType;
  typedData: string;
  addressList: {
    address: string;
    aliasName: string;
  }[];

  passwordForm: {
    password: string;
    confirmPassword: string;
    enableBiometrics?: boolean;
  };
};

function getDefaultImportAddressProc(): ImportAdressProcess {
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
const importAddressAtom = atom<ImportAdressProcess>(
  getDefaultImportAddressProc(),
);

export function useImportAddressProc() {
  const [importAddressProc, setImportAddressProc] = useAtom(importAddressAtom);

  const startImportAddressProc = useCallback(
    (
      type: ImportAdressProcess['type'],
      data: ImportAdressProcess['typedData'] = '',
    ) => {
      setImportAddressProc(prev => ({
        ...prev,
        type,
        typedData: data,
      }));
    },
    [setImportAddressProc],
  );

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

  const storeSeedPharse = useCallback(
    (seedPharse: string) => {
      setImportAddressProc(prev => ({
        ...prev,
        typedData: seedPharse,
      }));
    },
    [setImportAddressProc],
  );
  const storePrivateKey = useCallback(
    (privateKey: string) => {
      setImportAddressProc(prev => ({
        ...prev,
        typedData: privateKey,
      }));
    },
    [setImportAddressProc],
  );

  const { seedPharseData, privateKeyData } = useMemo(() => {
    return {
      seedPharseData:
        importAddressProc.type === ProcDataType.Seed
          ? importAddressProc.typedData
          : null,
      privateKeyData:
        importAddressProc.type === ProcDataType.PrivateKey
          ? importAddressProc.typedData
          : null,
    };
  }, [importAddressProc.type, importAddressProc.typedData]);

  return {
    seedPharseData,
    storeSeedPharse,

    privateKeyData,
    storePrivateKey,
    startImportAddressProc,
    storePassword,
    resetImportAddressProc,
  };
}
