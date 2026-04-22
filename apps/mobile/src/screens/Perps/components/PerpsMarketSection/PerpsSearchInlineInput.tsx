import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import { RcNextSearchCC } from '@/assets/icons/common';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { naviPush } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';

export const PerpsSearchInlineInput: React.FC = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      onPress={() => {
        naviPush(RootNames.StackTransaction, {
          screen: RootNames.PerpsSearch,
          params: {
            openFromSource: 'searchPerps',
            autoFocus: true,
            initialTab: 'topVolume',
          },
        });
      }}
      style={styles.container}>
      <View style={styles.inner}>
        <RcNextSearchCC
          width={16}
          height={16}
          color={colors2024['neutral-foot']}
        />
        <Text style={styles.placeholder}>
          {t('page.perps.search.placeholder')}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    marginTop: 4,
    marginBottom: 0,
    paddingHorizontal: 8,
  },
  inner: {
    height: 46,
    borderRadius: 12,
    backgroundColor: colors2024['neutral-bg-5'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  placeholder: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },
}));
