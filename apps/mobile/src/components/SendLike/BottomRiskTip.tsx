import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { RcIconWarningCircleCC } from '@/assets2024/icons/common';
import { CheckBoxRect } from '@/components2024/CheckBox';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

export function BottomRiskTip({
  loadingRisks = false,
  mostImportantRisks = [],
  onToggleAgreeRequiredChecked,
  agreeRequiredChecked = false,
}: {
  loadingRisks: boolean;
  mostImportantRisks: { value: string }[];
  onToggleAgreeRequiredChecked: (nextVal: boolean) => void;
  agreeRequiredChecked: boolean;
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <View style={styles.riskTipsArea}>
      <View style={[styles.riskList]}>
        {loadingRisks ? (
          <></>
        ) : (
          // <View style={styles.tipItem}>
          //   <Skeleton circle width={20} height={20} />
          //   <Skeleton style={styles.loadingRisks} height={40} />
          // </View>
          mostImportantRisks.map(risk => (
            <View key={risk.value} style={styles.tipItem}>
              <RcIconWarningCircleCC
                width={20}
                height={20}
                color={colors2024['red-default']}
              />
              <Text style={styles.tipText}>{risk.value}</Text>
            </View>
          ))
        )}
      </View>
      {!loadingRisks && mostImportantRisks?.length ? (
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => onToggleAgreeRequiredChecked(!agreeRequiredChecked)}>
          <CheckBoxRect size={16} checked={agreeRequiredChecked} />
          <Text style={styles.checkboxText}>
            {t('page.confirmAddress.checkbox')}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    riskTipsArea: {
      // ...makeDebugBorder(),
      marginBottom: 12,
    },

    riskList: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      // backgroundColor: colors2024['red-light-1'],
      overflow: 'hidden',
    },
    tipItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors2024['red-light-1'],
      paddingHorizontal: 12,
      paddingVertical: 16,
      borderRadius: 12,
    },
    tipIcon: {
      width: 14,
      justifyContent: 'center',
      height: 20,
    },
    tipText: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '500',
      flex: 1,
      fontFamily: 'SF Pro Rounded',
      color: colors2024['red-default'],
    },
    loadingRisks: {
      backgroundColor: colors2024['red-light-1'],
      borderRadius: 8,
      flex: 1,
    },
    checkbox: {
      display: 'flex',
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
    },
    checkboxText: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '400',
      fontFamily: 'SF Pro Rounded',
      color: colors2024['neutral-foot'],
    },
  };
});
