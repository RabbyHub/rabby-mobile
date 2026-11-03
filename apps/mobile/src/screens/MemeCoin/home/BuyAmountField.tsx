import React from 'react';
import { View } from 'react-native';
import { Text, TextInput } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { sanitizePerpsProDecimalEditingInput } from '@/utils/perpsPriceProtocol';
import { createGetStyles2024 } from '@/utils/styles';

const MAX_AMOUNT_DECIMALS = 2;

export const BuyAmountField = ({
  amountText,
  onChangeAmount,
}: {
  amountText: string;
  onChangeAmount: (text: string) => void;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  return (
    <View style={styles.inputBox}>
      <TextInput
        cursorColor={colors2024['brand-default']}
        selectionColor={colors2024['brand-default']}
        keyboardType="decimal-pad"
        onChangeText={text =>
          onChangeAmount(
            sanitizePerpsProDecimalEditingInput(text, MAX_AMOUNT_DECIMALS),
          )
        }
        placeholder="0"
        placeholderTextColor={colors2024['neutral-info']}
        style={styles.input}
        value={amountText}
      />
      <View style={styles.usdTag}>
        <Text style={styles.usdText}>USD</Text>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  inputBox: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors2024['neutral-bg-5'],
    backgroundColor: colors2024['neutral-bg-2'],
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: 34,
    padding: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  usdTag: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 18,
    justifyContent: 'center',
    backgroundColor: colors2024['neutral-line'],
  },
  usdText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-secondary'],
  },
}));
