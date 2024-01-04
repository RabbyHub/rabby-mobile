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
}

export const AddressInput: React.FC<Props> = ({ address, aliasName }) => {
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
        },
        address: {
          color: colors['neutral-body'],
          fontSize: 12,
          fontWeight: '400',
          marginRight: 4,
        },
        addressContainer: {
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 10,
          paddingBottom: 12,
          flexWrap: 'wrap',
        },
        icon: {
          color: colors['neutral-foot'],
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

  return (
    <View style={styles.container}>
      <TextInput
        onSubmitEditing={handleSubmit}
        value={aliasName}
        style={styles.input}
      />
      <TouchableOpacity onPress={onCopy} style={styles.addressContainer}>
        <Text style={styles.address}>{address}</Text>
        <Text>
          {/* @ts-ignore */}
          <RcIconCopyCC style={styles.icon} />
        </Text>
      </TouchableOpacity>
    </View>
  );
};
