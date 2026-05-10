import { KeyringAccountWithAlias } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { ellipsisAddress } from '@/utils/address';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { WalletIcon } from '../WalletIcon/WalletIcon';
import { Text, TextInput } from '@/components/Typography';

const isAndroid = Platform.OS === 'android';

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
  const [selection, setSelection] = React.useState<
    { start: number; end: number } | undefined
  >();
  const placeholder =
    account.aliasName || ellipsisAddress(account.address || '');
  const showAndroidPlaceholder = isAndroid && !aliasName;

  React.useEffect(() => {
    setAliasName(undefined);

    if (isAndroid) {
      setSelection({ start: 0, end: 0 });
    }
  }, [account.address, account.aliasName]);

  const focusAtStartOnAndroid = React.useCallback(() => {
    if (!isAndroid) {
      return;
    }

    if (!aliasName) {
      setSelection({ start: 0, end: 0 });
    }
  }, [aliasName]);

  const handleSelectionChange = React.useCallback(() => {
    setSelection(undefined);
  }, []);

  const handleChangeText = React.useCallback(
    (_aliasName: string) => {
      setAliasName(_aliasName);
      setSelection(undefined);
      onChange(_aliasName);
    },
    [onChange],
  );

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
      <View style={styles.inputWrapper}>
        {showAndroidPlaceholder ? (
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[
              styles.inputInner,
              styles.inputInnerInWrapper,
              styles.androidPlaceholder,
            ]}>
            {placeholder}
          </Text>
        ) : null}
        <TextInput
          autoFocus
          style={[styles.inputInner, styles.inputInnerInWrapper]}
          value={aliasName ?? ''}
          placeholder={isAndroid ? '' : placeholder}
          placeholderTextColor={colors2024['neutral-info']}
          onChangeText={handleChangeText}
          onFocus={focusAtStartOnAndroid}
          onSelectionChange={handleSelectionChange}
          selection={isAndroid && !aliasName ? selection : undefined}
          blurOnSubmit
        />
      </View>
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
  inputWrapper: {
    width: '100%',
    height: 54,
    marginTop: 15,
    position: 'relative',
  },
  inputInner: {
    width: '100%',
    textAlignVertical: 'center',
    height: 54,
    padding: 0,
    fontSize: 36,
    borderWidth: 0,
    backgroundColor: 'transparent',
    ...Platform.select({
      ios: { lineHeight: 42 },
      android: { includeFontPadding: false },
    }),
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
  inputInnerInWrapper: {
    marginTop: 0,
  },
  androidPlaceholder: {
    position: 'absolute',
    color: colors2024['neutral-info'],
  },
}));
