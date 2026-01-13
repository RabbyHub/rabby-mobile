/* eslint-disable @typescript-eslint/no-shadow */
import RcIconFlash from '@/assets/icons/custom-testnet/flash-cc.svg';
import RcIconRight from '@/assets/icons/custom-testnet/right-cc.svg';
import {
  AppBottomSheetModal,
  AppBottomSheetModalTitle,
  Button,
} from '@/components';
import { AppColorsVariants } from '@/constant/theme';
import { apiCustomTestnet } from '@/core/apis';
import {
  TestnetChain,
  TestnetChainBase,
} from '@/core/services/customTestnetService';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { matomoRequestEvent } from '@/utils/analytics';
import { useMemoizedFn, useRequest } from 'ahooks';
import React, { useEffect, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
  Keyboard,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useCustomTestnetForm } from '../hooks/useCustomTestnetForm';
import { AddFromChainList } from './AddFromChainList';
import { CustomTestnetForm } from './CustomTestnetForm';
import { ModalLayouts, RootNames } from '@/constant/layout';
import AutoLockView from '@/components/AutoLockView';
import { ConfirmModifyRpcModal } from './ConfirmModifyRpcModal';
import { navigateDeprecated } from '@/utils/navigation';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';

type Props = {
  isEdit?: boolean;
  data?: TestnetChainBase | null;
  visible: boolean;
  onCancel(): void;
  onConfirm(values: TestnetChain): void;
  // onChange?: (values: Partial<TestnetChainBase>) => void;
  height?: number;
  ctx?: {
    ga?: {
      source?: string;
    };
  };
};
export type EditCustomTestnetPopupType = {
  doBack: () => void;
};
export const EditCustomTestnetPopup = React.forwardRef<
  EditCustomTestnetPopupType,
  Props
>(
  (
    {
      data,
      visible,
      onCancel,
      onConfirm,
      isEdit,
      // onChange,
      ctx,
    },
    ref,
  ) => {
    const [isShowAddFromChainList, setIsShowAddFromChainList] = useState(false);
    const [isShowModifyRpcModal, setIsShowModifyRpcModal] = useState(false);
    const { colors, styles } = useTheme2024({ getStyle: getStyles });
    const { t } = useTranslation();
    const formik = useCustomTestnetForm({
      onSubmit(values) {},
    });

    const resetForm = useMemoizedFn(() => {
      formik.resetForm();
    });

    const setFormValues = useMemoizedFn((values: Partial<TestnetChainBase>) => {
      formik.setValues(values);
    });

    const { loading, runAsync: runAddTestnet } = useRequest(
      (
        data: TestnetChainBase,
        ctx?: {
          ga?: {
            source?: string;
          };
        },
      ) => {
        return isEdit
          ? apiCustomTestnet.updateCustomTestnet(data)
          : apiCustomTestnet.addCustomTestnet(data, ctx);
      },
      {
        manual: true,
      },
    );

    const handleSubmit = async () => {
      const values = formik.values as any;
      const errors = await formik.validateForm();
      const isValid = Object.keys(errors || {}).length === 0;
      if (!isValid) {
        return;
      }
      const res = await runAddTestnet(values, ctx);
      if ('error' in res) {
        formik.setFieldError(res.error.key, res.error.message);

        // if (!isEdit && res.error.status === 'alreadySupported') {
        //   setIsShowModifyRpcModal(true);
        //   // setFormValues(formik.values);
        // }
      } else {
        onConfirm?.(res);
      }
    };

    useEffect(() => {
      if (data && visible) {
        setFormValues(data);
      }
    }, [data, setFormValues, visible]);

    useEffect(() => {
      if (!visible) {
        resetForm();
      }
    }, [resetForm, visible]);

    const modalRef = React.useRef<AppBottomSheetModal>(null);
    React.useEffect(() => {
      if (!visible) {
        modalRef.current?.close();
      } else {
        modalRef.current?.present();
      }
    }, [visible]);

    useEffect(() => {
      if (!visible) {
        setIsShowAddFromChainList(false);
      }
    }, [visible]);

    useImperativeHandle(ref, () => ({
      doBack: () => {
        if (isShowAddFromChainList) {
          setIsShowAddFromChainList(false);
        } else if (isShowModifyRpcModal) {
          setIsShowModifyRpcModal(false);
        } else {
          onCancel();
        }
      },
    }));

    return (
      <>
        <AppBottomSheetModal
          snapPoints={['80%']}
          ref={modalRef}
          onDismiss={onCancel}
          keyboardBlurBehavior="restore"
          // android_keyboardInputMode="adjustPan"
          android_keyboardInputMode="adjustPan"
          enableDynamicSizing={false}
          enableHandlePanningGesture
          enableContentPanningGesture
          enablePanDownToClose
          // footerComponent={props => {
          //   if (isShowAddFromChainList || isShowModifyRpcModal) {
          //     return null;
          //   }
          //   return (
          //     <BottomSheetFooter
          //       bottomInset={bottomOffset}
          //       animatedFooterPosition={props.animatedFooterPosition}>

          //     </BottomSheetFooter>
          //   );
          // }}
        >
          <TouchableWithoutFeedback
            style={{ flex: 1, height: '100%' }}
            onPress={Keyboard.dismiss}
            accessible={false}>
            <AutoLockView as="View" style={{ flex: 1, height: '100%' }}>
              <View style={[styles.container]}>
                <AppBottomSheetModalTitle
                  style={styles.modalTitle}
                  title={t('page.customRpc.EditCustomTestnetModal.title')}
                />
                <View style={styles.quickAddAsRow}>
                  <TouchableOpacity
                    onPress={() => {
                      setIsShowAddFromChainList(true);
                    }}
                    style={[styles.quickAdd]}>
                    <RcIconFlash color={colors['neutral-body']} />
                    <Text style={styles.quickAddText}>
                      {t('page.customRpc.EditCustomTestnetModal.quickAdd')}
                    </Text>
                    <RcIconRight color={colors['neutral-body']} />
                  </TouchableOpacity>
                </View>

                <BottomSheetScrollView style={styles.formScrollView}>
                  <CustomTestnetForm
                    formik={formik}
                    isEdit={isEdit}
                    __IN_BOTTOM_SHEET__
                  />
                </BottomSheetScrollView>
                <View
                  style={[
                    // styles.bsFooterContainer,
                    styles.footer,
                  ]}>
                  <Button
                    onPress={onCancel}
                    title={t('global.cancel')}
                    buttonStyle={[styles.buttonStyle]}
                    titleStyle={styles.btnCancelTitle}
                    type="white"
                    containerStyle={[
                      styles.btnContainer,
                      styles.btnCancelContainer,
                    ]}
                  />
                  <Button
                    title={t('global.confirm')}
                    buttonStyle={[
                      styles.buttonStyle,
                      { backgroundColor: colors['blue-default'] },
                    ]}
                    style={{
                      width: '100%',
                    }}
                    titleStyle={styles.btnConfirmTitle}
                    onPress={handleSubmit}
                    loading={loading}
                    containerStyle={[
                      styles.btnContainer,
                      styles.btnConfirmContainer,
                    ]}
                  />
                </View>
                <AddFromChainList
                  visible={isShowAddFromChainList}
                  onClose={() => {
                    setIsShowAddFromChainList(false);
                  }}
                  onSelect={item => {
                    formik.resetForm();
                    formik.setValues(item);
                    setIsShowAddFromChainList(false);
                    const source = ctx?.ga?.source || 'setting';
                    matomoRequestEvent({
                      category: 'Custom Network',
                      action: 'Choose ChainList Network',
                      label: `${source}_${String(item.id)}`,
                    });
                  }}
                />
              </View>
            </AutoLockView>
          </TouchableWithoutFeedback>
        </AppBottomSheetModal>
        <ConfirmModifyRpcModal
          visible={isShowModifyRpcModal}
          chainId={formik.values.id}
          rpcUrl={formik.values.rpcUrl}
          onCancel={() => {
            setIsShowModifyRpcModal(false);
          }}
          onConfirm={() => {
            setIsShowModifyRpcModal(false);
            onCancel?.();
            navigateDeprecated(RootNames.StackSettings, {
              screen: RootNames.CustomRPC,
              params: {
                chainId: formik.values.id!,
                rpcUrl: formik.values.rpcUrl!,
              },
            });
          }}
        />
      </>
    );
  },
);

const SIZES = {
  innerPx: 20,
  buttonHeight: 52,
  footerPt: 20,
  footerPb: 12,
  scrollViewPb: 20,
  footerHeight: 20 /* pt */ + 52 /* button height */ + 12 /* padding bottom */,
  containerPb: 20 + 52 + 12, // scrollViewPb + buttonHeight + footerPb + extra space
};

const getStyles = createGetStyles2024(({ colors, safeAreaInsets }) => {
  return {
    container: {
      height: '100%',
      flexDirection: 'column',
      paddingBottom: SIZES.containerPb + safeAreaInsets.bottom,
    },
    modalTitle: {
      paddingTop: ModalLayouts.titleTopOffset,
      // ...makeDebugBorder('green'),
      height: 36,
    },
    quickAddAsRow: {
      paddingHorizontal: SIZES.innerPx,
      // ...makeDebugBorder(),
      marginBottom: 20,
    },
    quickAdd: {
      borderRadius: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 16,
      backgroundColor: colors['blue-light-1'],
    },
    quickAddText: {
      flex: 1,
      fontSize: 16,
      lineHeight: 19,
      fontWeight: '500',
      color: colors['neutral-title-1'],
    },
    formScrollView: {
      height: '100%',
      flexShrink: 1,
      paddingHorizontal: SIZES.innerPx,
      paddingTop: 0,
      paddingBottom: SIZES.scrollViewPb,
      // ...makeDebugBorder('blue'),
    },
    // bsFooterContainer: {
    //   // ...makeDebugBorder('red'),
    //   height: SIZES.footerHeight,
    //   maxWidth: Dimensions.get('window').width,
    //   backgroundColor: colors['neutral-bg-1'],
    //   display: 'flex',
    //   flexDirection: 'row',
    //   gap: 16,
    //   justifyContent: 'space-between',
    //   borderTopColor: colors['neutral-line'],
    //   borderTopWidth: StyleSheet.hairlineWidth,
    //   paddingTop: SIZES.footerPt,
    //   paddingHorizontal: SIZES.innerPx,
    //   paddingBottom: SIZES.footerPb,
    // },
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      height: SIZES.footerHeight + safeAreaInsets.bottom,
      width: '100%',
      maxWidth: Dimensions.get('window').width,
      display: 'flex',
      flexDirection: 'row',
      gap: 16,
      justifyContent: 'space-between',
      borderTopColor: colors['neutral-line'],
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: SIZES.footerPt,
      paddingHorizontal: SIZES.innerPx,
      paddingBottom: SIZES.footerPb + safeAreaInsets.bottom,
    },
    btnContainer: {
      display: 'flex',
      height: SIZES.buttonHeight,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 8,
      flex: 1,
      maxWidth: '100%',
      minWidth: 0,
    },

    buttonStyle: {
      width: '100%',
      height: '100%',
    },
    btnCancelContainer: {
      borderColor: colors['blue-default'],
      borderWidth: StyleSheet.hairlineWidth,
    },
    btnCancelTitle: {
      color: colors['blue-default'],
      flex: 1,
    },
    btnConfirmContainer: {},
    btnConfirmTitle: {
      color: colors['neutral-title-2'],
      flex: 1,
    },
  };
});
