module.exports = {
  dependency: {
    platforms: {
      android: {
        packageImportPath:
          'import com.rabbywallet.keychain.RabbyKeychainPackage;',
        packageInstance: 'new RabbyKeychainPackage()',
      },
      ios: {},
    },
  },
};
