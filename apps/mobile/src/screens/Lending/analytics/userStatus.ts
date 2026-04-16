import { keyToMarketKey } from '@/screens/Home/utils/protocolConfig';
import type { IProtocolItem } from '@/core/protocol/types';
import { matomoRequestEvent } from '@/utils/analytics';

type LendingUserStatusChainScope = 'SC' | 'MC';
type LendingUserStatusAddressScope = 'SA' | 'MA';

type ReportLendingUserStatusParams = {
  addresses: string[];
  protocolMap: Record<string, IProtocolItem[]>;
};

let hasReportedLendingUserStatus = false;

const normalizeAddresses = (addresses: string[]) =>
  Array.from(new Set(addresses.map(address => address.toLowerCase()))).sort();

const getAavePortfolioSignals = (
  protocolMap: Record<string, IProtocolItem[]>,
  addresses: string[],
): { marketCount: number; ownerCount: number } => {
  const addressSet = new Set(addresses);
  const marketSet = new Set<string>();
  const ownerSet = new Set<string>();

  Object.entries(protocolMap).forEach(([ownerAddr, protocols]) => {
    const normalizedOwner = ownerAddr.toLowerCase();
    if (!addressSet.has(normalizedOwner)) {
      return;
    }

    protocols.forEach(protocol => {
      const protocolOwner = (protocol.owner_addr || ownerAddr).toLowerCase();
      if (!addressSet.has(protocolOwner)) {
        return;
      }

      const protocolId = protocol.id?.toLowerCase();
      if (protocolId && keyToMarketKey[protocolId]) {
        marketSet.add(protocolId);
        ownerSet.add(protocolOwner);
      }
    });
  });

  return {
    marketCount: marketSet.size,
    ownerCount: ownerSet.size,
  };
};

const resolveLendingUserStatus = (
  ownerCount: number,
  chainCount: number,
): `${LendingUserStatusChainScope}_${LendingUserStatusAddressScope}` | null => {
  if (!ownerCount || !chainCount) {
    return null;
  }

  const chainScope: LendingUserStatusChainScope = chainCount > 1 ? 'MC' : 'SC';
  const addressScope: LendingUserStatusAddressScope =
    ownerCount > 1 ? 'MA' : 'SA';

  return `${chainScope}_${addressScope}`;
};

export function reportLendingUserStatusOnce({
  addresses,
  protocolMap,
}: ReportLendingUserStatusParams) {
  // 启动后只上报一次
  if (hasReportedLendingUserStatus) {
    return;
  }
  hasReportedLendingUserStatus = true;

  const normalizedAddresses = normalizeAddresses(addresses);
  if (!normalizedAddresses.length) {
    return;
  }

  const { marketCount, ownerCount } = getAavePortfolioSignals(
    protocolMap,
    normalizedAddresses,
  );
  const lendingUserStatus = resolveLendingUserStatus(ownerCount, marketCount);

  if (!lendingUserStatus) {
    return;
  }

  matomoRequestEvent({
    category: 'Rabby Lending',
    action: 'Lending_UserStatus',
    label: lendingUserStatus,
  });
}
