// see https://github.com/i18next/i18next/issues/1671#issuecomment-1966150749
import 'intl-pluralrules';
import 'node-libs-react-native/globals';

import 'src/utils/date';

/**
 * @see https://github.com/paulmillr/noble-hashes?tab=readme-ov-file#usage
 *
 * > For React Native, you may need a polyfill for getRandomValues. A standalone file noble-hashes.js is also available.
 */
import 'react-native-get-random-values';
/**
 * @see https://www.npmjs.com/package/@walletconnect/react-native-compat?activeTab=code
 *
 * imported here to patch some issues from crypto-about library such as ether.js, no matter if we use walletconnect or not
 */
import '@walletconnect/react-native-compat';

import 'reflect-metadata';

import crypto from 'crypto';

import QuickCrypto from 'react-native-quick-crypto';

import { install } from 'react-native-quick-crypto';

install();

// polyfill crypto
global.crypto = {
  ...crypto,
  ...global.crypto,
  randomUUID: QuickCrypto.randomUUID,
  getRandomValues: QuickCrypto.getRandomValues,
};
