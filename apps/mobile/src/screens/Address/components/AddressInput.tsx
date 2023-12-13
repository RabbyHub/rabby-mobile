import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import {
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TextInput,
  TextInputSubmitEditingEventData,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import CopySVG from '@/assets/icons/common/copy.svg';
import { Button } from '@/components';
import { contactService } from '@/core/services';

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
          paddingVertical: 11,
          marginRight: 80,
        },
        address: {
          color: colors['neutral-body'],
          fontSize: 13,
          fontWeight: '400',
          marginRight: 4,
        },
        addressContainer: {
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 10,
          paddingBottom: 12,
        },
      }),

    [colors],
  );

  const onCopy = React.useCallback(() => {
    // TODO: copy address
    console.log('onCopy');
  }, []);

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
        defaultValue={aliasName}
        style={styles.input}
      />
      <TouchableOpacity onPress={onCopy} style={styles.addressContainer}>
        <Text style={styles.address}>{address}</Text>
        <Text>
          <CopySVG />
        </Text>
      </TouchableOpacity>
    </View>
  );
};
