import { assertGasAccountSignText } from './signText';

const address = '0xaBcDEF1234567890aBcDEF1234567890aBcDEF12';
const message = `Gas Account wants you to sign in with your \naddress:${address}\nnonce:123`;

test('accepts the Gas Account login message for the selected address', () => {
  expect(() =>
    assertGasAccountSignText(message, address.toLowerCase()),
  ).not.toThrow();
});

test.each([
  undefined,
  null,
  {},
  [message],
  'Sign this message to authorize a transfer',
  `0x${'11'.repeat(32)}`,
  `prefix${message}`,
  message.replace('Gas Account', 'Another service'),
  message.replace(address, `0x${'22'.repeat(20)}`),
  message.replace(`address:${address}\n`, `address:${address}extra\n`),
])('rejects unexpected login sign text: %p', text => {
  expect(() => assertGasAccountSignText(text, address)).toThrow(
    'Invalid Gas Account sign text',
  );
});
