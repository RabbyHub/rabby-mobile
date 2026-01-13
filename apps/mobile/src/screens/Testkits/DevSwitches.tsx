import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { useNavigation } from '@react-navigation/native';
import {
  createGetStyles2024,
  makeDebugBorder,
  makeProdBorder,
} from '@/utils/styles';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { NextInput } from '@/components2024/Form/Input';
import { RcIconCorrectCC } from '@/assets/icons/common';
import { RcIconScannerCC } from '@/assets/icons/address';
import TouchableView from '@/components/Touchable/TouchableView';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import {
  RcClearPending,
  RcCode,
  RcCountdown,
  RcGoogleDrive,
  RcGoogleSignout,
  RcScreenRecord,
  RcScreenshot,
} from '@/assets/icons/settings';
import {
  storeApiExpSettingData,
  useExpScreenCapture,
  useMockBatchRevoke,
  useTimeTipAboutSeedPhraseAndPrivateKey,
  useToggleShowAutoLockCountdown,
} from '@/hooks/appSettings';
import { SwitchToggleType } from '@/components';
import {
  FORCE_DISABLE_FEEDBACK_BY_SCREENSHOT,
  useIsShowFeedbackOnScreenshot,
  useScreenshotToReportEnabled,
  useViewedHomeTip,
} from '@/components/Screenshot/hooks';
import { SwitchAllowScreenshot } from '../Settings/components/SwitchAllowScreenshot';
import { TouchableOpacity } from 'react-native';
import { LabelScreenshotToReport } from '../Settings/components/SwitchScreenshotToReport';
import { useAutoLockCountDown } from '../Settings/components/LockAbout';
import { SwitchShowFloatingAutoLockCountdown } from '../Settings/components/SwitchFloatingView';
import { useGoogleSign } from '@/hooks/cloudStorage';
import {
  deleteAllBackups,
  saveMnemonicToCloud,
} from '@/core/utils/cloudBackup';
import { AppSwitch2024 } from '@/components/customized/Switch2024';
import {
  useExposureRateGuide,
  useMakeMockDataForRateGuideExposure,
} from '@/components/RateModal/hooks';
import { useMakeMockDataForHomeCenterArea } from '@/screens/Home/hooks/homeCenterArea';
import { useMockClearOfflineChainTips } from '@/screens/Home/components/OfflineChainNotify';
import { useGuidanceShown } from '@/components2024/Animations/hooks';
import { Button } from '@/components2024/Button';
import RNHelpers from '@/core/native/RNHelpers';
import { keyringService, preferenceService } from '@/core/services';
import { makeTokenManageSettingMap } from '@/core/_mocks/preferenceMigration';
import { getKeyring } from '@/core/apis/keyring';
import { MockWalletConnectKeyring } from '@/core/keyring-bridge/walletconnect/mock-walletconnect-keyring';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useDappsViewConfig } from '../Dapps/hooks/useDappView';
import { useResetSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { getScreenshotFeedbackExtra } from '@/components/Screenshot/utils';
import AnimateableText from 'react-native-animateable-text';

export const makeNoop = () => () => {};

function DevSwitchAboutScreenProtection() {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const { forceAllowScreenshot } = useExpScreenCapture();
  const switchAllowScreenshotRef = useRef<SwitchToggleType>(null);

  const { isScreenshotReportEnabled } = useIsShowFeedbackOnScreenshot();
  const { toggleSkipReportIn24Hours } = useScreenshotToReportEnabled();

  return (
    <View style={styles.showCaseRowsContainer}>
      <View style={styles.secondarySectionHeader}>
        {IS_IOS ? (
          <RcScreenRecord
            width={24}
            height={24}
            color={styles.secondarySectionTitle.color}
          />
        ) : (
          <RcScreenshot
            width={24}
            height={24}
            color={styles.secondarySectionTitle.color}
          />
        )}
        <Text
          style={[
            styles.secondarySectionTitle,
            { fontSize: 24, marginLeft: 2 },
          ]}>
          {IS_IOS ? 'Screen Recording Protection' : 'Screenshot Protection'}
        </Text>
      </View>

      <View
        style={[styles.secondarySectionContent, { flexDirection: 'column' }]}>
        <TouchableOpacity
          style={styles.switchRowWrapper}
          onPress={() => {
            switchAllowScreenshotRef.current?.toggle();
          }}>
          <SwitchAllowScreenshot
            ref={switchAllowScreenshotRef}
            onPress={evt => evt.stopPropagation()}
          />
          <Text style={styles.switchLabel}>
            {forceAllowScreenshot
              ? `Force Allow Capture`
              : `Disallow Capture Sensitive Scene`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.switchRowWrapper, { marginTop: 12 }]}
          onPress={() => {
            toggleSkipReportIn24Hours(false);
          }}>
          <RcCountdown
            width={18}
            height={18}
            color={styles.switchLabel.color}
          />
          <View style={styles.switchRowWrapper}>
            <Text style={styles.switchLabel}>
              {isScreenshotReportEnabled
                ? 'Report on screenshot now'
                : 'Disable Screenshot Until'}
            </Text>

            <View style={{ marginLeft: 2 }}>
              <LabelScreenshotToReport />
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DevSwitchAboutExpData() {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const switchShowFloatingAutoLockCountdownRef = useRef<SwitchToggleType>(null);

  const { timeTipAboutSeedPhraseAndPrivateKey } =
    useTimeTipAboutSeedPhraseAndPrivateKey();
  const btnGroupStates = useMemo(() => {
    const buttons = [
      'copy',
      'pasted',
      'none',
    ] as (typeof timeTipAboutSeedPhraseAndPrivateKey)[];
    return {
      selectedIndex: buttons.indexOf(timeTipAboutSeedPhraseAndPrivateKey),
      buttons,
    };
  }, [timeTipAboutSeedPhraseAndPrivateKey]);

  return (
    <View style={styles.showCaseRowsContainer}>
      <View style={styles.secondarySectionHeader}>
        <Text
          style={[
            styles.secondarySectionTitle,
            { fontSize: 24, marginLeft: 2 },
          ]}>
          Tip on Copy/Paste Seed Phrase and Private Key
        </Text>
      </View>

      <View
        style={[styles.secondarySectionContent, { flexDirection: 'column' }]}>
        <View style={[styles.rowWrapper, { marginTop: 0 }]}>
          <View style={[styles.buttonGroup]}>
            {btnGroupStates.buttons.map(btn => {
              const key = btn;
              const isSelected = btn === timeTipAboutSeedPhraseAndPrivateKey;
              return (
                <Button
                  key={key}
                  height={48}
                  titleStyle={[
                    {
                      color: isSelected
                        ? colors2024['neutral-title-2']
                        : colors2024['blue-default'],
                    },
                  ]}
                  type={isSelected ? 'primary' : 'ghost'}
                  title={ctx => {
                    return (
                      <Text style={[styles.label, ctx.titleStyle]}>{btn}</Text>
                    );
                  }}
                  containerStyle={[styles.btnOnGroup, { marginTop: 12 }]}
                  onPress={() => {
                    storeApiExpSettingData.set(prev => ({
                      ...prev,
                      timeTipAboutSeedPhraseAndPrivateKey: btn,
                    }));
                  }}
                />
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

function DevSwitchAboutAutoLock() {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const switchShowFloatingAutoLockCountdownRef = useRef<SwitchToggleType>(null);

  const { devNeedCountdown, countdownTextStyles, countdownTextProps } =
    useAutoLockCountDown();

  const { showAutoLockCountdown } = useToggleShowAutoLockCountdown();

  return (
    <View style={styles.showCaseRowsContainer}>
      <View style={styles.secondarySectionHeader}>
        <Text
          style={[
            styles.secondarySectionTitle,
            { fontSize: 24, marginLeft: 2 },
          ]}>
          Autolock Countdown
        </Text>
      </View>

      <View
        style={[styles.secondarySectionContent, { flexDirection: 'column' }]}>
        <TouchableOpacity
          style={styles.switchRowWrapper}
          onPress={() => {
            switchShowFloatingAutoLockCountdownRef.current?.toggle();
          }}>
          <SwitchShowFloatingAutoLockCountdown
            onPress={evt => evt.stopPropagation()}
            ref={switchShowFloatingAutoLockCountdownRef}
          />
          <Text style={styles.switchLabel}>
            {`${showAutoLockCountdown ? 'Show' : 'Hide'} Floating View`}
          </Text>
        </TouchableOpacity>
        <View style={[styles.rowWrapper, { marginTop: 12 }]}>
          <RcCountdown
            width={18}
            height={18}
            color={styles.switchLabel.color}
          />
          <Text style={styles.label}>
            {devNeedCountdown && <> Countdown </>}
          </Text>
          <AnimateableText
            animatedProps={countdownTextProps}
            style={countdownTextStyles}
          />
        </View>
      </View>
    </View>
  );
}

function DevTestCloudDrive() {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const { isLoginedGoogle, doGoogleSign, doGoogleSignOut } = useGoogleSign();

  return (
    <View style={styles.showCaseRowsContainer}>
      <View style={styles.secondarySectionHeader}>
        <Text
          style={[
            styles.secondarySectionTitle,
            { fontSize: 24, marginLeft: 2 },
          ]}>
          Cloud Drive Test Items
        </Text>
      </View>

      <View
        style={[styles.secondarySectionContent, { flexDirection: 'column' }]}>
        {IS_ANDROID && (
          <Button
            height={48}
            titleStyle={[{ color: colors2024['neutral-title-2'] }]}
            icon={
              !isLoginedGoogle ? (
                <RcGoogleDrive
                  style={[styles.labelIcon]}
                  color={colors2024['neutral-title-2']}
                />
              ) : (
                <RcGoogleSignout
                  style={[styles.labelIcon]}
                  color={colors2024['neutral-title-2']}
                />
              )
            }
            title={ctx => {
              return (
                <Text style={[styles.label, ctx.titleStyle]}>
                  {!isLoginedGoogle
                    ? 'Sign google drive'
                    : 'Signout google drive'}
                </Text>
              );
            }}
            containerStyle={[styles.rowWrapper]}
            onPress={
              !isLoginedGoogle
                ? () => {
                    doGoogleSign()
                      .then(async e => {
                        console.debug('loginIfNeeded done', e.needLogin);
                        await saveMnemonicToCloud({
                          mnemonic: 'testtest',
                          password: 'test',
                        });
                      })
                      .catch(e => {
                        console.error('loginIfNeeded error', e);
                      });
                  }
                : () => {
                    doGoogleSignOut();
                  }
            }
          />
        )}

        <Button
          height={48}
          titleStyle={[{ color: colors2024['neutral-title-2'] }]}
          type="danger"
          icon={
            <RcClearPending
              style={[styles.labelIcon]}
              color={colors2024['neutral-title-2']}
            />
          }
          title={ctx => {
            return (
              <Text style={[styles.label, ctx.titleStyle]}>
                Clear Cloud Backup
              </Text>
            );
          }}
          containerStyle={[styles.rowWrapper, { marginTop: 12 }]}
          onPress={() => {
            deleteAllBackups();
          }}
        />
      </View>
    </View>
  );
}

function DevTestHomeCenterArea() {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const { shouldShowRateGuideOnHome } = useExposureRateGuide();
  const { mockExposureRateGuide } = useMakeMockDataForRateGuideExposure();
  const { mockData, setMockData } = useMakeMockDataForHomeCenterArea();
  const { clearOfflineChainTips } = useMockClearOfflineChainTips();
  const { viewedHomeTip, mockResetViewedHomeTip } = useViewedHomeTip();
  const { multiTabs20251205Viewed, toggleViewedGuidance } = useGuidanceShown();

  useEffect(() => {
    if (mockData.forceShowOffchainNotify) {
      clearOfflineChainTips();
    }
  }, [clearOfflineChainTips, mockData.forceShowOffchainNotify]);

  return (
    <View style={styles.showCaseRowsContainer}>
      <View style={styles.secondarySectionHeader}>
        <Text
          style={[
            styles.secondarySectionTitle,
            { fontSize: 24, marginLeft: 2 },
          ]}>
          Home Center Notifications
        </Text>
      </View>

      <View
        style={[styles.secondarySectionContent, { flexDirection: 'column' }]}>
        <TouchableOpacity
          style={[styles.switchRowWrapper, { marginTop: 12 }]}
          onPress={() => {
            setMockData(prev => ({
              ...prev,
              forceShowOffchainNotify: !prev.forceShowOffchainNotify,
            }));
          }}>
          <AppSwitch2024
            onPress={evt => evt.stopPropagation()}
            value={mockData.forceShowOffchainNotify}
            onValueChange={value => {
              setMockData(prev => ({
                ...prev,
                forceShowOffchainNotify: value,
              }));
            }}
          />
          <Text style={styles.switchLabel}>Force Show Offchain Notify</Text>
        </TouchableOpacity>

        <Button
          title={'Exposure Rate Guide'}
          type="ghost"
          height={48}
          disabled={shouldShowRateGuideOnHome}
          containerStyle={{ marginTop: 12 }}
          onPress={() => {
            mockExposureRateGuide();
          }}
        />

        {!FORCE_DISABLE_FEEDBACK_BY_SCREENSHOT && (
          <Button
            title={'Reset Screenshot-Report Tip'}
            type="ghost"
            height={48}
            containerStyle={{ marginTop: 12 }}
            disabled={!viewedHomeTip}
            onPress={() => {
              mockResetViewedHomeTip();
            }}
          />
        )}
      </View>

      <View style={[styles.secondarySectionHeader, { marginTop: 24 }]}>
        <Text
          style={[
            styles.secondarySectionTitle,
            { fontSize: 24, marginLeft: 2 },
          ]}>
          Home Animations
        </Text>
      </View>

      <View
        style={[styles.secondarySectionContent, { flexDirection: 'column' }]}>
        <Button
          title={'Reset Home Multiple Tabs Guide'}
          type="ghost"
          height={48}
          disabled={!multiTabs20251205Viewed}
          containerStyle={{ marginTop: 0 }}
          onPress={() => {
            toggleViewedGuidance('multiTabs20251205Viewed', false);
          }}
        />
      </View>
    </View>
  );
}

function DevSwitchBatchRevoke() {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const { mockBatchRevokeSetting, setMockBatchRevoke } = useMockBatchRevoke();
  const [ethGasUsdLimit, setEthGasAsUsdLimit] = React.useState(
    mockBatchRevokeSetting.DEBUG_ETH_GAS_USD_LIMIT.toString(),
  );
  const [otherChainGasUsdLimit, setOtherChainGasUsdLimit] = React.useState(
    mockBatchRevokeSetting.DEBUG_OTHER_CHAIN_GAS_USD_LIMIT.toString(),
  );

  return (
    <View style={styles.showCaseRowsContainer}>
      <View style={styles.secondarySectionHeader}>
        <Text
          style={[
            styles.secondarySectionTitle,
            { fontSize: 24, marginLeft: 2 },
          ]}>
          Mock Batch Revoke
        </Text>
      </View>

      <View
        style={[styles.secondarySectionContent, { flexDirection: 'column' }]}>
        <TouchableOpacity
          style={styles.switchRowWrapper}
          onPress={() => {
            setMockBatchRevoke(
              'DEBUG_MOCK_SUBMIT',
              !mockBatchRevokeSetting.DEBUG_MOCK_SUBMIT,
            );
          }}>
          <AppSwitch2024
            onValueChange={val => setMockBatchRevoke('DEBUG_MOCK_SUBMIT', val)}
            value={mockBatchRevokeSetting.DEBUG_MOCK_SUBMIT}
          />
          <Text style={styles.switchLabel}>
            {mockBatchRevokeSetting.DEBUG_MOCK_SUBMIT ? 'Enabled' : 'Disabled'}
          </Text>
        </TouchableOpacity>

        <View style={[styles.rowWrapper, { marginTop: 12 }]}>
          <NextInput
            fieldName="ETH_GAS_USD_LIMIT"
            inputProps={{
              value: ethGasUsdLimit,
              onChangeText: setEthGasAsUsdLimit,
              keyboardType: 'decimal-pad',
              placeholder: 'ETH_GAS_USD_LIMIT',
              returnKeyType: 'done',
              onBlur: () => {
                setMockBatchRevoke(
                  'DEBUG_ETH_GAS_USD_LIMIT',
                  parseFloat(ethGasUsdLimit) || 0,
                );
              },
            }}
          />
        </View>

        <View style={[styles.rowWrapper, { marginTop: 12 }]}>
          <NextInput
            fieldName="OTHER_CHAIN_GAS_USD_LIMIT"
            inputProps={{
              value: otherChainGasUsdLimit,
              onChangeText: setOtherChainGasUsdLimit,
              keyboardType: 'decimal-pad',
              placeholder: 'OTHER_CHAIN_GAS_USD_LIMIT',
              returnKeyType: 'done',
              onBlur: () => {
                setMockBatchRevoke(
                  'DEBUG_OTHER_CHAIN_GAS_USD_LIMIT',
                  parseFloat(otherChainGasUsdLimit) || 0,
                );
              },
            }}
          />
        </View>

        <TouchableOpacity
          style={[styles.switchRowWrapper, { marginTop: 12 }]}
          onPress={() => {
            setMockBatchRevoke(
              'DEBUG_SIMULATION_FAILED',
              !mockBatchRevokeSetting.DEBUG_SIMULATION_FAILED,
            );
          }}>
          <AppSwitch2024
            onValueChange={val =>
              setMockBatchRevoke('DEBUG_SIMULATION_FAILED', val)
            }
            value={mockBatchRevokeSetting.DEBUG_SIMULATION_FAILED}
          />
          <Text style={styles.switchLabel}>
            {mockBatchRevokeSetting.DEBUG_SIMULATION_FAILED
              ? 'Enabled Simulation Failure'
              : 'Disabled Simulation Failure'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

async function importWalletConnectAddress({
  address,
  brandName,
  realBrandName,
  realBrandUrl,
}: {
  address: string;
  brandName: string;
  realBrandName?: string;
  realBrandUrl?: string;
}) {
  const keyring = await getKeyring<MockWalletConnectKeyring>(
    KEYRING_TYPE.WalletConnectKeyring,
  );

  keyring.setAccountToAdd({
    address,
    brandName,
    realBrandName,
    realBrandUrl,
  });

  await keyringService.addNewAccount(keyring as any);
}

function DevMock() {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const handleAddWalletConnectAddresses = React.useCallback(() => {
    importWalletConnectAddress({
      address: '0x5853eD4f26A3fceA565b3FBC698bb19cdF6DEB85',
      brandName: 'MetaMask',
    });
    importWalletConnectAddress({
      address: '0x12F5DF67c01050482E182ed51F962b873F1AcDF4',
      brandName: 'Bitget',
    });
    importWalletConnectAddress({
      address: '0x5eF0CfAe4e0a2f7BcC50e4A4e0a2f7BcC50e4A4e',
      brandName: 'TP',
    });
    importWalletConnectAddress({
      address: '0xdc7b8245Cc165d7994646e063077F5F1a5D9d461',
      brandName: 'Rainbow',
    });
  }, []);

  const { dappsViewConfig, toggleUseShortConfig } = useDappsViewConfig();

  const { resetSceneAccountInfo } = useResetSceneAccountInfo();

  return (
    <View style={styles.showCaseRowsContainer}>
      <View style={styles.secondarySectionHeader}>
        <Text
          style={[
            styles.secondarySectionTitle,
            { fontSize: 24, marginLeft: 2 },
          ]}>
          Generate Mock Data
        </Text>
      </View>

      <View
        style={[styles.secondarySectionContent, { flexDirection: 'column' }]}>
        <Button
          title={'Mock assets data <= 0.5.4'}
          type="ghost"
          height={48}
          onPress={() => {
            preferenceService._dangerouslySetTokenManageSettingMap(
              makeTokenManageSettingMap(),
            );

            Alert.alert(
              'Mock done',
              [
                `Address-indexed assets data has been mocked.`,
                `Restart the app to trigger the migrations.`,
              ].join('\n'),
              [
                { text: 'OK', onPress: makeNoop },
                {
                  text: 'Exit App',
                  style: 'destructive',
                  onPress: () => {
                    RNHelpers.forceExitApp();
                  },
                },
              ],
            );
          }}
        />

        <Button
          title={'Add WalletConnect addresses'}
          type="ghost"
          height={48}
          containerStyle={{ marginTop: 12 }}
          onPress={() => {
            handleAddWalletConnectAddresses();
          }}
        />

        <Button
          title={'Reset Scene Account'}
          type="ghost"
          height={48}
          containerStyle={{ marginTop: 12 }}
          onPress={() => {
            resetSceneAccountInfo();
          }}
        />

        {/* <Button
          title={`Dapp WebView Expire ${formatTimeReadable(
            dappsViewConfig.expireDuration / 1000,
          )}`}
          type="ghost"
          height={48}
          containerStyle={{ marginTop: 12 }}
          onPress={() => {
            toggleUseShortConfig();
          }}
        /> */}

        <Button
          title={`Log Feedback Extra`}
          type="ghost"
          height={48}
          containerStyle={{ marginTop: 12 }}
          onPress={async () => {
            const extraInfo = await getScreenshotFeedbackExtra({
              totalBalanceText: 'testValue',
            });
            console.debug('[debug] Feedback Extra Info:', extraInfo);
          }}
        />
      </View>
    </View>
  );
}

function DevSwitches(): JSX.Element {
  const { styles, colors2024, colors } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  const navigation = useNavigation();

  return (
    <NormalScreenContainer
      style={styles.screen}
      noHeader
      overwriteStyle={{ backgroundColor: colors['neutral-card-1'] }}>
      <ScrollView
        nestedScrollEnabled={false}
        contentContainerStyle={styles.screenScrollableView}
        horizontal={false}>
        <Text style={styles.areaTitle}>Mock</Text>
        <DevMock />

        <Text style={styles.areaTitle}>Security</Text>
        <DevSwitchAboutScreenProtection />
        <DevSwitchAboutExpData />
        <DevSwitchAboutAutoLock />

        <Text style={styles.areaTitle}>Cloud Drive</Text>
        <DevTestCloudDrive />

        <Text style={styles.areaTitle}>Home Notifications</Text>
        <DevTestHomeCenterArea />

        <Text style={styles.areaTitle}>Batch Revoke</Text>
        <DevSwitchBatchRevoke />
      </ScrollView>
    </NormalScreenContainer>
  );
}

const CONTENT_W = Dimensions.get('screen').width - 24;
const getStyles = createGetStyles2024(ctx =>
  StyleSheet.create({
    screen: {
      backgroundColor: 'black',
      flexDirection: 'column',
      justifyContent: 'center',
      height: '100%',
    },
    areaTitle: {
      fontSize: 36,
      marginBottom: 12,
      color: ctx.colors2024['neutral-title-1'],
    },
    screenScrollableView: {
      minHeight: '100%',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      // marginTop: 12,
      paddingHorizontal: 12,
      paddingBottom: 64,
      // ...makeDebugBorder(),
    },
    showCaseRowsContainer: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',

      paddingTop: 16,
      paddingBottom: 12,
      borderTopWidth: 2,
      borderStyle: 'dotted',
      borderTopColor: ctx.colors2024['neutral-foot'],
    },
    secondarySectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      marginBottom: 12,
    },
    secondarySectionTitle: {
      color: ctx.colors2024['blue-default'],
      textAlign: 'left',
      fontSize: 24,
    },
    secondarySectionContent: {
      flexDirection: 'column',
    },
    switchRowWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      width: '100%',
      gap: 4,
    },
    switchLabel: {
      fontSize: 16,
      color: ctx.colors2024['neutral-title-1'],
    },
    rowWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      width: '100%',
    },
    rowFieldLabel: {
      fontSize: 16,
      color: ctx.colors2024['neutral-title-1'],
    },
    label: {
      fontSize: 16,
      color: ctx.colors2024['neutral-title-1'],
    },
    labelIcon: { width: 24, height: 24 },
    propertyDesc: {
      flexDirection: 'row',
      width: '100%',
      maxWidth: CONTENT_W,
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
    },
    propertyType: {
      color: ctx.colors2024['blue-default'],
      fontSize: 16,
    },

    buttonGroup: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    btnOnGroup: {
      flexShrink: 1,
      width: '100%',
    },
  }),
);

export default DevSwitches;
