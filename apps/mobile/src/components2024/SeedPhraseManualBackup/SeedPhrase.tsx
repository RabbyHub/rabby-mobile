import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import { useMemoizedFn } from 'ahooks';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { TouchableWithoutFeedback } from 'react-native-gesture-handler';
import { BlurView } from '@react-native-community/blur';
import { createGetStyles2024 } from '@/utils/styles';
import { default as RcIconEye } from '@/assets/icons/nextComponent/IconEye.svg';
import {
  AppBottomSheetModal,
  AppBottomSheetModalTitle,
} from '@/components/customized/BottomSheet';
import _ from 'lodash';
import { Button } from '../Button';
import { WordsMatrix } from '@/components2024/WordsMatrix';
import { replaceToFirst } from '@/utils/navigation';
import { toast, toastWithIcon } from '@/components2024/Toast';
import { addKeyringAndactiveAndPersistAccounts } from '@/core/apis/mnemonic';
import { keyringService } from '@/core/services';
import { RootNames } from '@/constant/layout';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useCreateAddressProc } from '@/hooks/address/useNewUser';
import Clipboard from '@react-native-clipboard/clipboard';
import IconScreenshotSecure from '@/assets2024/icons/address/screenshot-secure.svg';
import IconCopySecure from '@/assets2024/icons/address/copy-secure.svg';
import { useSheetModal } from '@/hooks/useSheetModal';
import { makeBottomSheetProps } from '../GlobalBottomSheetModal/utils-help';
import IconCopy from '@/assets2024/icons/common/copy-brand.svg';
import RNScreenshotPrevent from '@/core/native/RNScreenshotPrevent';
import { storeApiScreenshotReport } from '@/components/Screenshot/hooks';
import IconWarning from '@/assets/icons/address/warning-rouned.svg';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '../GlobalBottomSheetModal';
import { MODAL_NAMES } from '../GlobalBottomSheetModal/types';
import { onCopiedSensitiveData } from '@/utils/clipboard';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  tipsWrapper: {
    minHeight: 66,
    display: 'flex',
    flexWrap: 'wrap',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    // ...makeDebugBorder(),
  },
  warnWrapper: {
    padding: 12,
    paddingLeft: 34,
    backgroundColor: colors2024['red-light-1'],
    borderRadius: 8,
  },
  blueText: {
    marginHorizontal: 4,
    fontWeight: '700',
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    lineHeight: 22,
    fontSize: 17,
  },
  warnIcon: {
    position: 'absolute',
    left: 12,
    top: 12,
    width: 18,
    height: 18,
  },
  tipsText: {
    lineHeight: 22,
    color: colors2024['neutral-secondary'],
    fontWeight: '400',
    fontSize: 17,
    marginTop: 0,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
  },
  warningTips: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'justify',
  },
  verifyTipsText: {
    width: '100%',
    maxWidth: 190,
    // ...makeDebugBorder(),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  listText: {
    color: colors2024['neutral-title-1'],
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 20,
    // textAlign: 'center',
    // width: '95%',
    flex: 1,
    fontFamily: 'SF Pro Rounded',
  },
  title: {
    flexShrink: 0,
    fontWeight: '900',
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    marginBottom: 12,
    paddingTop: 8,
  },
  dotItem: {
    marginLeft: 8,
    marginRight: 0,
    fontSize: 32,
    transform: [{ translateY: -12 }],
    // flex: 1,
    width: 16,
  },
  listContainer: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    display: 'flex',
    width: '100%',
    gap: 12,
  },
  listItem: {
    // gap: 4,
    backgroundColor: colors2024['neutral-bg-2'],
    paddingHorizontal: 12,
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    display: 'flex',
  },
  agreementWrapper: {
    height: 32,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    flexWrap: 'nowrap',
    marginTop: 12,
    // paddingHorizontal: 10,
  },
  agreementCheckbox: {
    marginRight: 6,
    position: 'relative',
    top: 1,
  },
  agreementTextWrapper: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  agreementText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors2024['neutral-foot'],
  },
  userAgreementTouchText: {
    fontSize: 14,
    color: colors2024['blue-default'],
  },
  userAgreementTouchable: {
    padding: 0,
  },
  rootContainer: {
    paddingHorizontal: 24,
    paddingBottom: 0,
    overflow: 'hidden',
    height: '100%',
    // position: 'relative',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-1'],
    // ...makeDebugBorder('red'),
    // ...makeDevOnlyStyle({
    //   backgroundColor: 'green',
    // }),
  },
  container: {
    flexShrink: 1,
    paddingBottom: 0,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
  },
  btnWrapper: {
    flexShrink: 0,
    width: '100%',
    paddingTop: SIZES.btnContainerTopOffset,
    paddingBottom: SIZES.btnContainerBottom, // original, will be overidden in `style`
    // ...makeDevOnlyStyle({
    //   backgroundColor: 'red',
    // }),
  },
  btnContainer: {
    width: '100%',
    height: 56,
  },
  content: {
    width: '100%',
    flex: 1,
  },
  wordContainer: {
    position: 'relative',
    marginTop: 12,
    flexShrink: 1,
    height: '100%',
    flexDirection: 'column',
  },
  blurViewContainer: {
    maxHeight: 430,
    overflow: 'hidden',
  },
  wordsMatrix: {
    // ...makeDebugBorder('pink'),
    marginRight: -8,
  },
  mask: {
    zIndex: 1,
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  maskWraper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  copyBtnWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  copyBtn: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors2024['brand-default'],
    borderRadius: 8,
    gap: 10,
  },
  copyBtnIcon: {
    width: 17,
    height: 17,
    color: colors2024['brand-default'],
  },
  copyBtnText: {
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 18,
  },
  tapText: {
    color: colors2024['neutral-InvertHighlight'],
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 22,
    marginTop: 16,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
  },
  tapDesc: {
    color: colors2024['neutral-InvertHighlight'],
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
  },

  secure: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  secureLogo: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  secureTitle: {
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '800',
    lineHeight: 24,
    marginTop: 8,
  },
  secureSubTitle: {
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 22,
    paddingTop: 8,
    paddingBottom: 24,
  },

  secureDescList: {
    gap: 8,
    marginBottom: 30,
  },

  secureDescBox: {
    backgroundColor: colors2024['neutral-bg-2'],
    display: 'flex',
    paddingVertical: 16,
    paddingHorizontal: 20,
    paddingLeft: 24,
    borderRadius: 12,
  },
  secureDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors2024['neutral-title-1'],
    top: 24,
    left: 12,
  },
  secureDescText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'justify',
  },

  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  copyCancelBtn: {
    height: 56,
    paddingVertical: 16,
    paddingHorizontal: 38,
    backgroundColor: colors2024['neutral-line'],
    borderRadius: 12,
  },
  copyCancelText: {
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 24,
  },
  copyConfirmContainer: {
    height: 56,
    flex: 1,
  },
  copyConfirmTitle: {
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 24,
  },
}));

interface Props {
  onConfirm: () => void;
  delaySetPassword?: boolean;
  readMode?: boolean;
  seedPhraseData?: string;
}

const SIZES = {
  btnContainerTopOffset: 28,
  btnContainerBottom: 56,
};

type SecureType = 'copy' | 'screenshot';

const VALIDATE_COUNT = 3;

export const SeedPhrase: React.FC<Props> = ({
  onConfirm, // close modal
  delaySetPassword,
  readMode,
  seedPhraseData,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { seedPharseData, addressList, confirmPassword } =
    useCreateAddressProc();
  const { t } = useTranslation();
  const [isHidden, setIsHidden] = React.useState(true);
  const [isSelect, setIsSelect] = React.useState(false);
  const [selectArr, setSelectArr] = React.useState<number[]>([]);

  const [showSecureTips, setShowSecureTips] = React.useState(false);
  const [secureType, setSecureType] = React.useState<SecureType>('copy');

  const appThemeMode = useGetBinaryMode();
  const {
    seedPhrase,
    alias,
    address,
    accountsToCreate = [],
  } = useMemo(() => {
    if (readMode && seedPhraseData) {
      return {
        seedPhrase: seedPhraseData,
        alias: '',
        address: '',
        accountsToCreate: [],
      };
    }
    return {
      seedPhrase: seedPharseData,
      alias: addressList?.[0]?.aliasName || '',
      address: addressList?.[0]?.address || '',
      accountsToCreate: addressList,
    };
  }, [readMode, seedPhraseData, seedPharseData, addressList]);

  const [loading, setLoading] = React.useState(false);
  const [shuffleCount, setShuffleCount] = React.useState(0);
  const words = useMemo(() => seedPhrase.split(' ') || [], [seedPhrase]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shuffledWords = useMemo(() => _.shuffle(words), [words, shuffleCount]);
  const shuffledNumbers = useMemo(
    () =>
      _.sortBy(
        _.shuffle(_.range(1, words.length + 1)).slice(0, VALIDATE_COUNT),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [words, shuffleCount],
  );
  const onSelect = useCallback(
    (index: number) => {
      if (isHidden) {
        return;
      }

      const idx = selectArr.indexOf(index);
      const newArr = [...selectArr];
      if (idx > -1) {
        newArr.splice(idx, 1);
      } else {
        if (selectArr.length < VALIDATE_COUNT) {
          newArr.push(index);
        }
      }
      setSelectArr(newArr);
    },
    [selectArr, isHidden],
  );

  const validate = useMemoizedFn(() => {
    if (selectArr.length !== VALIDATE_COUNT) {
      return false;
    }
    return selectArr.every((n, index) => {
      const number = shuffledNumbers?.[index];
      const word = shuffledWords?.[n];
      if (number == null || !word) {
        return false;
      }
      return words[number - 1] === word;
    });
  });

  const handleVerify = useMemoizedFn(async () => {
    if (readMode) {
      return;
    }
    if (validate()) {
      const mnemonics = seedPhrase;
      const passphrase = '';
      setLoading(true);
      const toastHide = toastWithIcon(() => (
        // eslint-disable-next-line react-native/no-inline-styles
        <ActivityIndicator style={{ marginRight: 6 }} />
      ))('Setting up address', {
        duration: 1e6,
        position: toast.positions.CENTER,
        hideOnPress: false,
      });
      try {
        await new Promise(resolve => setTimeout(resolve, 1));
        if (delaySetPassword) {
          const res = await confirmPassword();
          if (!res) {
            // error set password
            toastHide();
            setLoading(false);
            return;
          }
        }
        onConfirm?.();
        await addKeyringAndactiveAndPersistAccounts(
          mnemonics,
          passphrase,
          accountsToCreate as any,
          true,
        );
        keyringService.removePreMnemonics();
        replaceToFirst(RootNames.StackAddress, {
          screen: RootNames.ImportSuccess2024,
          params: {
            type: KEYRING_TYPE.HdKeyring,
            brandName: KEYRING_CLASS.MNEMONIC,
            isFirstImport: true,
            isFirstCreate: true,
            address: [address],
            mnemonics,
            passphrase,
            isExistedKR: false,
            alias,
          },
        });
      } catch (e) {
        console.log('addMnemonicKeyringAndGotoSuccessScreen error');
      } finally {
        setLoading(false);
        toastHide();
      }
    } else {
      toast.error(t('page.nextComponent.createNewAddress.verificationFailed'));
      setShuffleCount(val => val + 1);
      setSelectArr([]);
    }
  });

  const handleGoSelect = useMemoizedFn(() => {
    if (readMode) {
      onConfirm();
      return;
    }
    setIsSelect(true);
  });

  const currentSelecting = useMemo(
    () => !isHidden && isSelect,
    [isSelect, isHidden],
  );

  const { safeSizes } = useSafeAndroidBottomSizes({
    ...SIZES,
  });

  const WordMatrixWrapper = isHidden ? View : BottomSheetScrollView;

  useEffect(() => {
    if (isHidden) {
      return;
    }
    storeApiScreenshotReport.markIsScreenshotReportFree(true);
    const { remove } = RNScreenshotPrevent.onUserDidTakeScreenshot(() => {
      if (showSecureTips) {
        return;
      }
      setShowSecureTips(false);
      setTimeout(() => {
        setSecureType('screenshot');
        setShowSecureTips(true);
      }, 100);
    });
    return () => {
      storeApiScreenshotReport.markIsScreenshotReportFree(false);
      remove();
    };
  }, [isHidden, showSecureTips]);

  return (
    <View style={[styles.rootContainer]}>
      <View style={[styles.container]}>
        <BottomSheetHandlableView>
          <AppBottomSheetModalTitle
            style={styles.title}
            title={
              !currentSelecting
                ? t('page.nextComponent.createNewAddress.BackupYourSeedPhrase')
                : t('page.nextComponent.createNewAddress.VerifyDownSeedPhrase')
            }
          />
          <View
            style={[
              styles.tipsWrapper,
              !currentSelecting && styles.warnWrapper,
            ]}>
            {!currentSelecting ? (
              <>
                <Text style={[styles.tipsText, styles.warningTips]}>
                  {readMode
                    ? t('page.backupSeedPhrase.alert')
                    : t('page.nextComponent.createNewAddress.WriteSeedPhrase')}
                </Text>
                <IconWarning style={styles.warnIcon} />
              </>
            ) : (
              <View style={styles.verifyTipsText}>
                <Text style={styles.tipsText}>
                  {t('page.nextComponent.createNewAddress.selectWords')}
                </Text>
                <Text style={styles.blueText}>
                  {`#${shuffledNumbers[0]}, #${shuffledNumbers[1]}, and #${shuffledNumbers[2]}`}
                </Text>
                <Text style={styles.tipsText}>
                  {t('page.nextComponent.createNewAddress.inOrder')}
                </Text>
              </View>
            )}
          </View>
        </BottomSheetHandlableView>
        <WordMatrixWrapper
          style={[styles.wordContainer, isHidden && styles.blurViewContainer]}>
          <WordsMatrix
            shuffledNumbers={shuffledNumbers}
            words={!currentSelecting ? words : shuffledWords}
            selectArr={selectArr}
            isSelectIng={currentSelecting}
            onSelect={onSelect}
            style={[styles.wordsMatrix]}
          />
          {isHidden && (
            <BlurView
              style={styles.mask}
              blurType={appThemeMode ?? 'light'}
              blurAmount={3}>
              <View style={styles.maskWraper}>
                <TouchableWithoutFeedback
                  onPress={() => {
                    setIsHidden(false);
                  }}>
                  <RcIconEye />
                </TouchableWithoutFeedback>
                <Text style={styles.tapText}>
                  Tap to reveal your seed phrase
                </Text>
                <Text style={styles.tapDesc}>
                  Make sure no one is watching your screen.
                </Text>
              </View>
            </BlurView>
          )}

          {!isHidden && !currentSelecting ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
              }}>
              {readMode ? (
                <View style={styles.copyBtnWrapper}>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => {
                      const id = createGlobalBottomSheetModal2024({
                        name: MODAL_NAMES.SEED_PHRASE_QR_CODE,
                        bottomSheetModalProps: {
                          enableContentPanningGesture: true,
                          enablePanDownToClose: true,
                          rootViewType: 'BottomSheetScrollView',
                        },
                        preventScreenshotOnModalOpen: false,
                        data: words.join(' '),
                        onClose: () => {
                          removeGlobalBottomSheetModal2024(id);
                        },
                        onDone: () => {
                          removeGlobalBottomSheetModal2024(id);
                        },
                      });
                    }}>
                    <IconCopy style={styles.copyBtnIcon} />
                    <Text style={styles.copyBtnText}>
                      {t('page.backupSeedPhrase.showQrCode')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <View style={styles.copyBtnWrapper}>
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => {
                    setShowSecureTips(false);
                    setTimeout(() => {
                      setSecureType('copy');
                      setShowSecureTips(true);
                    }, 100);
                  }}>
                  <IconCopy style={styles.copyBtnIcon} />
                  <Text style={styles.copyBtnText}>{t('global.copy')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </WordMatrixWrapper>
      </View>

      <SecureBottomTips
        open={showSecureTips}
        type={secureType}
        copyRaw={words.join(' ')}
        onDismiss={() => {
          setShowSecureTips(false);
        }}
      />

      <View
        style={[
          styles.btnWrapper,
          { paddingBottom: safeSizes.btnContainerBottom },
        ]}>
        {(!isHidden || readMode) && (
          <>
            <Button
              disabled={currentSelecting && selectArr.length < 3}
              containerStyle={styles.btnContainer}
              loading={currentSelecting ? loading : false}
              type="primary"
              title={
                readMode
                  ? t('global.Done')
                  : currentSelecting
                  ? t('page.nextComponent.createNewAddress.Verify')
                  : t('global.Confirm')
              }
              onPress={currentSelecting ? handleVerify : handleGoSelect}
            />
          </>
        )}
      </View>
    </View>
  );
};

const SecureBottomTips = ({
  type,
  copyRaw,
  open,
  onDismiss,
}: {
  type: 'screenshot' | 'copy';
  copyRaw?: string;
  open: boolean;
  onDismiss?: () => void;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { sheetModalRef, toggleShowSheetModal } = useSheetModal(null);
  const { t } = useTranslation();
  const { height } = useWindowDimensions();

  const snapPoints = useMemo(() => {
    const oH = type === 'copy' ? 586 : 606;
    return [height > oH ? oH : '80%'];
  }, [height, type]);

  const { titleMapping, subTitleMapping, descMapping } = useMemo(() => {
    const titleMapping = {
      screenshot: t('page.nextComponent.screenshotSecureTip.title'),
      copy: t('page.nextComponent.copySeedPhraseSecureTip.title'),
    };

    const subTitleMapping = {
      screenshot: t('page.nextComponent.screenshotSecureTip.subTitle'),
      copy: t('page.nextComponent.copySeedPhraseSecureTip.subTitle'),
    };

    const descMapping = {
      screenshot: [
        t('page.nextComponent.screenshotSecureTip.tip1'),
        t('page.nextComponent.screenshotSecureTip.tip2'),
        t('page.nextComponent.screenshotSecureTip.tip3'),
      ],
      copy: [
        t('page.nextComponent.copySeedPhraseSecureTip.tip1'),
        t('page.nextComponent.copySeedPhraseSecureTip.tip2'),
        t('page.nextComponent.copySeedPhraseSecureTip.tip3'),
      ],
    };
    return {
      titleMapping,
      subTitleMapping,
      descMapping,
    };
  }, [t]);

  const onCopy = () => {
    Clipboard.setString(copyRaw || '');
    onCopiedSensitiveData({ type: 'seedPhrase' });

    toggleShowSheetModal('destroy');
  };

  useEffect(() => {
    return () => {
      toggleShowSheetModal?.('destroy');
    };
  }, [toggleShowSheetModal]);

  useEffect(() => {
    if (open) {
      toggleShowSheetModal?.('destroy');
    }
    toggleShowSheetModal?.(open ? true : 'destroy');
  }, [toggleShowSheetModal, open]);

  return (
    <AppBottomSheetModal
      {...makeBottomSheetProps({
        linearGradientType: 'bg1',
        colors: colors2024,
      })}
      ref={sheetModalRef}
      snapPoints={snapPoints}
      enableDismissOnClose
      onDismiss={onDismiss}>
      <BottomSheetScrollView>
        <View style={styles.secure}>
          <View style={styles.secureLogo}>
            {type === 'screenshot' && <IconScreenshotSecure />}
            {type === 'copy' && <IconCopySecure />}
          </View>
          <Text style={styles.secureTitle}>{titleMapping[type]}</Text>
          <Text style={styles.secureSubTitle}>{subTitleMapping[type]}</Text>
          <View style={styles.secureDescList}>
            {descMapping[type].map(desc => (
              <View style={styles.secureDescBox} key={desc}>
                <Text style={styles.secureDescText}>{desc}</Text>
                <View style={styles.secureDot} />
              </View>
            ))}
          </View>

          <View>
            {type === 'copy' && (
              <View style={styles.copyRow}>
                <TouchableOpacity
                  style={styles.copyCancelBtn}
                  onPress={() => {
                    toggleShowSheetModal('destroy');
                  }}>
                  <Text style={styles.copyCancelText}>
                    {t('global.Cancel')}
                  </Text>
                </TouchableOpacity>
                <Button
                  type="primary"
                  containerStyle={styles.copyConfirmContainer}
                  titleStyle={styles.copyConfirmTitle}
                  title={t(
                    'page.nextComponent.copySeedPhraseSecureTip.copyAnyway',
                  )}
                  onPress={onCopy}
                />
              </View>
            )}

            {type === 'screenshot' && (
              <Button
                title={t('global.GotIt')}
                onPress={() => {
                  toggleShowSheetModal('destroy');
                }}
              />
            )}
          </View>
        </View>
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};
