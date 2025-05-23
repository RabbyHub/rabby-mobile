import { KeyringAccountWithAlias } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { ellipsisAddress } from '@/utils/address';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { WalletIcon } from '../WalletIcon/WalletIcon';

export interface Props {
  account: KeyringAccountWithAlias;
  iconSize?: number;
  iconBorderRadius?: number;
  accoutnIconUri?: string;
  onChange: (aliasName: string) => void;
}

export const AliasNameEditView: React.FC<Props> = ({
  account,
  iconSize = 100,
  iconBorderRadius = 24,
  accoutnIconUri,
  onChange,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [aliasName, setAliasName] = React.useState<string>();
  const defaultAliasName =
    account.aliasName || ellipsisAddress(account.address || '');
  const [placeholder, setPlaceholder] = React.useState(defaultAliasName);

  React.useEffect(() => {
    setPlaceholder(defaultAliasName);
  }, [defaultAliasName]);

  return (
    <View style={styles.itemContainer}>
      {accoutnIconUri ? (
        <Image
          source={{ uri: accoutnIconUri }}
          style={{ borderRadius: iconBorderRadius }}
          width={iconSize}
          height={iconSize}
        />
      ) : (
        <WalletIcon
          type={account.type}
          address={account.address}
          width={iconSize}
          height={iconSize}
          borderRadius={iconBorderRadius}
        />
      )}
      <TextInput
        autoFocus
        style={styles.inputInner}
        value={aliasName}
        placeholder={placeholder}
        placeholderTextColor={colors2024['neutral-info']}
        onChange={nativeEvent => {
          const _aliasName = nativeEvent.nativeEvent.text;
          setAliasName(_aliasName);
          onChange(_aliasName);
        }}
        blurOnSubmit
      />
      <Text style={StyleSheet.flatten([styles.addressText])}>
        {ellipsisAddress(account.address)}
      </Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    height: '100%',
    position: 'relative',
    display: 'flex',
    paddingHorizontal: 20,
    backgroundColor: colors2024['neutral-bg-1'],
    marginBottom: 20,
  },
  itemContainer: {
    display: 'flex',
    alignItems: 'center',
  },
  addressText: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    marginTop: 7,
  },
  inputInner: {
    width: '100%',
    marginTop: 15,
    textAlignVertical: 'center',
    height: 54,
    padding: 0,
    fontSize: 36,
    borderWidth: 0,
    backgroundColor: 'transparent',
    lineHeight: 42,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
}));
