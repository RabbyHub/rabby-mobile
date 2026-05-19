import sinon from 'sinon';

type MockEncryptedPayload = {
  __mockEncryptedPayload: true;
  password: string;
  data: unknown;
  exportedKeyString: string;
};

function isMockEncryptedPayload(value: unknown): value is MockEncryptedPayload {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as MockEncryptedPayload).__mockEncryptedPayload === true
  );
}

function assertPassword(password: string, payload: MockEncryptedPayload) {
  if (payload.password !== password) {
    throw new Error('Incorrect password');
  }
}

export const sinonEncryptor = {
  encrypt: sinon.stub().callsFake(function (password, dataObj) {
    return {
      __mockEncryptedPayload: true,
      password,
      data: dataObj,
      exportedKeyString: `mock-key:${password}`,
    };
  }),

  decrypt(password: string, text: unknown) {
    if (!isMockEncryptedPayload(text)) {
      return text;
    }

    assertPassword(password, text);
    return text.data;
  },

  decryptWithDetail(password: string, text: unknown) {
    if (!isMockEncryptedPayload(text)) {
      return {
        vault: text,
      };
    }

    assertPassword(password, text);
    return {
      vault: text.data,
      exportedKeyString: text.exportedKeyString,
    };
  },

  decryptWithExportedKey(text: unknown, exportedKeyString: string) {
    if (!isMockEncryptedPayload(text)) {
      return text;
    }

    if (text.exportedKeyString !== exportedKeyString) {
      throw new Error('Incorrect exported key');
    }

    return text.data;
  },
};

export default sinonEncryptor;
