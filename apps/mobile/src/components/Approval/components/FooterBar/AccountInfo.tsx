import { AddressViewer } from '@/components/AddressViewer';
import { Tip } from '@/components/Tip';
import { TruncatedText } from '@/components/TruncatedText';
import { Chain } from '@/constant/chains';
import { contactService } from '@/core/services';
import { Account } from '@/core/services/preference';
import { useTheme2024 } from '@/hooks/theme';
import useCurrentBalance from '@/hooks/useCurrentBalance';
import { splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { getWalletIcon } from '@/utils/walletInfo';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

export interface Props {
  account: Account;
  isTestnet?: boolean;
  chain?: Chain;
}

export const AccountInfo: React.FC<Props> = ({
  account,
  chain,
  isTestnet = false,
}) => {
  const [nickname, setNickname] = React.useState<string>();
  const { balance } = useCurrentBalance({
    address: account?.address,
    AUTO_FETCH: true,
    fromScene: 'Unknown',
  });
  const displayBalance = splitNumberByStep((balance || 0).toFixed(2));
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  const init = async () => {
    const result = await contactService.getAliasByAddress(
      account?.address?.toLowerCase() || '',
    );
    if (result) {
      setNickname(result.alias);
    }
  };

  React.useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  const BrandIcon = getWalletIcon(account?.brandName);
  const [enableNicknameTip, setEnableNicknameTip] = React.useState(false);

  return (
    <View style={styles.wrapper}>
      <BrandIcon
        width={20}
        height={20}
        style={{
          flexShrink: 0,
        }}
      />
      <View style={styles.ellipsis}>
        <Tip content={enableNicknameTip ? nickname : undefined}>
          <TruncatedText
            onTruncate={setEnableNicknameTip}
            text={nickname}
            numberOfLines={1}
            style={styles.nickname}
          />
        </Tip>
      </View>

      <AddressViewer
        addressStyle={[
          styles.addressStyle,
          {
            flexShrink: 0,
          },
        ]}
        disabledPress
        showArrow={false}
        address={account.address}
      />
      {isTestnet ? null : (
        <Text
          style={[
            styles.balance,
            {
              flexShrink: 0,
            },
          ]}>
          ${displayBalance}
        </Text>
      )}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  wrapper: {
    backgroundColor: colors2024['neutral-bg-3'],
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    overflow: 'hidden',
    gap: 6,
  },
  addressContainer: {
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  nickname: {
    overflow: 'hidden',
    maxWidth: 130,

    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '400',
    color: colors2024['neutral-foot'],
    lineHeight: 18,
  },
  addressStyle: {
    fontSize: 13,
    lineHeight: 16,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
  },
  balance: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    fontStyle: 'normal',
    fontWeight: '400',
    color: colors2024['neutral-foot'],
    lineHeight: 16,
    marginLeft: 'auto',
  },
  ellipsis: {
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
  },
}));
