import { TestnetChainBase } from '@/core/services/customTestnetService';
import { useFormik } from 'formik';
import { useTranslation } from 'react-i18next';
import * as Yup from 'yup';

export const useCustomTestnetForm = (params: {
  onSubmit: (values: any) => void;
}) => {
  const { t } = useTranslation();
  return useFormik<Partial<TestnetChainBase>>({
    initialValues: {
      id: undefined,
      name: '',
      rpcUrl: '',
      nativeTokenSymbol: '',
      scanLink: '',
    },
    validationSchema: Yup.object<TestnetChainBase>().shape({
      id: Yup.number()
        .integer('Please input number')
        .required(t('page.customTestnet.CustomTestnetForm.idRequired')),
      name: Yup.string().required(
        t('page.customTestnet.CustomTestnetForm.nameRequired'),
      ),
      rpcUrl: Yup.string()
        .url('Invalid url')
        .required(t('page.customTestnet.CustomTestnetForm.rpcUrlRequired')),
      nativeTokenSymbol: Yup.string().required(
        t('page.customTestnet.CustomTestnetForm.nativeTokenSymbolRequired'),
      ),
      scanLink: Yup.string().url('Invalid url').optional(),
    }),
    validateOnBlur: false,
    validateOnChange: false,
    ...params,
  });
};
