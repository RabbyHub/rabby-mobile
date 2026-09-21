import sinon from 'sinon';

export const sinonEncryptor = {
  encrypt: sinon.stub().callsFake(function (_password, dataObj) {
    return dataObj;
  }),

  decrypt(_password: string, _text: string) {
    return _text;
  },

  decryptWithDetail(_password: string, _text: string) {
    return {
      vault: _text,
      exportedKeyString: 'mock-exported-key',
    };
  },

  decryptWithExportedKey(_text: string, _exportedKeyString: string) {
    return _text;
  },
};

export default sinonEncryptor;
