import type { FormikConfig, FormikValues, useFormik } from 'formik';

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
  formik.setFieldTouched(field, touched);
  formik.setFieldValue(field, value, shouldValidte);
}
