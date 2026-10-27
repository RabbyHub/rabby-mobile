/* eslint-disable @typescript-eslint/no-shadow */
import RcIconRight from '@/assets/icons/custom-testnet/quick-add-right.svg';
import {
  AppBottomSheetModal,
  AppBottomSheetModalTitle,
} from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { apiCustomTestnet } from '@/core/apis';
import type {
  TestnetChain,
  TestnetChainBase,
} from '@/core/services/customTestnetService';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { matomoRequestEvent } from '@/utils/analytics';
import { useMemoizedFn, useRequest } from 'ahooks';
import React, {
  useEffect,
  useImperativeHandle,
  useState,
  type Ref,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, TouchableWithoutFeedback, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useCustomTestnetForm } from '../hooks/useCustomTestnetForm';
import { AddFromChainList } from './AddFromChainList';
import { CustomTestnetForm } from './CustomTestnetForm';
import {
  BOTTOM_BUTTON_DOUBLE_HEIGHT,
  BOTTOM_BUTTON_TITLE_STYLE,
  BOTTOM_BUTTON_TOP_OFFSET,
  BOTTOM_BUTTON_GAP,
  getBottomButtonBottomOffset,
  RootNames,
} from '@/constant/layout';
import AutoLockView from '@/components/AutoLockView';
import { ConfirmModifyRpcModal } from './ConfirmModifyRpcModal';
import { navigateDeprecated } from '@/utils/navigation';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { createGetStyles2024 } from '@/utils/styles';
import { Text } from '@/components/Typography';

type Props = {
  isEdit?: boolean;
  data?: TestnetChainBase | null;
  visible: boolean;
  onCancel(): void;
  onConfirm(values: TestnetChain): void;
  // onChange?: (values: Partial<TestnetChainBase>) => void;
  height?: number;
};
export type EditCustomTestnetPopupType = {
  doBack: () => void;
};
export const EditCustomTestnetPopup = ({
  data,
  visible,
  onCancel,
  onConfirm,
  isEdit,
  // onChange,
  ref,
}: Props & { ref?: Ref<EditCustomTestnetPopupType> }) => {
  const [isShowAddFromChainList, setIsShowAddFromChainList] = useState(false);
  const [isShowModifyRpcModal, setIsShowModifyRpcModal] = useState(false);
  const { colors2024, styles } = useTheme2024({ getStyle: getStyles });
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
    (data: TestnetChainBase) => {
      return isEdit
        ? apiCustomTestnet.updateCustomTestnet(data)
        : apiCustomTestnet.addCustomTestnet(data);
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
    const res = await runAddTestnet(values);
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
        backgroundStyle={
          isShowAddFromChainList ? styles.quickAddBackground : styles.background
        }
        handleStyle={
          isShowAddFromChainList ? styles.quickAddBackground : styles.background
        }
        handleIndicatorStyle={styles.handleIndicator}
        ref={modalRef}
        onDismiss={onCancel}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustPan"
        enableDynamicSizing={false}
        enableHandlePanningGesture
        enableContentPanningGesture
        enablePanDownToClose>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <AutoLockView as="View" style={styles.content}>
            <View style={[styles.container]}>
              <AppBottomSheetModalTitle
                style={styles.modalTitle}
                title={t(
                  isEdit
                    ? 'page.customTestnet.editTitle'
                    : 'page.customRpc.EditCustomTestnetModal.title',
                )}
              />
              <View style={styles.quickAddAsRow}>
                <TouchableOpacity
                  onPress={() => {
                    setIsShowAddFromChainList(true);
                  }}
                  style={[styles.quickAdd]}>
                  <Text style={styles.quickAddText}>
                    {t('page.customRpc.EditCustomTestnetModal.quickAdd')}
                  </Text>
                  <RcIconRight color={colors2024['neutral-body']} />
                </TouchableOpacity>
              </View>

              <BottomSheetScrollView
                style={styles.formScrollView}
                contentContainerStyle={styles.formContent}
                keyboardShouldPersistTaps="handled">
                <CustomTestnetForm
                  formik={formik}
                  isEdit={isEdit}
                  __IN_BOTTOM_SHEET__
                />
              </BottomSheetScrollView>
              <View style={styles.footer}>
                <Button
                  onPress={onCancel}
                  title={t('global.cancel')}
                  height={BOTTOM_BUTTON_DOUBLE_HEIGHT}
                  titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
                  type="plain"
                  containerStyle={styles.btnContainer}
                />
                <Button
                  title={t('global.confirm')}
                  height={BOTTOM_BUTTON_DOUBLE_HEIGHT}
                  titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
                  onPress={handleSubmit}
                  loading={loading}
                  containerStyle={styles.btnContainer}
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
};

const getStyles = createGetStyles2024(({ colors2024, safeAreaInsets }) => ({
  content: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  background: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  quickAddBackground: {
    backgroundColor: colors2024['neutral-bg-0'],
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  handleIndicator: {
    width: 50,
    height: 6,
    backgroundColor: colors2024['neutral-line'],
  },
  modalTitle: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '900',
    fontSize: 20,
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
    paddingTop: 28,
    marginBottom: 22,
  },
  quickAddAsRow: {
    paddingHorizontal: 20,
    marginBottom: 22,
  },
  quickAdd: {
    height: 56,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    backgroundColor: colors2024['brand-light-1'],
  },
  quickAddText: {
    flex: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
  },
  formScrollView: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    gap: BOTTOM_BUTTON_GAP,
    paddingHorizontal: 20,
    paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
    paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
    backgroundColor: colors2024['neutral-bg-1'],
  },
  btnContainer: {
    flex: 1,
  },
}));
