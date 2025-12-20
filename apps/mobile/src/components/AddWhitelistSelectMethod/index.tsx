import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import IconImport from '@/assets2024/icons/common/IconImport.svg';
import IconCreate from '@/assets2024/icons/common/IconCreate.svg';
import IconHistory from '@/assets2024/icons/common/IconHistory.svg';
import { AppRootName, RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { ListItem } from '@/components2024/ListItem/ListItem';

interface Props {
  onDone: (isNoMnemonic?: boolean) => void;
}

export const AddWhitelistSelectMethod: React.FC<Props> = ({ onDone }) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <NormalScreenContainer overwriteStyle={styles.wrapper}>
      <View style={styles.section}>
        <Text style={styles.title}>{t('page.sendPoly.modals.header')}</Text>
        <Text style={styles.desc}>{t('page.sendPoly.modals.content')}</Text>
        <ListItem
          onPress={async () => {
            onDone();
          }}
          style={styles.importItem}
          title={t('page.sendPoly.modals.addAddress')}
          Icon={<IconCreate style={styles.icon} />}
        />
        <ListItem
          onPress={() => {
            onDone();
          }}
          style={styles.importItem}
          title={t('page.sendPoly.modals.importedAddress')}
          Icon={<IconImport style={styles.icon} />}
        />
        <ListItem
          onPress={() => {
            onDone();
          }}
          style={styles.importItem}
          title={t('page.sendPoly.modals.recentAddress')}
          Icon={<IconHistory style={styles.icon} />}
        />
      </View>
    </NormalScreenContainer>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  wrapper: {
    display: 'flex',
    paddingTop: 0,
    alignItems: 'center',
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  icon: {
    width: 40,
    height: 40,
  },
  section: {
    width: '100%',
    padding: 24,
    // marginBottom: 20,
    display: 'flex',
    justifyContent: 'center',
    gap: 12,
  },
  item: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  importItem: {
    height: 88,
    paddingHorizontal: 20,
    paddingVertical: 24,
    display: 'flex',
    flexDirection: 'row',
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    borderRadius: 30,
    borderWidth: 1,
    borderColor: ctx.colors2024['neutral-line'],
    justifyContent: 'space-between',
    padding: 0,
    gap: 12,
  },
  importType: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
  title: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
    textAlign: 'center',
    marginTop: 0,
    fontFamily: 'SF Pro Rounded',
  },
  desc: {
    fontWeight: '400',
    fontSize: 17,
    lineHeight: 22,
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
    marginTop: 0,
    marginBottom: 20,
  },
}));
