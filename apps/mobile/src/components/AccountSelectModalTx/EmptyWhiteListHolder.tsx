import React from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Card } from '@/components2024/Card';
import { Pressable, View, Text } from 'react-native';
import { RcIconMan } from '@/assets2024/icons/whitelist';
import { RcIconLockCC } from '@/assets/icons/send';

const EmptyWhiteListHolder = ({
  onAddWhitelist,
}: {
  onAddWhitelist?: () => void;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  return (
    <Card>
      <Text style={styles.header1}>
        {t('page.sendPoly.emptyWhitelistHeader')}
      </Text>
      <Text style={styles.header2}>
        {t('page.sendPoly.emptyWhitelistContent')}
      </Text>
      <Card style={styles.holder}>
        <View style={styles.iconWrapper}>
          <RcIconMan
            style={styles.man}
            width={34}
            height={34}
            bgColor={colors2024['brand-disable']}
            iconColor={colors2024['neutral-bg-1']}
          />
          <RcIconLockCC
            style={styles.lock}
            color={colors2024['brand-disable']}
            surroundColor={colors2024['neutral-bg-1']}
            width={18}
            height={18}
          />
        </View>
        <View style={styles.loadings}>
          <View style={styles.loadingSection1} />
          <View style={styles.loadingSection2} />
        </View>
      </Card>
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {t('page.sendPoly.emptyWhitelistTip')}
        </Text>
        <Pressable style={styles.footerBtn} onPress={onAddWhitelist}>
          <Text style={styles.footerBtnText}>
            {t('page.sendPoly.emptyWhitelistBtn')}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
};

export default EmptyWhiteListHolder;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  header1: {
    position: 'relative',
    color: colors2024['neutral-title-1'],
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    lineHeight: 22,
  },
  header2: {
    color: colors2024['neutral-secondary'],
    fontSize: 16,
    width: '100%',
    fontFamily: 'SF Pro Rounded',
    marginTop: 15,
    marginBottom: 20,
  },
  holder: {
    width: '100%',
    marginBottom: 28,
    display: 'flex',
    flexDirection: 'row',
    borderColor: colors2024['brand-light-1'],
    borderRadius: 19,
    gap: 12,
  },
  iconWrapper: {
    width: 34,
    height: 34,
    position: 'relative',
  },
  man: {
    width: 34,
    height: 34,
  },
  lock: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    zIndex: 999,
    transform: [{ translateX: 3 }, { translateY: 4 }],
  },
  loadings: {
    flex: 1,
    height: 25,
    gap: 8,
    justifyContent: 'center',
  },
  loadingSection1: {
    width: 37,
    height: 7,
    backgroundColor: colors2024['brand-light-1'],
    borderRadius: 8,
  },
  loadingSection2: {
    width: 58,
    height: 7,
    backgroundColor: colors2024['brand-light-2'],
    borderRadius: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
    lineHeight: 24,
  },
  footerBtn: {},
  footerBtnText: {
    fontFamily: 'SF Pro Rounded',
    color: colors2024['brand-default'],
    fontWeight: '800',
    fontSize: 16,
    lineHeight: 24,
  },
}));
