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
