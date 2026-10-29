/* eslint-disable @typescript-eslint/no-shadow */
import RcIconRight from '@/assets/icons/custom-testnet/quick-add-right.svg';
import {
  AppBottomSheetModal,
  AppBottomSheetModalTitle,
} from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { apiCustomTestnet } from '@/core/apis';
import type {
  TestnetChain,
  TestnetChainBase,
} from '@/core/services/customTestnetService';
import { useTheme2024 } from '@/hooks/theme';
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
import { buttonTitleStyles } from '../buttonStyles';

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
export const EditCustomTestnetPopup = ({
  data,
  visible,
  onCancel,
  onConfirm,
  isEdit,
  // onChange,
  ctx,
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
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustPan"
        enableDynamicSizing={false}
        enableHandlePanningGesture
        enableContentPanningGesture
        enablePanDownToClose
        enableDismissOnClose
        {...makeBottomSheetProps({
          linearGradientType: 'bg1',
          colors: colors2024,
        })}>
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
                  titleStyle={buttonTitleStyles.double}
                  type="plain"
                  containerStyle={styles.btnContainer}
                />
                <Button
                  title={t('global.confirm')}
                  height={BOTTOM_BUTTON_DOUBLE_HEIGHT}
                  titleStyle={buttonTitleStyles.double}
                  onPress={handleSubmit}
                  loading={loading}
                  containerStyle={styles.btnContainer}
                />
              </View>
            </View>
          </AutoLockView>
        </TouchableWithoutFeedback>
      </AppBottomSheetModal>
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
  modalTitle: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '900',
    fontSize: 20,
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
    paddingTop: 12,
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
