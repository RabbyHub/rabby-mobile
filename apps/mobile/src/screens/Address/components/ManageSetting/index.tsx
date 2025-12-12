import { Pressable, Text } from 'react-native';
import RcIconSettingCC from '@/assets2024/icons/common/IconSetting.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';

export const ManageSetting = ({
  isManageMode,
  switchManageMode,
}: {
  isManageMode: boolean;
  switchManageMode: () => void;
}) => {
  const { t } = useTranslation();
  const { colors2024, styles } = useTheme2024({ getStyle });

  return (
    <Pressable onPress={switchManageMode}>
      {!isManageMode ? (
        <RcIconSettingCC
          width={20}
          height={20}
          color={colors2024['neutral-secondary']}
        />
      ) : (
        <Text style={styles.done}>{t('global.Done')}</Text>
      )}
    </Pressable>
  );
};

const getStyle = createGetStyles2024(ctx => ({
  done: {
    color: ctx.colors2024['neutral-secondary'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },
}));
