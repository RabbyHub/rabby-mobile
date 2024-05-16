import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import {
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TextInputSubmitEditingEventData,
  TouchableOpacity,
  View,
} from 'react-native';
import { RcIconCopyCC } from '@/assets/icons/common';
import { contactService } from '@/core/services';
import Clipboard from '@react-native-clipboard/clipboard';
import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';
import RcIconClose from '@/assets/icons/import-success/clear.svg';

interface Props {
  address: string;
  aliasName?: string;
  onChange?: (aliasName: string) => void;
}

export const AddressInput: React.FC<Props> = ({
  address,
  aliasName,
  onChange,
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: {
          height: 'auto',
          backgroundColor: colors['neutral-card-1'],
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingTop: 12,
          position: 'relative',
        },
        input: {
          width: '100%',
          backgroundColor: colors['neutral-card-2'],
          borderRadius: 4,
          paddingHorizontal: 6,
          minHeight: 48,
          color: colors['neutral-title-1'],
          fontSize: 16,
          fontWeight: '500',
          paddingRight: 38,
        },
        address: {
          color: colors['neutral-body'],
          fontSize: Platform.OS === 'ios' ? 15 : 14,
          fontWeight: '400',
        },
        addressContainer: {
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 10,
          paddingBottom: 12,
        },
        iconWrapper: {
          width: 18,
          height: 14,
          position: 'relative',
        },
        icon: {
          width: 14,
          height: 14,
          color: colors['neutral-foot'],
          position: 'absolute',
          left: 4,
          top: 2,
        },
        clearIcon: {
          position: 'absolute',
          right: 20,
          top: 26,
          width: 20,
          height: 20,
        },
        searchBarStyle: {
          margin: 0,
          padding: 0,
        },
        containerStyle: {
          borderTopWidth: 0,
          borderBottomWidth: 0,
          backgroundColor: colors['neutral-card-2'],
          borderRadius: 4,
          padding: 0,
        },
        clearIconContainer: {
          padding: 4,
        },
      }),

    [colors],
  );

  const onCopy = React.useCallback(() => {
    Clipboard.setString(address);
    toastCopyAddressSuccess(address);
  }, [address]);

  const handleSubmit = React.useCallback(
    (e: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
      contactService.setAlias({
        address,
        alias: e.nativeEvent.text,
      });
    },
    [address],
  );

  const [editingAliasName, setEditingAliasName] = React.useState<string>(
    aliasName || '',
  );

  React.useEffect(() => {
    setEditingAliasName(aliasName || '');
  }, [aliasName]);

  return (
    <View style={styles.container}>
      <TextInput
        onSubmitEditing={handleSubmit}
        value={editingAliasName}
        style={styles.input}
        onChange={nativeEvent => {
          setEditingAliasName(nativeEvent.nativeEvent.text);
          onChange?.(nativeEvent.nativeEvent.text);
        }}
        blurOnSubmit
        focusable={true}
        clearButtonMode="while-editing"
      />
      {!!editingAliasName && Platform.OS === 'android' && (
        <TouchableOpacity
          style={styles.clearIcon}
          onPress={e => {
            e.stopPropagation();
            setEditingAliasName('');
            onChange?.('');
          }}>
          <RcIconClose width={20} height={20} />
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={onCopy} style={styles.addressContainer}>
        <Text style={styles.address} textBreakStrategy="simple">
          {address}
          <View style={styles.iconWrapper}>
            <RcIconCopyCC
              color={colors['neutral-foot']}
              height={14}
              width={14}
              style={styles.icon}
            />
          </View>
        </Text>
      </TouchableOpacity>
    </View>
  );
};
