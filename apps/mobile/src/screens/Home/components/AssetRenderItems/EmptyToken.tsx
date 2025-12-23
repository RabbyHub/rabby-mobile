import React, { memo } from 'react';
import {
  View,
  Text,
  ImageBackground,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { RootNames, TOKEN_EMPTY_ROW_HIGHT } from '@/constant/layout';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import { Card } from '@/components2024/Card';
import {
  RcIconOldReceive,
  RcIconBuy,
  RcIconImport,
} from '@/assets2024/singleHome';
import { apiGlobalModal } from '@/components2024/GlobalBottomSheetModal/apiGlobalModal';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { Account } from '@/core/services/preference';
import { naviPush } from '@/utils/navigation';
interface IProps {
  currentAccount?: Account | null;
  // onReceive: () => void;
  // onImport: () => void;
  style?: StyleProp<ViewStyle>;
}
export const EmptyTokenRow = memo(({ currentAccount, style }: IProps) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();

  return (
    <View style={[styles.constainer, style]}>
      <ImageBackground
        source={require('@/assets2024/icons/home/buy-bg.png')}
        style={styles.imageBackground}
        resizeMode="cover">
        <Text style={styles.header}>
          {t('page.singleHome.emptyToken.title')}
        </Text>
        <Text style={styles.desc}>{t('page.singleHome.emptyToken.desc')}</Text>
        <View style={styles.cardList}>
          <Card
            onPress={() => {
              apiGlobalModal.showAddSelectMethodModal();
            }}
            style={styles.card}>
            <View style={styles.icon}>
              <RcIconImport width={16.8} height={16.8} />
            </View>
            <View style={styles.sectionDescription}>
              <Text style={styles.sectionHeader}>
                {t('page.nextComponent.multiAddressHome.importAddress')}
              </Text>
              <Text style={styles.sectionBody}>
                {t('page.nextComponent.multiAddressHome.importAddressDesc')}
              </Text>
            </View>
          </Card>
          <Card
            onPress={async () => {
              if (!currentAccount?.address) {
                return;
              }
              await switchSceneCurrentAccount(
                'MakeTransactionAbout',
                currentAccount,
              );
              naviPush(RootNames.StackTransaction, {
                screen: RootNames.Receive,
                params: {
                  account: currentAccount,
                },
              });
            }}
            style={styles.card}>
            <View style={styles.icon}>
              <RcIconOldReceive width={16.8} height={16.8} />
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
    borderRadius: 20,
    height: TOKEN_EMPTY_ROW_HIGHT,
    paddingHorizontal: 16,
    overflow: 'hidden',
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
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
    marginTop: 30,
    color: ctx.colors2024['neutral-title-1'],
  },
  desc: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    marginTop: 6,
    marginBottom: 20,
    color: ctx.colors2024['neutral-secondary'],
  },
  cardList: {
    gap: 12,
    width: '100%',
  },
  card: {
    width: '100%',
    borderRadius: 20,
    display: 'flex',
    justifyContent: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'flex-start',
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
