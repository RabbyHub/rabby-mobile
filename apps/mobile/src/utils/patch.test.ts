import * as Yup from 'yup';

import {
  getFormikErrorsCount,
  getFormikTouchedCount,
  setFieldValueAndTouched,
  validateFormikSchema,
} from './patch';

describe('patch utils', () => {
  it('counts formik errors and touched states from both wrapper and plain objects', () => {
    expect(
      getFormikErrorsCount({
        errors: {
          a: 'required',
          b: '',
          c: 'too short',
        },
      } as any),
    ).toBe(2);
    expect(
      getFormikErrorsCount({
        a: 'required',
        b: undefined,
        c: 'too short',
      } as any),
    ).toBe(2);

    expect(
      getFormikTouchedCount({
        touched: {
          a: true,
          b: false,
          c: true,
        },
      } as any),
    ).toBe(2);
    expect(
      getFormikTouchedCount({
        a: true,
        b: false,
        c: true,
      } as any),
    ).toBe(2);
  });

  it('setFieldValueAndTouched currently touches before setting the value', () => {
    const setFieldTouched = jest.fn();
    const setFieldValue = jest.fn();

    setFieldValueAndTouched(
      {
        setFieldTouched,
        setFieldValue,
      } as any,
      ['name', 'rabby', false],
      true,
    );

    expect(setFieldTouched).toHaveBeenCalledWith('name', true, false);
    expect(setFieldValue).toHaveBeenCalledWith('name', 'rabby', false);
    expect(setFieldTouched.mock.invocationCallOrder[0]).toBeLessThan(
      setFieldValue.mock.invocationCallOrder[0],
    );
  });

  it('validateFormikSchema returns only the first synchronous error', () => {
    const schema = Yup.object({
      name: Yup.string().required('name is required'),
      age: Yup.number().min(18, 'too young').required('age is required'),
    });

    expect(validateFormikSchema({ name: '', age: 10 }, schema as any)).toEqual({
      age: 'too young',
    });
    expect(
      validateFormikSchema({ name: 'Rabby', age: 18 }, schema as any),
    ).toEqual({});
  });
});
