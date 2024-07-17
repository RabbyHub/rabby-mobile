import * as sinon from 'sinon';
import * as browserPassword from './browser-password';

const password = '11111111';

const DefaultDerivationOptions = {
  algorithm: 'PBKDF2',
  params: {
    iterations: 5_000,
  },
} as const;

// function Uint8ArrayToHex(u8a: Uint8Array) {
//   return Array.from(u8a).reduce((acc, cur) => acc + ('00' + cur.toString(16)).slice(-2), '');
// }

describe('KeyringService setup', () => {
  beforeAll(() => {
  });

  afterEach(() => {
    sinon.restore();
  });

  it('keyArrayFromPassword', async () => {
    const saltBase64 = 'MzkzOTRmZTY0Yjc3OTZkYjI0NWFjYmNjNWY3YTEzZDk=';
    const keyArr = await browserPassword.keyArrayFromPassword(password, saltBase64);
    expect(Buffer.from(keyArr).toString('hex')).toBe('a0593f4ae01906cf94de54981b92b081d1e8fe598ae9ab913b25c1ea652f06e6');
  });

  ;[
    {
      salt: 'MzkzOTRmZTY0Yjc3OTZkYjI0NWFjYmNjNWY3YTEzZDk=',
      ivHex: '7fe5d93e743135680d99e8badac9380d',
      ivBase64: Buffer.from('7fe5d93e743135680d99e8badac9380d', 'hex').toString('base64'),
      data: 'true',
      dataEncrypted: 'fZv0D3MEfihTKVWz/LA42g==',
      encyrptedData: '{\"data\":\"fZv0D3MEfihTKVWz/LA42g==\",\"iv\":\"f+XZPnQxNWgNmei62sk4DQ==\",\"keyMetadata\":{\"algorithm\":\"PBKDF2\",\"params\":{\"iterations\":5000},\"ivFormat\":\"base64\"},\"salt\":\"MzkzOTRmZTY0Yjc3OTZkYjI0NWFjYmNjNWY3YTEzZDk=\"}',
      derivationOptions: {
        ivFormat: 'base64' as const,
      }
    },
    {
      salt: 'MzkzOTRmZTY0Yjc3OTZkYjI0NWFjYmNjNWY3YTEzZDk=',
      ivHex: '7fe5d93e743135680d99e8badac9380d',
      ivBase64: Buffer.from('7fe5d93e743135680d99e8badac9380d', 'hex').toString('base64'),
      data: 'true',
      dataEncrypted: 'fZv0D3MEfihTKVWz/LA42g==',
      encyrptedData: '{\"data\":\"fZv0D3MEfihTKVWz/LA42g==\",\"iv\":\"7fe5d93e743135680d99e8badac9380d\",\"keyMetadata\":{\"algorithm\":\"PBKDF2\",\"params\":{\"iterations\":5000}},\"salt\":\"MzkzOTRmZTY0Yjc3OTZkYjI0NWFjYmNjNWY3YTEzZDk=\"}',
    },
    {
      salt: 'NjJjYzhiYmU5YWU0MDUyNTJhMTYyYzRiZTgzNTk3NTI=',
      ivHex: '572371add4aa793ec7b6ffea843a3d6d',
      ivBase64: Buffer.from('572371add4aa793ec7b6ffea843a3d6d', 'hex').toString('base64'),
      data: [
        {
          "type": "Watch Address",
          "data": {
            "accounts": [
              "0x10B26700B0a2d3F5eF12fA250aba818eE3b43bf4"
            ]
          }
        },
        {
          "type": "WalletConnect",
          "data": {
            "accounts": []
          }
        },
        {
          "type": "Ledger Hardware",
          "data": {
            "hdPath": "m/44'/60'/0'",
            "accounts": [],
            "accountDetails": {},
            "hasHIDPermission": null,
            "usedHDPathTypeList": {}
          }
        },
        {
          "type": "Onekey Hardware",
          "data": {
            "hdPath": "m/44'/60'/0'/0",
            "accounts": [],
            "page": 0,
            "paths": {},
            "perPage": 5,
            "unlockedAccount": 0,
            "accountDetails": {}
          }
        }
      ],
      dataEncrypted: 'C3uCi4Ih4/GJ94wCJP2hDDadVlSh5XCkT15FHf/Z5ADPN4PyLrMU1posqzhdsk6bgFSNfoMX77ybgR/t2t0Q/hj5+s2+mWLT2GKdw+BEY21f7JTgeDyjsI/Zu8k48yWjJ5VGFHcDSapSTUQisrgEQfZiPtuJyhPCnTtQsbzbf1DNsxhMRaPxFSbjkD/3Yb9E8AlV60yEPrVNnn+I/qyfhioS8Gpp6R2KN4DknruXos0Q51qJ5LpROPkl4IQbqqFKx7RO12jAl6apIn/+9wsHc55vO2K2YtmC/MyaJX0bhxvOcTV7bJCESC2SrFHb7RwqFbPNVuOej1qJY0fL2o75K28nWHeXIuDuTb2w//TjrQVj2gh5oOpI7ubzWcQ867XAsxyJkThXHILCqF20P49jnL1ZBLQasL2YCN3rBRmwMB4RzKJ7qYXBoQtxXLTHC4AQVplH50mu69YCUAgTAV2ggNa5xeciEu2FFx8VcSJmWNUJXwACRb/Gx/gwUQCfCHEiKuhgtSNxO9OGHBnebpSx/IDMVIRYJ2QxaeJgG9VQo6rUiPag6KLXe4BwGrIjb1G7',
      encyrptedData: '{\"data\":\"C3uCi4Ih4/GJ94wCJP2hDDadVlSh5XCkT15FHf/Z5ADPN4PyLrMU1posqzhdsk6bgFSNfoMX77ybgR/t2t0Q/hj5+s2+mWLT2GKdw+BEY21f7JTgeDyjsI/Zu8k48yWjJ5VGFHcDSapSTUQisrgEQfZiPtuJyhPCnTtQsbzbf1DNsxhMRaPxFSbjkD/3Yb9E8AlV60yEPrVNnn+I/qyfhioS8Gpp6R2KN4DknruXos0Q51qJ5LpROPkl4IQbqqFKx7RO12jAl6apIn/+9wsHc55vO2K2YtmC/MyaJX0bhxvOcTV7bJCESC2SrFHb7RwqFbPNVuOej1qJY0fL2o75K28nWHeXIuDuTb2w//TjrQVj2gh5oOpI7ubzWcQ867XAsxyJkThXHILCqF20P49jnL1ZBLQasL2YCN3rBRmwMB4RzKJ7qYXBoQtxXLTHC4AQVplH50mu69YCUAgTAV2ggNa5xeciEu2FFx8VcSJmWNUJXwACRb/Gx/gwUQCfCHEiKuhgtSNxO9OGHBnebpSx/IDMVIRYJ2QxaeJgG9VQo6rUiPag6KLXe4BwGrIjb1G7\",\"iv\":\"572371add4aa793ec7b6ffea843a3d6d\",\"keyMetadata\":{\"algorithm\":\"PBKDF2\",\"params\":{\"iterations\":5000}},\"salt\":\"NjJjYzhiYmU5YWU0MDUyNTJhMTYyYzRiZTgzNTk3NTI=\"}',
    }
  ].forEach(({ salt: saltBase64, data, dataEncrypted, ivHex, ivBase64, encyrptedData, derivationOptions: options }, idx) => {
    const keyDerivationOptions = { ...DefaultDerivationOptions, ...options };
    describe(`#${idx + 1}`, () => {
      describe('encrypt/decrypt', () => {
        it('encryptWithKey', async () => {
          const key = await browserPassword.keyFromPassword(password, saltBase64, false, keyDerivationOptions);

          const vector = Uint8Array.from(Buffer.from(ivHex, 'hex'));
          const encrypted = await browserPassword.encryptWithKey(key, data, { vector, keyDerivationOptions });

          expect(encrypted).toStrictEqual({
            data: dataEncrypted,
            iv: keyDerivationOptions.ivFormat === 'base64' ? ivBase64 : ivHex,
            keyMetadata: keyDerivationOptions
          });
        });

        it('encrypt', async () => {
          const key = await browserPassword.keyFromPassword(password, saltBase64, false, keyDerivationOptions);
          const vector = Uint8Array.from(Buffer.from(ivBase64, 'base64'));
          const encrypted = await browserPassword.encrypt(password, data, {
            key,
            salt: saltBase64,
            vector,
            keyDerivationOptions: keyDerivationOptions
          });

          expect(encrypted).not.toBe(dataEncrypted);
          expect(encrypted).toBe(encyrptedData);
        });

        it('decryptWithKey', async () => {
          const key = await browserPassword.keyFromPassword(password, saltBase64, false, keyDerivationOptions);

          expect(await browserPassword.decryptWithKey(key, {
            data: dataEncrypted,
            iv: ivBase64,
            salt: saltBase64,
            keyMetadata: { ...keyDerivationOptions, ivFormat: 'base64' },
          })).toStrictEqual(data);
        });

        it('decrypt', async () => {
          const encrypted = encyrptedData;
          expect(await browserPassword.decrypt(password, encrypted)).toStrictEqual(data);
        });
      });
    });
  });
});
