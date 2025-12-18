import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React from 'react';

import {
  View,
  Text,
  TouchableWithoutFeedback,
  Keyboard,
  StyleSheet,
  Pressable,
} from 'react-native';

import HelpIcon from '@/assets2024/icons/common/help.svg';
import { RootNames } from '@/constant/layout';
import { default as RcIconBackupCloud } from '@/assets/icons/nextComponent/IconBackupCloud.svg';
import { default as RcIconBackupManual } from '@/assets/icons/nextComponent/IconBackupManual.svg';
import { useRoute } from '@react-navigation/native';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import { Card } from '@/components2024/Card';
import { useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { ListItem } from '@/components2024/ListItem/ListItem';
import { ProgressBar } from '@/components2024/progressBar';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import LinearGradient from 'react-native-linear-gradient';
import { IS_IOS } from '@/core/native/utils';
import { preferenceService } from '@/core/services';
import { REPORT_TIMEOUT_ACTION_KEY } from '@/core/services/type';

function MainListBlocks() {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  const route =
    useRoute<
      GetNestedScreenRouteProp<
        'AddressNavigatorParamList',
        'CreateChooseBackup'
      >
    >();
  const state = route.params;

  const handleBackupToCloud = React.useCallback(() => {
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.SEED_PHRASE_BACKUP_TO_CLOUD,
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
      },
      delaySetPassword: state?.delaySetPassword,
      onDone: () => {
        removeGlobalBottomSheetModal2024(id);
      },
    });
    state?.delaySetPassword &&
      preferenceService.setReportActionTs(
        REPORT_TIMEOUT_ACTION_KEY.CLICK_ICLOUD_BACKUP,
      );
  }, [state]);

  const handleBackupToPaper = React.useCallback(() => {
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.SEED_PHRASE_MANUAL_BACKUP,
      bottomSheetModalProps: {
        enableContentPanningGesture: false,
        enablePanDownToClose: true,
      },
      preventScreenshotOnModalOpen: false,
      // screenshotReportFreeBeforeModalClose: true,
      delaySetPassword: state?.delaySetPassword,
      onDone: () => {
        removeGlobalBottomSheetModal2024(id);
      },
    });
    state?.delaySetPassword &&
      preferenceService.setReportActionTs(
        REPORT_TIMEOUT_ACTION_KEY.CLICK_MANUAL_BACKUP,
      );
  }, [state]);

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        Keyboard.dismiss();
      }}>
      <View style={[styles.container]}>
        {!!state?.isFirstCreate && <ProgressBar amount={3} currentCount={3} />}
        <Text
          style={[
            styles.text,
            !!state?.isFirstCreate && {
              marginTop: 60,
            },
          ]}>
          {t('page.nextComponent.createNewAddress.backupSeedPhrase')}
        </Text>
        <Card style={styles.listItem} onPress={handleBackupToCloud}>
          <ListItem
            Icon={RcIconBackupCloud}
            title={
              IS_IOS
                ? t('page.newAddress.seedPhrase.icloudBackup')
                : t('page.newAddress.seedPhrase.googleDriveBackup')
            }
          />
          <Text style={styles.quickTag}>{t('page.newAddress.Quick')}</Text>
        </Card>
        <Card onPress={handleBackupToPaper} style={styles.listItem}>
          <ListItem
            Icon={RcIconBackupManual}
            title={t('page.newAddress.seedPhrase.manuallyBackup')}
          />
        </Card>

        <Pressable
          style={styles.bottomContainer}
          onPress={() => {
            const modalId = createGlobalBottomSheetModal2024({
              name: MODAL_NAMES.DESCRIPTION,
              title: t('page.newAddress.whatIsSeedPhrase.title'),
              bottomSheetModalProps: {
                enableContentPanningGesture: true,
                enablePanDownToClose: true,
              },
              sections: [
                {
                  description: t(
                    'page.newAddress.whatIsSeedPhrase.description1',
                  ),
                },
                {
                  title: t('page.newAddress.whatIsSeedPhrase.title1'),
                  description: t(
                    'page.newAddress.whatIsSeedPhrase.description2',
                  ),
                },
                {
                  title: t('page.newAddress.whatIsSeedPhrase.title2'),
                  description: t(
                    'page.newAddress.whatIsSeedPhrase.description3',
                  ),
                },
                {
                  title: t('page.newAddress.whatIsSeedPhrase.title3'),
                  description: t(
                    'page.newAddress.whatIsSeedPhrase.description4',
                  ),
                },
              ],
              nextButtonProps: {
                title: (
                  <Text style={styles.modalNextButtonText}>
                    {t('page.newAddress.whatIsSeedPhrase.GotIt')}
                  </Text>
                ),
                titleStyle: StyleSheet.flatten([styles.modalNextButtonText]),
                onPress: () => {
                  removeGlobalBottomSheetModal2024(modalId);
                },
              },
            });
          }}>
          <Text style={[styles.tipText]}>
            {t('page.nextComponent.createNewAddress.whatIsSeedPhrase')}
          </Text>
          <HelpIcon style={styles.tipIcon} />
        </Pressable>
      </View>
    </TouchableWithoutFeedback>
  );
}

function CreateChooseBackup(): JSX.Element {
  const { colors2024 } = useTheme2024({ getStyle });
  return (
    <NormalScreenContainer
      overwriteStyle={{
        backgroundColor: colors2024['neutral-bg-1'],
      }}>
      <LinearGradient
        colors={[colors2024['neutral-bg-1'], colors2024['neutral-bg-3']]} // 渐变颜色
        start={{ x: 0, y: 0 }} // 渐变起始位置
        end={{ x: 0, y: 1 }} // 渐变结束位置
        // style={{
        //   height: '100%',
        // }}
      >
        <MainListBlocks />
      </LinearGradient>
    </NormalScreenContainer>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  icon: {
    marginTop: -12,
    marginBottom: -68,
    borderRadius: 16,
  },
  modalNextButtonText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
    color: colors2024['neutral-InvertHighlight'],
  },
  quickTag: {
    position: 'absolute',
    right: 20,
    top: 32,
    color: colors2024['brand-default'],
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'SF Pro Rounded',
    width: 44,
    height: 24,
    padding: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors2024['brand-light-1'],
  },
  listItem: {
    position: 'relative',
    width: '100%',
    marginBottom: 12,
    borderRadius: 30,
    display: 'flex',
    alignItems: 'flex-start',
    height: 88,
  },
  bottomContainer: {
    width: '100%',
    position: 'absolute',
    height: 20,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    bottom: 60,
  },
  text: {
    color: colors2024['neutral-secondary'],
    fontWeight: '400',
    fontSize: 17,
    lineHeight: 22,
    marginBottom: 30,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
  },
  tipIcon: {
    width: 16,
    height: 16,
  },
  tipText: {
    color: colors2024['neutral-info'],
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
    marginRight: 8,
    fontFamily: 'SF Pro Rounded',
  },
  container: {
    height: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  inputContainer: {
    marginVertical: 8,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  inputInner: {
    width: '100%',
    textAlignVertical: 'center',
    height: 54,
    padding: 0,
    fontSize: 36,
    borderWidth: 0,
    backgroundColor: 'transparent',
    lineHeight: 42,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
}));

export default CreateChooseBackup;
