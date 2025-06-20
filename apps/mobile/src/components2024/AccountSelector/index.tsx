import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { memo, useState } from 'react';
import {
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

import { Account } from '@/core/services/preference';
import { WalletIcon } from '../WalletIcon/WalletIcon';
import RcIconArrowRight from '@/assets/icons/approval/edit-arrow-right.svg';
import { useAlias } from '@/hooks/alias';
import { useMemoizedFn } from 'ahooks';
import { AccountSelectorPopup } from './AccountSelectorPopup';
import { ellipsisAddress } from '@/utils/address';

interface Props {
  style?: StyleProp<ViewStyle>;
  value?: Account | null;
  onChange?: (v: Account) => void;
}

export const AccountSelector: React.FC<Props> = memo(
  ({ style, value: account, onChange }) => {
    const { colors2024, styles } = useTheme2024({ getStyle });

    const [alias] = useAlias(account?.address);
    const [isShowPopup, setIsShowPopup] = useState(false);

    const handleSelect = useMemoizedFn(() => {
      setIsShowPopup(true);
    });

    return (
      <>
        <TouchableOpacity
          style={[styles.wrapper, style]}
          onPress={handleSelect}>
          {account ? (
            <>
              <View>
                <WalletIcon
                  type={account.brandName}
                  address={account.address}
                  width={24}
                  height={24}
                />
              </View>
              <Text style={styles.text} numberOfLines={1} ellipsizeMode="tail">
                {alias || ellipsisAddress(account.address)}
              </Text>
            </>
          ) : (
            <Text style={styles.text}>{'Select Wallet'}</Text>
          )}

          <RcIconArrowRight style={styles.buttonIcon} />
        </TouchableOpacity>
        <AccountSelectorPopup
          visible={isShowPopup}
          onClose={() => {
            setIsShowPopup(false);
          }}
          value={account}
          onChange={v => {
            setIsShowPopup(false);
            onChange?.(v);
          }}
        />
      </>
    );
  },
);

const getStyle = createGetStyles2024(ctx => {
  return {
    walletIcon: {
      borderRadius: 7,
      width: 24,
      height: 24,
      marginRight: 8,
    },
    addressCaretIcon: {
      marginLeft: 'auto',
    },
    reverseCaret: {
      transform: [{ rotate: '180deg' }],
    },

    icon: {
      width: 24,
      height: 24,
      borderRadius: 24,
    },
    wrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 6,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: ctx.colors2024['neutral-bg-5'],
      gap: 6,
      height: 32,
      minWidth: 0,
    },
    text: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '500',
      color: ctx.colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      flexShrink: 1,
      minWidth: 30,
    },
    buttonIcon: {
      transform: [{ rotate: '90deg' }],
    },
  };
});
