import { createGetStyles2024 } from '@/utils/styles';
import { Text, View } from 'react-native';
import IconPhone from '@/assets2024/icons/sync-extension/phone.svg';
import { useTheme2024 } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import React from 'react';

export const SyncExtensionHeader = ({
  type,
  newUser,
}: {
  type: 'verify' | 'imported';
  newUser?: boolean;
}) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const isImported = type === 'imported';

  const title = React.useMemo(
    () =>
      isImported
        ? t('page.syncExtension.imported')
        : t('page.syncExtension.verifyWithPassword'),
    [isImported, t],
  );

  const tips = React.useMemo(
    () =>
      isImported
        ? t('page.syncExtension.importedTips')
        : newUser
        ? t('page.syncExtension.newUserVerify')
        : t('page.syncExtension.verifyTips'),
    [isImported, newUser, t],
  );
  return (
    <View>
      <IconPhone style={styles.logoBox} />
      <Text style={[styles.title]}>{title}</Text>
      <Text style={styles.tips}>{tips}</Text>
    </View>
  );
};

const getStyle = createGetStyles2024(ctx => ({
  logoBox: {
    width: 60,
    height: 60,
    alignSelf: 'center',
  },
  title: {
    color: ctx.colors2024['neutral-title-1'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '800',
    lineHeight: 24,
    marginTop: 12,
    marginBottom: 8,
  },
  tips: {
    color: ctx.colors2024['neutral-secondary'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 22,
  },
}));
