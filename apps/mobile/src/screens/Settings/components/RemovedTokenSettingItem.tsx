import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import RcRemovedToken from '@/assets/icons/settings/removed-token.svg';
import RcArrowRight from '@/assets/icons/settings/removed-token-arrow.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { useRemovedTokens } from '@/hooks/useRemovedTokens';
import { createGetStyles2024 } from '@/utils/styles';
import { Block } from '../Block';
import { RemovedTokenPopup } from './RemovedTokenPopup';

export function RemovedTokenSettingItem() {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const count = useRemovedTokens(state => state.removedTokens.length);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!count) {
      setVisible(false);
    }
  }, [count]);

  if (!count) {
    return null;
  }

  return (
    <>
      <Block.Item
        icon={
          <View style={styles.icon}>
            <RcRemovedToken />
          </View>
        }
        rightNode={
          <View style={styles.right}>
            <Text style={styles.count}>{count}</Text>
            <RcArrowRight />
          </View>
        }
        onPress={() => setVisible(true)}>
        <Text style={styles.label}>{t('page.setting.removedToken.title')}</Text>
      </Block.Item>
      {visible && <RemovedTokenPopup onClose={() => setVisible(false)} />}
    </>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  icon: { marginRight: 8 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-body'],
  },
  count: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
  },
}));
