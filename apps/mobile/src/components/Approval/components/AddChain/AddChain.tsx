import { useApproval } from '@/hooks/useApproval';
import { AddEthereumChainParams } from './type';
import { useTranslation } from 'react-i18next';
import { useMemoizedFn, useMount, useRequest } from 'ahooks';
import { matomoRequestEvent } from '@/utils/analytics';
import { CustomTestnetForm } from '@/screens/CustomTestnet/components/CustomTestnetForm';
import { useCustomTestnetForm } from '@/screens/CustomTestnet/hooks/useCustomTestnetForm';
import { Button } from '@/components/Button';
import clsx from 'clsx';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { AppBottomSheetModalTitle } from '@/components/customized/BottomSheet';
import { createGetStyles } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import { useEffect } from 'react';
import { TestnetChainBase } from '@/core/services/customTestnetService';
import { apiCustomTestnet } from '@/core/apis';
import { dappService } from '@/core/services';
import { toast } from '@/components/Toast';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { ModalLayouts } from '@/constant/layout';

interface AddChainProps {
  data: AddEthereumChainParams[];
  session: {
    origin: string;
    icon: string;
    name: string;
  };
}

export const AddChain = ({ params }: { params: AddChainProps }) => {
  // const wallet = useWallet();
  const [, resolveApproval, rejectApproval] = useApproval();
  const { t } = useTranslation();
  const { styles } = useThemeStyles(getStyle);

  const { data, session } = params;
  const [addChainParams] = data;

  const formik = useCustomTestnetForm({ onSubmit: () => {} });

  const setFormValues = useMemoizedFn((values: Partial<TestnetChainBase>) => {
    formik.setValues(values);
  });

  useEffect(() => {
    setFormValues({
      id: +addChainParams.chainId,
      name: addChainParams.chainName,
      rpcUrl: addChainParams.rpcUrls?.[0],
      nativeTokenSymbol: addChainParams.nativeCurrency?.symbol,
      scanLink: addChainParams.blockExplorerUrls?.[0],
    });
  }, [addChainParams, setFormValues]);

  useMount(() => {
    matomoRequestEvent({
      category: 'Custom Network',
      action: 'Dapp Add Network',
    });
  });

  const { loading, runAsync: runAddChain } = useRequest(
    async () => {
      const values = formik.values as any;
      const errors = await formik.validateForm();
      const isValid = Object.keys(errors || {}).length === 0;
      if (!isValid) {
        return;
      }

      const res = await apiCustomTestnet.addCustomTestnet(values, {
        ga: {
          source: 'dapp',
        },
      });
      if ('error' in res) {
        formik.setFieldError(res.error.key, res.error.message);
        throw new Error(res.error.message);
      }

      const site = await dappService.getConnectedDapp(session.origin)!;
      if (site) {
        dappService.updateDapp({
          ...site,
          chainId: res.enum as any,
        });
      }
      toast.success('Add network successfully');
    },
    {
      manual: true,
    },
  );

  const handleConfirm = async () => {
    await runAddChain();
    resolveApproval();
  };

  return (
    <View style={styles.container}>
      <AppBottomSheetModalTitle
        title={t('page.addChain.title')}
        style={{ paddingTop: ModalLayouts.titleTopOffset }}
      />
      <View style={styles.main}>
        <Text style={styles.desc}>{t('page.addChain.desc')}</Text>
        <KeyboardAwareScrollView
          enableOnAndroid
          scrollEnabled
          keyboardOpeningTime={0}
          keyboardShouldPersistTaps="handled">
          <CustomTestnetForm formik={formik} idDisabled />
        </KeyboardAwareScrollView>
      </View>
      <View style={styles.footer}>
        <Button
          type="primary"
          ghost
          containerStyle={{ width: '100%', flex: 1 }}
          title={t('global.cancelButton')}
          onPress={() => rejectApproval()}
        />

        <Button
          type="primary"
          style={{ width: '100%' }}
          containerStyle={{ width: '100%', flex: 1 }}
          title={t('global.addButton')}
          loading={loading}
          onPress={handleConfirm}
        />
      </View>
    </View>
  );
};

const getStyle = createGetStyles(colors => {
  return {
    container: {
      height: '100%',
      position: 'relative',
      flexDirection: 'column',
    },
    main: {
      flex: 1,
      paddingHorizontal: 20,
    },
    desc: {
      borderRadius: 6,
      backgroundColor: colors['neutral-card-2'],
      padding: 10,
      color: colors['neutral-body'],
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500',
      marginBottom: 20,
    },
    footer: {
      width: '100%',
      maxWidth: Dimensions.get('window').width,
      display: 'flex',
      flexDirection: 'row',
      gap: 16,
      justifyContent: 'space-between',
      borderTopColor: colors['neutral-line'],
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: 20,
      paddingHorizontal: 20,
      paddingBottom: 35,
    },
  };
});
