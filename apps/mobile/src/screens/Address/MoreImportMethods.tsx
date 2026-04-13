import React from 'react';
import { View, ScrollView } from 'react-native';

import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { Card } from '@/components2024/Card';

import { RootNames } from '@/constant/layout';

import { StackActions, useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamsList } from '@/navigation-type';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';

type MoreImportMethodsProps = NativeStackScreenProps<
  RootStackParamsList,
  typeof RootNames.MoreImportMethods
>;

function MoreImportMethods(): JSX.Element {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const navigation = useNavigation<MoreImportMethodsProps['navigation']>();

  const onPressWatchOnly = React.useCallback(() => {
    navigation.dispatch(
      StackActions.push(RootNames.StackAddress, {
        screen: RootNames.ImportWatchAddress2024,
        params: {},
      }),
    );
  }, [navigation]);

  const onPressSafe = React.useCallback(() => {
    navigation.dispatch(
      StackActions.push(RootNames.StackAddress, {
        screen: RootNames.ImportSafeAddress2024,
        params: {},
      }),
    );
  }, [navigation]);

  return (
    <NormalScreenContainer overwriteStyle={styles.wrapper}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}>
        {/* Watch-only Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('page.nextComponent.importAddress.moreWatchOnlyTitle')}
          </Text>
          <Card style={styles.cardItem} onPress={onPressWatchOnly}>
            <WalletIcon
              type={KEYRING_TYPE.WatchAddressKeyring}
              width={40}
              height={40}
              style={styles.icon}
            />
            <Text style={styles.cardTitle}>
              {t('page.nextComponent.importAddress.moreWatchOnly')}
            </Text>
          </Card>
        </View>

        {/* Safe Address */}
        <View style={[styles.section, styles.sectionGap]}>
          <Text style={styles.sectionTitle}>
            {t('page.nextComponent.importAddress.moreSafeTitle')}
          </Text>
          <Card style={styles.cardItem} onPress={onPressSafe}>
            <WalletIcon
              type={KEYRING_TYPE.GnosisKeyring}
              width={40}
              height={40}
              style={styles.icon}
            />
            <Text style={styles.cardTitle}>
              {t('page.nextComponent.importAddress.safe')}
            </Text>
          </Card>
        </View>
      </ScrollView>
    </NormalScreenContainer>
  );
}

const getStyles = createGetStyles2024(ctx => ({
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: ctx.colors2024['neutral-bg-0'],
  },
  scrollView: {
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },
  section: {
    gap: 12,
  },
  sectionGap: {
    marginTop: 24,
  },
  sectionTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'left',
    color: ctx.colors2024['neutral-secondary'],
    paddingHorizontal: 8,
  },
  cardItem: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 12,
    backgroundColor: ctx.colors2024['neutral-card-1'],
    borderWidth: 0,
    shadowColor: 'rgba(55, 56, 63, 0.02)',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 1,
    shadowRadius: 40,
  },
  icon: {
    width: 40,
    height: 40,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-title-1'],
  },
}));

export default MoreImportMethods;
