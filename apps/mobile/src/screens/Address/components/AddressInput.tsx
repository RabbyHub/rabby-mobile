import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import {
  NativeSyntheticEvent,
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
import { toast } from '@/components/Toast';

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
          backgroundColor: colors['neutral-card-1'],
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingTop: 12,
        },
        input: {
          backgroundColor: colors['neutral-card-2'],
          borderRadius: 4,
          paddingHorizontal: 6,
          marginRight: 80,
          height: 40,
          color: colors['neutral-title-1'],
        },
        address: {
          color: colors['neutral-body'],
          fontSize: 13,
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
      }),

    [colors],
  );

  const onCopy = React.useCallback(() => {
    Clipboard.setString(address);
    toast.success('Copied');
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
      />
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
