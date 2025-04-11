// see https://github.com/i18next/i18next/issues/1671#issuecomment-1966150749
import 'intl-pluralrules';
import 'node-libs-react-native/globals';

import 'src/utils/date';

/**
 * @see https://www.npmjs.com/package/@walletconnect/react-native-compat?activeTab=code
 *
 * imported here to patch some issues from crypto-about library such as ether.js, no matter if we use walletconnect or not
 */
import '@walletconnect/react-native-compat';

import 'reflect-metadata';

import { install } from 'react-native-quick-crypto';

install();
