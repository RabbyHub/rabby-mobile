import React, {
  useMemo,
  ReactNode,
  useState,
  useEffect,
  useCallback,
} from 'react';
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
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { toast } from '@/components/Toast';
import AddressMemo from './AddressMemo';
import UserListDrawer from './UserListDrawer';
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
import useCommonStyle from '@/components/Approval/hooks/useCommonStyle';
import { useThemeColors } from '@/hooks/theme';
import { useTokenDetailSheetModalOnApprovals } from '@/components/TokenDetailPopup/hooks';
import IconArrowRight from '@/assets/icons/approval/edit-arrow-right.svg';
import { useFindChain } from '@/hooks/useFindChain';
import { Chain } from '@/constant/chains';

const { isSameAddress } = addressUtils;

const Boolean = ({ value, style }: { value: boolean; style?: TextStyle }) => {
  const commonStyle = useCommonStyle();

  return (
    <Text style={StyleSheet.flatten([commonStyle.subRowText, style])}>
      {value ? 'Yes' : 'No'}
    </Text>
  );
};

const styles = StyleSheet.create({
  addressMarkWrapper: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconEditAlias: {
    width: 13,
    height: 13,
  },
  tokenAmountWrapper: {
    flex: 0,
    flexShrink: 0,
  },
});

const TokenAmount = ({
  value,
  style,
}: {
  value: string | number;
  style?: TextStyle;
}) => {
  return (
    <Text
      style={{
        ...styles.tokenAmountWrapper,
        ...(style || {}),
      }}
      numberOfLines={1}
      ellipsizeMode="tail">
      {formatAmount(value)}
    </Text>
  );
};

const Percentage = ({ value, style }: { value: number; style?: TextStyle }) => {
  return <Text style={style}>{(value * 100).toFixed(2)}%</Text>;
};

const USDValue = ({
  value,
  style,
}: {
  value: number | string;
  style?: TextStyle;
}) => {
  return <Text style={style}>{formatUsdValue(value)}</Text>;
};

const TimeSpan = ({
  value,
  to = Date.now(),
  style,
}: {
  value: number | null;
  to?: number;
  style?: TextStyle;
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
  return <Text style={style}>{timeSpan}</Text>;
};

const TimeSpanFuture = ({
  from = Math.floor(Date.now() / 1000),
  to,
  style,
}: {
  from?: number;
  to: number;
  style?: TextStyle;
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
  return <Text style={style}>{timeSpan}</Text>;
};

const AddressMark = ({
  onWhitelist,
  onBlacklist,
  address,
  chain,
  isContract = false,
  textStyle,
  onChange,
}: {
  onWhitelist: boolean;
  onBlacklist: boolean;
  address: string;
  chain?: Chain;
  isContract?: boolean;
  textStyle?: TextStyle;
  onChange(): void;
}) => {
  const chainId = chain?.serverId;
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
          <Text style={{ marginRight: 6, ...textStyle }}>
            {onWhitelist && t('page.signTx.trusted')}
            {onBlacklist && t('page.signTx.blocked')}
            {!onBlacklist && !onWhitelist && t('page.signTx.noMark')}
          </Text>
          <IconEdit />
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
  const commonStyle = useCommonStyle();

  return (
    <View style={commonStyle.rowFlexCenterItem}>
      {isFake && (
        <IconFake
          style={{
            width: 12,
            marginLeft: 4,
          }}
        />
      )}
      {isScam && (
        <IconScam
          style={{
            width: 14,
            marginLeft: 4,
          }}
        />
      )}
    </View>
  );
};

const Address = ({
  address,
  chain,
  iconWidth = '12px',
  style,
}: {
  address: string;
  chain?: Chain;
  iconWidth?: string;
  style?: TextStyle;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <View
      style={StyleSheet.flatten({
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 0.5,
        borderColor: colors['neutral-line'],
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 900,
      })}>
      <Text
        style={StyleSheet.flatten({
          fontSize: 14,
          fontWeight: '500',
          color: colors['neutral-title1'],
          ...style,
        })}>
        {ellipsis(address)}
      </Text>
      <IconArrowRight />
    </View>
  );
};

const AddressWithCopy = ({
  address,
  chain,
  iconWidth = '12px',
  style,
  ref,
}: {
  address: string;
  chain?: Chain;
  iconWidth?: string;
  style?: TextStyle;
  ref?: any;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const handleClickContractId = () => {
    if (!chain) return;
    // openInTab(chain.scanLink.replace(/tx\/_s_/, `address/${address}`), false);
  };
  const handleCopyContractAddress = () => {
    Clipboard.setString(address);
    toast.success(t('global.copied'));
  };
  const widthNum = parseInt(iconWidth, 10);
  return (
    <View
      ref={ref}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
      }}>
      <Text
        style={{
          fontSize: 14,
          marginRight: 6,
          fontWeight: '500',
          color: colors['neutral-title1'],
          ...style,
        }}>
        {ellipsis(address)}
      </Text>
      <IconAddressCopy
        onPress={handleCopyContractAddress}
        width={widthNum}
        height={widthNum}
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
  const chain = useFindChain({
    serverId: chainServerId,
  });
  const commonStyle = useCommonStyle();
  if (!chain) return null;
  return (
    <View style={commonStyle.rowFlexCenterItem}>
      <Text style={textStyle}>on {chain.name} </Text>
      <Image
        source={{
          uri: chain.logo,
        }}
        style={{
          marginLeft: 4,
          width: 14,
          height: 14,
        }}
      />
    </View>
  );
};

const Interacted = ({ value }: { value: boolean }) => {
  const { t } = useTranslation();
  const commonStyle = useCommonStyle();
  return (
    <View style={commonStyle.rowFlexCenterItem}>
      {value ? (
        <Text style={commonStyle.subRowText}>{t('page.signTx.yes')}</Text>
      ) : (
        <Text style={commonStyle.subRowText}>{t('page.signTx.no')}</Text>
      )}
    </View>
  );
};

const Transacted = ({ value }: { value: boolean }) => {
  const { t } = useTranslation();
  const commonStyle = useCommonStyle();
  return (
    <View style={commonStyle.rowFlexCenterItem}>
      {value ? (
        <Text style={commonStyle.subRowText}>{t('page.signTx.yes')}</Text>
      ) : (
        <Text style={commonStyle.subRowText}>{t('page.signTx.no')}</Text>
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
  const commonStyle = useCommonStyle();

  return (
    <Text
      // onPress={handleClickTokenSymbol}
      style={{
        ...commonStyle.primaryText,
        ...style,
      }}
      numberOfLines={1}
      ellipsizeMode="tail">
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  AddressWithCopy,
};
