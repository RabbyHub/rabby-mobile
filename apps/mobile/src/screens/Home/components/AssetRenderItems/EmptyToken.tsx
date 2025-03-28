import React, { memo } from 'react';
import { View, Text, ImageBackground } from 'react-native';
import { TOKEN_EMPTY_ROW_HIGHT } from '@/constant/layout';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import { Card } from '@/components2024/Card';
import { RcIconReceive, RcIconBuy } from '@/assets2024/singleHome';
interface IProps {
  onReceive: () => void;
  onBuy: () => void;
}
export const EmptyTokenRow = memo(({ onBuy, onReceive }: IProps) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={[styles.constainer]}>
      <ImageBackground
        source={require('@/assets/icons/token/empty-token.png')}
        style={styles.imageBackground}
        resizeMode="cover">
        <Text style={styles.header}>
          {t('page.singleHome.emptyToken.title')}
        </Text>
        <View style={styles.cardList}>
          <Card onPress={onReceive} style={styles.card}>
            <View style={styles.icon}>
              <RcIconReceive width={16.8} height={16.8} />
            </View>
            <View style={styles.sectionDescription}>
              <Text style={styles.sectionHeader}>
                {t('page.singleHome.emptyToken.receiveHeader')}
              </Text>
              <Text style={styles.sectionBody}>
                {t('page.singleHome.emptyToken.receiveBody')}
              </Text>
            </View>
          </Card>
          <Card onPress={onBuy} style={styles.card}>
            <View style={styles.icon}>
              <RcIconBuy width={16.8} height={16.8} />
            </View>
            <View style={styles.sectionDescription}>
              <Text style={styles.sectionHeader}>
                {t('page.singleHome.emptyToken.buyHeader')}
              </Text>
              <Text style={styles.sectionBody}>
                {t('page.singleHome.emptyToken.buyBody')}
              </Text>
            </View>
          </Card>
        </View>
      </ImageBackground>
    </View>
  );
});

const getStyle = createGetStyles2024(ctx => ({
  constainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 24,
    height: TOKEN_EMPTY_ROW_HIGHT,
  },
  imageBackground: {
    flex: 1,
    width: 358,
    height: TOKEN_EMPTY_ROW_HIGHT,
    borderRadius: 24,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-1']
      : ctx.colors2024['neutral-bg-2'],
    paddingHorizontal: 14.5,
    alignItems: 'center',
  },
  icon: {
    width: 28,
    height: 28,
    display: 'flex',
    justifyContent: 'center',
    alignContent: 'center',
    alignItems: 'center',
    borderRadius: 9.8,
    backgroundColor: ctx.colors2024['brand-light-1'],
  },
  header: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    marginTop: 42,
    marginBottom: 42,
    color: ctx.colors2024['neutral-title-1'],
  },
  cardList: {
    gap: 12,
    width: '100%',
  },
  card: {
    height: 98,
    width: '100%',
    borderRadius: 24,
    display: 'flex',
    justifyContent: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  sectionDescription: {
    gap: 4,
  },
  sectionHeader: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-title-1'],
  },
  sectionBody: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-secondary'],
  },
}));
