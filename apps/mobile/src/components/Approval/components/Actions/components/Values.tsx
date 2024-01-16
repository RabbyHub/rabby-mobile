import React, { useMemo, ReactNode, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Image,
  TouchableOpacity,
  TextStyle,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useTranslation } from 'react-i18next';
import { Chain, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { toast } from '@/components/Toast';
import AddressMemo from './AddressMemo';
import UserListDrawer from './UserListDrawer';
import { CHAINS } from '@/constant/chains';
import { getTimeSpan } from '@/utils/time';
import { formatUsdValue, formatAmount } from '@/utils/number';
import LogoWithText from './LogoWithText';
import { ellipsis } from '@/utils/address';
import { addressUtils } from '@rabby-wallet/base-utils';
import { ellipsisTokenSymbol, getTokenSymbol } from '@/utils/token';
import IconEdit from '@/assets/icons/approval/editpen.svg';
import IconScam from '@/assets/icons/sign/tx/token-scam.svg';
import IconFake from '@/assets/icons/sign/tx/token-fake.svg';
import IconAddressCopy from '@/assets/icons/sign/icon-copy-2.svg';
import IconExternal from '@/assets/icons/sign/icon-share.svg';
import IconInteracted from '@/assets/icons/sign/tx/interacted.svg';
import IconNotInteracted from '@/assets/icons/sign/tx/not-interacted.svg';
import AccountAlias from './AccountAlias';
import {
  addContractWhitelist,
  removeAddressWhitelist,
  addAddressWhitelist,
  addContractBlacklist,
  addAddressBlacklist,
  removeContractBlacklist,
  removeAddressBlacklist,
  removeContractWhitelist,
} from '@/core/apis/securityEngine';
import { useWhitelist } from '@/hooks/whitelist';
import { keyringService } from '@/core/services';
import { useApprovalSecurityEngine } from '../../../hooks/useApprovalSecurityEngine';

const { isSameAddress } = addressUtils;

const Boolean = ({ value }: { value: boolean }) => {
  return <Text>{value ? 'Yes' : 'No'}</Text>;
};

const styles = StyleSheet.create({
  addressMarkWrapper: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    cursor: 'pointer',
  },
  iconEditAlias: {
    width: 13,
    height: 13,
  },
  tokenAmountWrapper: {
    overflow: 'hidden',
    flex: 1,
  },
});

const TokenAmount = ({ value }: { value: string | number }) => {
  return (
    <Text style={styles.tokenAmountWrapper} numberOfLines={1}>
      {formatAmount(value)}
    </Text>
  );
};

const Percentage = ({ value, style }: { value: number; style?: TextStyle }) => {
  return <Text style={style}>{(value * 100).toFixed(2)}%</Text>;
};

const USDValue = ({ value }: { value: number | string }) => {
  return <Text>{formatUsdValue(value)}</Text>;
};

const TimeSpan = ({
  value,
  to = Date.now(),
}: {
  value: number | null;
  to?: number;
}) => {
  const timeSpan = useMemo(() => {
    const from = value;
    if (!from) return '-';
    const { d, h, m } = getTimeSpan(Math.floor(to / 1000) - from);
    if (d > 0) {
      return `${d} day${d > 1 ? 's' : ''} ago`;
    }
    if (h > 0) {
      return `${h} hour${h > 1 ? 's' : ''} ago`;
    }
    if (m > 1) {
      return `${m} minutes ago`;
    }
    return '1 minute ago';
  }, [value, to]);
  return <Text>{timeSpan}</Text>;
};

const TimeSpanFuture = ({
  from = Math.floor(Date.now() / 1000),
  to,
}: {
  from?: number;
  to: number;
}) => {
  const timeSpan = useMemo(() => {
    if (!to) return '-';
    const { d, h, m } = getTimeSpan(to - from);
    if (d > 0) {
      return `${d} day${d > 1 ? 's' : ''}`;
    }
    if (h > 0) {
      return `${h} hour${h > 1 ? 's' : ''}`;
    }
    if (m > 1) {
      return `${m} minutes`;
    }
    return '1 minute';
  }, [from, to]);
  return <Text>{timeSpan}</Text>;
};

const AddressMark = ({
  onWhitelist,
  onBlacklist,
  address,
  chain,
  isContract = false,
  onChange,
}: {
  onWhitelist: boolean;
  onBlacklist: boolean;
  address: string;
  chain: Chain;
  isContract?: boolean;
  onChange(): void;
}) => {
  const chainId = chain.serverId;
  const { t } = useTranslation();
  const { init } = useApprovalSecurityEngine();
  const [visible, setVisible] = React.useState(false);
  const handleEditMark = () => {
    setVisible(true);
  };
  const handleChange = async (data: {
    onWhitelist: boolean;
    onBlacklist: boolean;
  }) => {
    if (data.onWhitelist && !onWhitelist) {
      if (isContract && chainId) {
        addContractWhitelist({
          address,
          chainId,
        });
      } else {
        addAddressWhitelist(address);
      }
      toast.success('Mark as "Trusted"');
    }
    if (data.onBlacklist && !onBlacklist) {
      if (isContract && chainId) {
        addContractBlacklist({
          address,
          chainId,
        });
      } else {
        addAddressBlacklist(address);
      }
      toast.success('Mark as "Blocked"');
    }
    if (
      !data.onBlacklist &&
      !data.onWhitelist &&
      (onBlacklist || onWhitelist)
    ) {
      if (isContract && chainId) {
        removeContractBlacklist({
          address,
          chainId,
        });
        removeContractWhitelist({
          address,
          chainId,
        });
      } else {
        removeAddressBlacklist(address);
        removeAddressWhitelist(address);
      }
      toast.success(t('page.signTx.markRemoved'));
    }
    init();
    onChange();
  };
  return (
    <View>
      <TouchableOpacity onPress={handleEditMark}>
        <View style={styles.addressMarkWrapper}>
          <Text className="mr-6">
            {onWhitelist && t('page.signTx.trusted')}
            {onBlacklist && t('page.signTx.blocked')}
            {!onBlacklist && !onWhitelist && t('page.signTx.noMark')}
          </Text>
          <IconEdit className="icon-edit-alias icon" />
        </View>
      </TouchableOpacity>
      <UserListDrawer
        address={address}
        chain={chain}
        onWhitelist={onWhitelist}
        onBlacklist={onBlacklist}
        onChange={handleChange}
        visible={visible}
        onClose={() => setVisible(false)}
      />
    </View>
  );
};

const Protocol = ({
  value,
  logoSize,
  textStyle,
}: {
  value?: { name: string; logo_url: string } | null;
  logoSize?: number;
  textStyle?: TextStyle;
}) => {
  return (
    <>
      {value ? (
        <LogoWithText
          logo={value.logo_url}
          text={value.name}
          logoRadius={logoSize}
          logoSize={logoSize}
          textStyle={textStyle}
        />
      ) : (
        <Text>-</Text>
      )}
    </>
  );
};

const TokenLabel = ({
  isScam,
  isFake,
}: {
  isScam: boolean;
  isFake: boolean;
}) => {
  return (
    <View className="flex gap-4 shrink-0 relative">
      {isFake && <IconFake className="w-12" />}
      {isScam && <IconScam className="w-14" />}
    </View>
  );
};

const Address = ({
  address,
  chain,
  iconWidth = '12px',
}: {
  address: string;
  chain?: Chain;
  iconWidth?: string;
}) => {
  const { t } = useTranslation();
  const handleClickContractId = () => {
    if (!chain) return;
    // openInTab(chain.scanLink.replace(/tx\/_s_/, `address/${address}`), false);
  };
  const handleCopyContractAddress = () => {
    Clipboard.setString(address);
    toast.success(t('global.copied'));
  };
  return (
    <View className="relative flex flex-row items-center">
      <Text
        className="mr-[6] text-r-neutral-title1 font-medium"
        style={{ fontSize: 15 }}>
        {ellipsis(address)}
      </Text>
      {chain && (
        <IconExternal
          onPress={handleClickContractId}
          width={iconWidth}
          height={iconWidth}
          style={{
            marginRight: 6,
          }}
        />
      )}
      <IconAddressCopy
        onPress={handleCopyContractAddress}
        width={iconWidth}
        height={iconWidth}
      />
    </View>
  );
};

const TextValue = ({ children }: { children: ReactNode }) => {
  return (
    <View className="overflow-hidden overflow-ellipsis whitespace-nowrap">
      {children}
    </View>
  );
};

const DisplayChain = ({
  chainServerId,
  textStyle,
}: {
  chainServerId: string;
  textStyle?: TextStyle;
}) => {
  const chain = useMemo(() => {
    return Object.values(CHAINS).find(item => item.serverId === chainServerId);
  }, [chainServerId]);
  if (!chain) return null;
  return (
    <View className="flex flex-row items-center">
      <Text style={textStyle}>on {chain.name} </Text>
      <Image
        source={{
          uri: chain.logo,
        }}
        className="ml-[4] w-[14] h-[14]"
      />
    </View>
  );
};

const Interacted = ({
  value,
  textStyle,
}: {
  value: boolean;
  textStyle?: TextStyle;
}) => {
  const { t } = useTranslation();
  return (
    <View className="flex flex-row items-center">
      {value ? (
        <>
          <IconInteracted
            style={{
              marginRight: 4,
              width: 14,
            }}
          />
          <Text style={textStyle}>{t('page.signTx.interacted')}</Text>
        </>
      ) : (
        <>
          <IconNotInteracted className="mr-[4] w-[14]" />
          <Text style={textStyle}>{t('page.signTx.neverInteracted')}</Text>
        </>
      )}
    </View>
  );
};

const Transacted = ({ value }: { value: boolean }) => {
  const { t } = useTranslation();
  return (
    <View className="flex flex-row items-center w-full">
      {value ? (
        <>
          <IconInteracted
            style={{
              marginRight: 6,
            }}
          />
          <Text>{t('page.signTx.transacted')}</Text>
        </>
      ) : (
        <>
          <IconNotInteracted
            style={{
              marginRight: 6,
            }}
          />
          <Text>{t('page.signTx.neverTransacted')}</Text>
        </>
      )}
    </View>
  );
};

const TokenSymbol = ({
  token,
  style,
}: {
  token: TokenItem;
  style?: TextStyle;
}) => {
  const handleClickTokenSymbol = () => {
    // TODO
    // dispatch.sign.openTokenDetailPopup(token);
  };
  return (
    <Text onPress={handleClickTokenSymbol} style={style}>
      {ellipsisTokenSymbol(getTokenSymbol(token))}
    </Text>
  );
};

const KnownAddress = ({
  address,
  textStyle,
}: {
  address: string;
  textStyle?: TextStyle;
}) => {
  const [hasAddress, setHasAddress] = useState(false);
  const [inWhitelist, setInWhitelist] = useState(false);
  const { whitelist } = useWhitelist();
  const { t } = useTranslation();

  const handleAddressChange = async (addr: string) => {
    const res = await keyringService.hasAddress(addr);
    setInWhitelist(!!whitelist.find(item => isSameAddress(item, addr)));
    setHasAddress(res);
  };

  useEffect(() => {
    handleAddressChange(address);
  }, [address]);

  if (!hasAddress) return null;

  return (
    <Text style={textStyle}>
      {inWhitelist
        ? t('page.connect.onYourWhitelist')
        : t('page.signTx.importedAddress')}
    </Text>
  );
};

export {
  Boolean,
  TokenAmount,
  Percentage,
  AddressMemo,
  AddressMark,
  USDValue,
  TimeSpan,
  TimeSpanFuture,
  Protocol,
  TokenLabel,
  Address,
  TextValue,
  DisplayChain,
  Interacted,
  Transacted,
  TokenSymbol,
  AccountAlias,
  KnownAddress,
};
