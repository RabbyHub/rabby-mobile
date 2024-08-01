import clsx from 'clsx';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { AppSwitch } from '../customized/Switch';
import { createGetStyles } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';

export interface Props {
  selected?: boolean;
  onOpen(): void;
  onClose(): void;
}

export const BlockedButton: React.FC<Props> = ({
  selected,
  onOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const { styles, colors } = useThemeStyles(getStyles);
  return (
    <View
      style={[
        styles.container,
        selected ? styles.selected : styles.notSelected,
      ]}>
      {selected ? (
        <Text style={styles.tip} numberOfLines={2}>
          {t('page.dashboard.tokenDetail.blockedTip')}
        </Text>
      ) : null}

      <View style={styles.switchLabel}>
        <AppSwitch
          value={!!selected}
          onValueChange={v => {
            if (v) {
              onOpen();
            } else {
              onClose();
            }
          }}
          backgroundActive={colors['red-default']}
          circleBorderActiveColor={colors['red-default']}
        />
        <Text style={styles.switchText}>
          {t('page.dashboard.tokenDetail.blocked')}
        </Text>
      </View>
    </View>
  );
};

const getStyles = createGetStyles(colors => {
  return {
    container: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 4,
      gap: 30,
    },
    selected: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors['orange-light'],
      marginBottom: 16,
    },
    notSelected: {
      position: 'absolute',
      right: 0,
      top: 4,
      zIndex: 1,
    },
    tip: {
      minWidth: 0,
      flex: 1,
      color: colors['orange-default'],
      fontSize: 13,
      lineHeight: 16,
    },
    switchLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginLeft: 'auto',
    },
    switchText: {
      color: colors['neutral-foot'],
      fontSize: 13,
      lineHeight: 16,
    },
  };
});
