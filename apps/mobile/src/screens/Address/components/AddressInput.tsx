import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import CopySVG from '@/assets/icons/common/copy.svg';
import { Button } from '@/components';

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
          paddingVertical: 12,
        },
        input: {
          backgroundColor: colors['neutral-card-2'],
          borderRadius: 4,
          paddingHorizontal: 6,
          paddingVertical: 11,
          marginRight: 80,
          marginBottom: 10,
        },
        address: {
          color: colors['neutral-body'],
          fontSize: 13,
          fontWeight: '400',
          marginRight: 4,
        },
      }),

    [colors],
  );

  const onCopy = React.useCallback(() => {
    // TODO: copy address
    console.log('onCopy');
  }, []);

  return (
    <View style={styles.container}>
      <TextInput defaultValue={aliasName} style={styles.input} />
      <View>
        <Text style={styles.address}>{address}</Text>

        <Button onPress={onCopy}>
          <CopySVG />
        </Button>
      </View>
    </View>
  );
};
