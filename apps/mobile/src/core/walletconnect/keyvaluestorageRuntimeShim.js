class KeyValueStorage {
  constructor() {
    throw new Error(
      'WalletConnect default KeyValueStorage is disabled in Rabby Mobile. Pass walletConnectStorage to Core instead.',
    );
  }
}

class IKeyValueStorage {}

module.exports = KeyValueStorage;
module.exports.default = KeyValueStorage;
module.exports.KeyValueStorage = KeyValueStorage;
module.exports.IKeyValueStorage = IKeyValueStorage;
