import * as Yup from 'yup';
import { FormikConfig, FormikErrors, FormikValues, useFormik } from 'formik';

// export function resetFormikFieldError<Values extends FormikValues = FormikValues>(formik: FormikConfig<FormikValues>, field: string) {
//   formik.set
// }
export function getFormikErrorsCount<
  Values extends FormikValues = FormikValues,
>(
  errors:
    | ReturnType<typeof useFormik<Values>>
    | ReturnType<typeof useFormik<Values>>['errors'],
) {
  if (typeof errors.errors === 'object')
    return Object.values(errors.errors).filter(Boolean).length;

  return Object.values(errors).filter(Boolean).length;
}

export function getFormikTouchedCount<
  Values extends FormikValues = FormikValues,
>(
  touched:
    | ReturnType<typeof useFormik<Values>>
    | ReturnType<typeof useFormik<Values>>['touched'],
) {
  if (typeof touched.touched === 'object')
    return Object.values(touched.touched).filter(Boolean).length;

  return Object.values(touched).filter(Boolean).length;
}

export function setFieldValueAndTouched<
  Values extends FormikValues = FormikValues,
>(
  formik: ReturnType<typeof useFormik<Values>>,
  [field, value, shouldValidte = true]: Parameters<
    (typeof formik)['setFieldValue']
  >,
  touched = true,
) {
  formik.setFieldTouched(field, touched, shouldValidte);
  formik.setFieldValue(field, value, shouldValidte);
}

export function validateFormikSchema<
  Values extends FormikValues = FormikValues,
>(
  formikValues: Values,
  yupSchema: Yup.ObjectSchema<Values>,
): FormikErrors<Values> {
  let errors = {};
  try {
    yupSchema.validateSync(formikValues, { abortEarly: true });
  } catch (error: any) {
    errors[error.path] = error.message;
  }

  return errors;
}

export function useAppFormik<Values extends FormikValues = FormikValues>(
  options: FormikConfig<Values>,
) {
  type Orig = ReturnType<typeof useFormik<Values>>;
  const formik = useFormik<Values>(options) as Orig & {
    validateFormValues: () => ReturnType<typeof validateFormikSchema<Values>>;
  };

  formik.validateFormValues = (values?: Values) =>
    validateFormikSchema(values ?? formik.values, options.validationSchema);

  return formik;
}
