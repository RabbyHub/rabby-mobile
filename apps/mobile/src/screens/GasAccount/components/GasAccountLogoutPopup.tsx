import React from 'react';
import { View, ViewProps } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useGasAccountSign } from '../hooks/atom';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';

export const GasAccountCurrentAddress = ({
  style,
}: {
  style?: ViewProps['style'];
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { account } = useGasAccountSign();

  if (!account) {
    return null;
  }

  return (
    <View style={[styles.currentAddressContainer, style]}>
      <AddressItem account={account as any} fetchAccount={false}>
        {({ WalletIcon, WalletName, WalletBalance }) => (
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              alignItems: 'center',
            }}>
            <WalletIcon
              style={{
                width: 40,
                height: 40,
              }}
            />
            <View style={{ gap: 4 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                }}>
                <WalletName style={styles.addressText} />
              </View>

              <WalletBalance
                style={[
                  styles.addressText,
                  {
                    color: colors2024['neutral-title-1'],
                    fontSize: 16,
                    lineHeight: 20,
                    fontWeight: '700',
                  },
                ]}
              />
            </View>
          </View>
        )}
      </AddressItem>
    </View>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  currentAddressContainer: {
    borderRadius: 20,
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    padding: 16,
    height: 78,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
  },

  addressText: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
  },
}));
