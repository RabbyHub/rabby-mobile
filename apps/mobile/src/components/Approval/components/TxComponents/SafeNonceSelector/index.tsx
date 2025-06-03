import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { intToHex } from '@rabby-wallet/biz-utils/dist/isomorphic/biz-number';
import type { BasicSafeInfo } from '@rabby-wallet/gnosis-sdk';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { GasSelectorSkeleton } from '../GasSelector/GasSelectorSkeleton';
import { SafeNonceOptionList } from './SafeNonceOptionList';
import { RcArrowDownCC } from '@/assets/icons/common';
import { Account } from '@/core/services/preference';

interface SafeNonceSelectorProps {
  value?: string;
  onChange?(value: string): void;
  isReady?: boolean;
  chainId: number;
  safeInfo?: BasicSafeInfo | null;
  disabled?: boolean;
  account: Account;
}

export const SafeNonceSelector = ({
  value,
  onChange,
  isReady,
  chainId,
  safeInfo,
  disabled,
  account,
}: SafeNonceSelectorProps) => {
  const { t } = useTranslation();
  const [isShowOptionList, setIsShowOptionList] = useState(false);
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [isFocused, setIsFocused] = useState(false);

  const val = useMemo(() => {
    if (value == null || value === '') {
      return '';
    }
    const res = +value;
    if (Number.isNaN(res)) {
      return '';
    }
    return res;
  }, [value]);

  const handleOnChange = (_v: string | number) => {
    const v = +_v;
    if (Number.isNaN(v)) {
      onChange?.('');
    } else {
      onChange?.(intToHex(v));
    }
    setIsShowOptionList(false);
  };

  if (!isReady) {
    return <GasSelectorSkeleton />;
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.nonceSelect}>
        <Text style={styles.nonceSelectLabel}>{t('global.Nonce')}</Text>
        <View
          style={[
            styles.inputContainer,
            isFocused && styles.inputContainerFocused,
          ]}>
          <TextInput
            style={styles.nonceInput}
            value={val + ''}
            keyboardType="numeric"
            onChangeText={v => {
              handleOnChange(v);
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            editable={!disabled}
          />
          <TouchableOpacity
            onPress={() => {
              if (disabled) {
                return;
              }
              setIsShowOptionList(v => !v);
            }}
            hitSlop={6}
            style={styles.suffixIcon}>
            <RcArrowDownCC
              width={18}
              height={18}
              color={colors['neutral-foot']}
              style={isShowOptionList ? styles.rotateIcon : undefined}
            />
          </TouchableOpacity>
        </View>
        {isShowOptionList ? (
          <View>
            <SafeNonceOptionList
              account={account}
              chainId={chainId}
              value={val === '' ? undefined : val}
              onChange={handleOnChange}
              safeInfo={safeInfo}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
};

const getStyles = createGetStyles(colors => ({
  wrapper: {
    backgroundColor: colors['neutral-card-1'],
    paddingTop: 16,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderRadius: 6,
  },
  nonceSelect: {
    marginBottom: 12,
  },
  nonceSelectLabel: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '500',
    color: colors['neutral-title-1'],
    marginBottom: 12,
  },
  inputContainer: {
    backgroundColor: colors['neutral-card-2'],
    borderRadius: 4,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors['neutral-line'],
  },
  inputContainerFocused: {
    borderColor: colors['blue-default'],
  },
  nonceInput: {
    height: 44,
    flex: 1,
    color: colors['neutral-title-1'],
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '500',
  },
  suffixIcon: {
    marginLeft: 'auto',
  },
  rotateIcon: {
    transform: [{ rotate: '180deg' }],
  },
  skeletonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
}));
