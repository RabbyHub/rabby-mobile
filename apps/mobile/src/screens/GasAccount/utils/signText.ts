import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';

export function assertGasAccountSignText(text: unknown, address: string) {
  const match =
    typeof text === 'string'
      ? /^Gas Account wants you to sign in with your \naddress:(0x[0-9a-fA-F]{40})\n/.exec(
          text,
        )
      : null;
  if (!match || !isSameAddress(match[1], address)) {
    throw new Error('Invalid Gas Account sign text');
  }
}
