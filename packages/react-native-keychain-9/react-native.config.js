module.exports = {
  dependency: {
    platforms: {
      android: {
        packageImportPath:
          'import com.rabbywallet.keychain9.RabbyKeychainV9Package;',
        packageInstance: 'new RabbyKeychainV9Package()',
      },
      ios: {},
    },
  },
};
