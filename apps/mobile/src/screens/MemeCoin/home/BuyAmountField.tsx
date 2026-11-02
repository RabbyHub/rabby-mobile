import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Text, TextInput } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { sanitizePerpsProDecimalEditingInput } from '@/utils/perpsPriceProtocol';
import { createGetStyles2024 } from '@/utils/styles';

const MAX_AMOUNT_DECIMALS = 2;

const QUICK_AMOUNTS = [
  { value: '50', label: '50' },
  { value: '100', label: '100' },
  { value: '500', label: '500' },
  { value: '1000', label: '1,000' },
];

export const BuyAmountField = ({
  amountText,
  onChangeAmount,
}: {
  amountText: string;
  onChangeAmount: (text: string) => void;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  return (
    <>
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
      <View style={styles.quickRow}>
        {QUICK_AMOUNTS.map(({ value, label }) => (
          <TouchableOpacity
            key={value}
            onPress={() => onChangeAmount(value)}
            style={styles.quickItem}>
            <Text style={styles.quickText}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
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
  quickRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickItem: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors2024['neutral-bg-2'],
  },
  quickText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-body'],
  },
}));
