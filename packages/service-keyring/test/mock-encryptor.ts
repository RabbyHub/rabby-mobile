import sinon from 'sinon';

export const sinonEncryptor = {
  encrypt: sinon.stub().callsFake(function (_password, dataObj) {
    return dataObj;
  }),

  decrypt(_password: string, _text: string) {
    return _text;
  },
};

export default sinonEncryptor;
