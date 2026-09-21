import type {
  AddrDescResponse,
  ContractInfo,
  TokenItem,
} from '@rabby-wallet/rabby-api/dist/types';

import type { Chain } from '@/constant/chains';
import type { Account } from '@/types/account';
import type { SignMessageHighlightToken } from './signMessageTokenizer';

type SignMessageProtocol = {
  id: string;
  name: string;
  logo_url: string;
};

export type SignMessageAddressData = {
  address: string;
  addressDesc: AddrDescResponse['desc'] | null;
  contractInfo: ContractInfo | null;
  alias?: string;
  isContract: boolean;
  isMalicious: boolean;
  protocol: SignMessageProtocol | null;
  token: TokenItem | null;
  hasInteraction: boolean;
  hasTransfer: boolean;
  onTransferWhitelist: boolean;
  hasReceiverPrivateKeyInWallet: boolean;
  hasReceiverMnemonicInWallet: boolean;
  localAccount: Account | null;
};

export type SignMessageAddressDataMap = Record<string, SignMessageAddressData>;

export type SignMessageAddressDataProvider = {
  getAlias(address: string): Promise<string | undefined>;
  getWhitelist(): Promise<string[]>;
  getAccountsByPriority(): Promise<Account[]>;
  getAddressSource(
    address: string,
  ): Promise<'private-key' | 'seed-phrase' | null>;
  getAddressDesc(address: string): Promise<AddrDescResponse['desc'] | null>;
  getContractInfo(
    address: string,
    chainServerId: string,
  ): Promise<ContractInfo | null>;
  hasInteraction(
    accountAddress: string,
    chainServerId: string,
    address: string,
  ): Promise<boolean>;
  hasTransfer(
    chainServerId: string,
    accountAddress: string,
    address: string,
  ): Promise<boolean>;
  getToken(
    accountAddress: string,
    chainServerId: string,
    address: string,
  ): Promise<TokenItem | null>;
};

// Signing payloads are untrusted; resolve every address without unbounded fan-out.
export const SIGN_MESSAGE_ADDRESS_ENRICHMENT_CONCURRENCY = 6;

export const getSignMessageAddressTagType = ({
  isMalicious,
  alias,
  token,
  protocol,
}: Pick<
  SignMessageAddressData,
  'isMalicious' | 'alias' | 'token' | 'protocol'
>): 'danger' | 'info' | null => {
  if (isMalicious) return 'danger';
  if (alias || token || protocol) return 'info';
  return null;
};

const getSignMessageAddresses = (tokens: SignMessageHighlightToken[]) => {
  const addresses = new Map<string, string>();
  tokens.forEach(token => {
    if (token.type !== 'address') return;
    const address = token.address || token.value;
    addresses.set(address.toLowerCase(), address);
  });
  return addresses;
};

export const getSignMessageAddressDataRequestKey = (
  tokens: SignMessageHighlightToken[],
  chainServerId?: string,
  accountAddress?: string,
) => {
  const addresses = Array.from(getSignMessageAddresses(tokens).keys()).sort();
  return addresses.length
    ? `${chainServerId || ''}:${
        accountAddress?.toLowerCase() || ''
      }:${addresses.join(',')}`
    : null;
};

export const isSignMessageAddressMalicious = ({
  addressDesc,
  contractInfo,
  isContract,
}: Pick<
  SignMessageAddressData,
  'addressDesc' | 'contractInfo' | 'isContract'
>) =>
  isContract
    ? !!contractInfo?.is_phishing
    : !!(addressDesc?.is_danger || addressDesc?.is_scam);

export const resolveSignMessageAddressData = async ({
  tokens,
  chain,
  accountAddress,
  provider,
  onAddressResolved,
}: {
  tokens: SignMessageHighlightToken[];
  chain: Chain;
  accountAddress: string;
  provider: SignMessageAddressDataProvider;
  onAddressResolved?: (key: string, data: SignMessageAddressData) => void;
}): Promise<SignMessageAddressDataMap> => {
  const addresses = getSignMessageAddresses(tokens);
  if (!addresses.size) return {};

  const whitelistRequest = provider.getWhitelist().catch(() => [] as string[]);
  const accountsRequest = provider
    .getAccountsByPriority()
    .catch(() => [] as Account[]);
  const resolveAddress = async ([key, address]: [string, string]) => {
    const [
      alias,
      addressDesc,
      contractInfo,
      accounts,
      addressSource,
      whitelist,
    ] = await Promise.all([
      provider.getAlias(address).catch(() => undefined),
      provider.getAddressDesc(address).catch(() => null),
      provider.getContractInfo(address, chain.serverId).catch(() => null),
      accountsRequest,
      provider.getAddressSource(address).catch(() => null),
      whitelistRequest,
    ]);
    const localAccount =
      accounts.find(account => account.address.toLowerCase() === key) || null;
    const isContract = !!(
      contractInfo || addressDesc?.contract?.[chain.serverId]
    );
    const [relationship, token] = await Promise.all([
      isContract
        ? provider
            .hasInteraction(accountAddress, chain.serverId, address)
            .catch(() => false)
        : provider
            .hasTransfer(chain.serverId, accountAddress, address)
            .catch(() => false),
      contractInfo?.is_token
        ? provider
            .getToken(accountAddress, chain.serverId, address)
            .catch(() => null)
        : Promise.resolve(null),
    ]);
    const protocol =
      contractInfo?.protocol || addressDesc?.protocol?.[chain.serverId] || null;

    return [
      key,
      {
        address,
        addressDesc,
        contractInfo,
        alias,
        isContract,
        isMalicious: isSignMessageAddressMalicious({
          addressDesc,
          contractInfo,
          isContract,
        }),
        protocol,
        token,
        hasInteraction: isContract ? relationship : false,
        hasTransfer: isContract ? false : relationship,
        onTransferWhitelist: whitelist.some(item => item.toLowerCase() === key),
        hasReceiverPrivateKeyInWallet: addressSource === 'private-key',
        hasReceiverMnemonicInWallet: addressSource === 'seed-phrase',
        localAccount,
      },
    ] as const;
  };

  const addressEntries = Array.from(addresses);
  const entries = new Array<Awaited<ReturnType<typeof resolveAddress>>>(
    addressEntries.length,
  );
  let nextIndex = 0;
  const resolveNext = async () => {
    while (nextIndex < addressEntries.length) {
      const index = nextIndex;
      nextIndex += 1;
      const entry = await resolveAddress(addressEntries[index]);
      entries[index] = entry;
      onAddressResolved?.(...entry);
    }
  };
  await Promise.all(
    Array.from(
      {
        length: Math.min(
          SIGN_MESSAGE_ADDRESS_ENRICHMENT_CONCURRENCY,
          addressEntries.length,
        ),
      },
      () => resolveNext(),
    ),
  );

  return Object.fromEntries(entries);
};

type SignMessageTextLine = {
  text: string;
  y: number;
  height: number;
};

export const getSignMessageAddressTagLayouts = (
  tokens: SignMessageHighlightToken[],
  taggedTokenIndexes: number[],
  lines: SignMessageTextLine[],
) => {
  const text = tokens.map(token => token.value).join('');
  let cursor = 0;
  const tokenStarts = tokens.map(token => {
    const start = cursor;
    cursor += token.value.length;
    return start;
  });

  cursor = 0;
  const lineStarts = lines.map(line => {
    const index = text.indexOf(line.text, cursor);
    const start = index < 0 ? cursor : index;
    cursor = start + line.text.length;
    return start;
  });
  const lineOffsets = new Map<number, number>();

  return taggedTokenIndexes.flatMap(index => {
    const tokenStart = tokenStarts[index];
    let lineIndex = -1;
    for (let i = 0; i < lineStarts.length; i += 1) {
      if (lineStarts[i] > tokenStart) break;
      lineIndex = i;
    }
    const line = lines[lineIndex];
    if (!line) return [];

    const lineOffset = lineOffsets.get(lineIndex) || 0;
    lineOffsets.set(lineIndex, lineOffset + 1);
    return [
      {
        index,
        right: -6 + lineOffset * 44,
        top: line.y,
      },
    ];
  });
};
