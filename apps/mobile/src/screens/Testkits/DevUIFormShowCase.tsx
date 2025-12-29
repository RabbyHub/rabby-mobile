import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { useNavigation } from '@react-navigation/native';
import {
  createGetStyles2024,
  makeDebugBorder,
  makeProdBorder,
} from '@/utils/styles';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { NextInput } from '@/components2024/Form/Input';
import { RcIconCorrectCC } from '@/assets/icons/common';
import { RcIconScannerCC } from '@/assets/icons/address';
import TouchableView from '@/components/Touchable/TouchableView';

function wrapSampleInput<
  T extends
    | typeof NextInput
    | typeof NextInput.Password
    | typeof NextInput.TextArea,
>(
  Input: T,
  options?: {
    initialSampleValue?: string;
  },
) {
  const { initialSampleValue = 'rabbywallet' } = options ?? {};

  return function SampleInput(props: React.ComponentProps<T>) {
    const [sampleValue, setSampleValue] = useState(
      props.inputProps?.value ?? initialSampleValue,
    );
    const onChange = useCallback((value: string) => {
      setSampleValue(value);
    }, []);

    return (
      // @ts-expect-error
      <Input
        {...props}
        inputProps={{
          ...props.inputProps,
          value: sampleValue,
          onChangeText: onChange,
        }}
      />
    );
  };
}

const BaseInput = wrapSampleInput(NextInput);
const PasswordInput = wrapSampleInput(NextInput.Password);
const TextAreaInput = wrapSampleInput(NextInput.TextArea, {
  initialSampleValue:
    'monkey flower bed banana  orange kid sky eye nose coffee feed food',
});

function DevUIFormShowCase(): JSX.Element {
  const { styles, colors2024, colors } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  const navigation = useNavigation();

  return (
    <NormalScreenContainer
      style={styles.screen}
      noHeader
      overwriteStyle={{ backgroundColor: colors['neutral-card-1'] }}>
      <ScrollView
        nestedScrollEnabled={false}
        contentContainerStyle={styles.screenScrollableView}
        horizontal={false}>
        <Text style={styles.areaTitle}>Form</Text>

        <View style={styles.showCaseRowsContainer}>
          <Text
            style={[styles.componentName, { fontSize: 24, marginBottom: 12 }]}>
            NextInput
          </Text>
          <View style={{ flexDirection: 'column' }}>
            <Text style={[styles.propertyDesc, { marginVertical: 12 }]}>
              <Text style={[{ fontSize: 18, fontWeight: '700' }]}>
                Summary{' '.repeat(100)}
              </Text>
              <Text style={{ marginBottom: 12 }}>
                `NextInput` is the basic input component for theme 2024, its
                based on `TextInput` from react-native, and also adapt to
                `BottomSheet` from `@gorhom/bottom-sheet`.
              </Text>
            </Text>
            <BaseInput
              inputProps={{
                value: '',
                placeholder: 'Must be at least 8 characters',
              }}
            />

            <View style={[styles.propertyDesc, { marginVertical: 12 }]}>
              <Text style={styles.propertyType}>
                as: 'TextInput' | 'BottomSheetTextInput' {' '.repeat(100)}
              </Text>
              <Text style={{ marginBottom: 12 }}>
                You can specify `as="BottomSheetTextInput"` property to make it
                work with `BottomSheet`
              </Text>
            </View>

            <View style={[styles.propertyDesc, { marginVertical: 12 }]}>
              <Text style={styles.propertyType}>
                fieldName: string{' '.repeat(100)}
              </Text>
              <Text style={{ marginBottom: 12 }}>
                specify `fieldName` to show field name above input
              </Text>

              <BaseInput
                hasError
                fieldName="New password"
                inputProps={{
                  placeholder: 'Must be at least 8 characters',
                }}
              />
            </View>

            <View style={[styles.propertyDesc, { marginVertical: 12 }]}>
              <Text style={styles.propertyType}>
                hasError: boolean{' '.repeat(100)}
              </Text>
              <Text style={{ marginBottom: 12 }}>
                make input container has red border
              </Text>

              <BaseInput
                hasError
                fieldName="New password"
                inputProps={{
                  placeholder: 'Must be at least 8 characters',
                }}
              />
            </View>
            <View style={[styles.propertyDesc, { marginVertical: 12 }]}>
              <Text style={styles.propertyType}>
                tipText: boolean{' '.repeat(100)}
              </Text>
              <Text style={{ marginBottom: 12 }}>
                show tip text below input
              </Text>

              <BaseInput
                tipText="Must be at least 8 characters"
                fieldName="New password"
                inputProps={{
                  placeholder: 'Must be at least 8 characters',
                }}
              />

              <Text style={{ marginVertical: 12 }}>
                use with `hasError` to show error tip
              </Text>

              <BaseInput
                hasError
                tipText="Must be at least 8 characters"
                fieldName="New password"
                inputProps={{
                  placeholder: 'Must be at least 8 characters',
                }}
              />
            </View>
            <View style={[styles.propertyDesc, { marginVertical: 12 }]}>
              <Text style={styles.propertyType}>
                clearable: boolean{' '.repeat(100)}
              </Text>
              <Text style={{ marginBottom: 12 }}>make input clearable</Text>

              <BaseInput
                clearable
                fieldName="New password"
                inputProps={{
                  placeholder: 'Must be at least 8 characters',
                }}
              />
            </View>
            <View style={[styles.propertyDesc, { marginVertical: 12 }]}>
              <Text style={styles.propertyType}>
                customIcon: {'React.ReactNode | (ctx) => React.ReactNode'}{' '}
                {' '.repeat(100)}
              </Text>
              <Text style={{ marginBottom: 12 }}>
                Provide `customIcon` on Right
              </Text>
              <BaseInput
                fieldName="New password"
                inputProps={{
                  placeholder: 'Must be at least 8 characters',
                }}
                customIcon={ctx => {
                  return (
                    <View style={ctx.wrapperStyle}>
                      <RcIconCorrectCC
                        style={ctx.iconStyle}
                        color={colors2024['green-default']}
                      />
                    </View>
                  );
                }}
              />
            </View>
          </View>
        </View>

        <View style={styles.showCaseRowsContainer}>
          <Text
            style={[styles.componentName, { fontSize: 24, marginBottom: 12 }]}>
            NextInput.Password
          </Text>
          <View style={{ flexDirection: 'column' }}>
            <Text style={[styles.propertyDesc, { marginVertical: 12 }]}>
              Default
            </Text>
            <PasswordInput
              inputProps={{
                placeholder: 'Must be at least 8 characters',
              }}
            />
            <View style={[styles.propertyDesc, { marginVertical: 12 }]}>
              <Text style={styles.propertyType}>
                initialPasswordVisible: boolean{'       '}
              </Text>
              <Text style={{ marginBottom: 12 }}>Show password by default</Text>

              <PasswordInput
                initialPasswordVisible
                fieldName="New password"
                inputProps={{
                  placeholder: 'Must be at least 8 characters',
                }}
              />
            </View>

            <View style={[styles.propertyDesc, { marginVertical: 12 }]}>
              <Text style={styles.propertyType}>
                customIcon: boolean{'                '}
              </Text>
              <Text style={{ marginBottom: 12 }}>
                Provide `customIcon` will make password invisible
              </Text>

              <PasswordInput
                initialPasswordVisible
                fieldName="Confirm password"
                inputProps={{
                  placeholder: 'Must be at least 8 characters',
                }}
                customIcon={ctx => {
                  return (
                    <View style={ctx.wrapperStyle}>
                      <RcIconCorrectCC
                        style={ctx.iconStyle}
                        color={colors2024['green-default']}
                      />
                    </View>
                  );
                }}
              />
            </View>
          </View>
        </View>

        <View style={styles.showCaseRowsContainer}>
          <Text
            style={[styles.componentName, { fontSize: 24, marginBottom: 12 }]}>
            NextInput.TextArea
          </Text>
          <View style={{ flexDirection: 'column' }}>
            <Text style={[styles.propertyDesc, { marginVertical: 12 }]}>
              Default
            </Text>
            <TextAreaInput
              inputProps={{
                placeholder: 'Enter memonics',
              }}
            />
            <View style={[styles.propertyDesc, { marginVertical: 12 }]}>
              <Text style={styles.propertyType}>
                customIcon: {'React.ReactNode | (ctx) => React.ReactNode'}{' '}
                {' '.repeat(100)}
              </Text>
              <Text style={{ marginBottom: 12 }}>
                Provide `customIcon` on Right-Bottom, the wrapper of icon is
                positioned <Text style={{ fontWeight: 'bold' }}>absolute</Text>,
                so you can change its position by changing `top`, `right`,
                `bottom`, `left` property
              </Text>

              <TextAreaInput
                inputProps={{
                  placeholder: 'Enter memonics',
                }}
                customIcon={ctx => {
                  return (
                    <TouchableView
                      style={[ctx.wrapperStyle, makeProdBorder('yellow')]}
                      onPress={() => {
                        Alert.alert('Please implement Scan QR code!');
                      }}>
                      <RcIconScannerCC
                        style={ctx.iconStyle}
                        color={colors2024['neutral-title-1']}
                      />
                    </TouchableView>
                  );
                }}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </NormalScreenContainer>
  );
}

const CONTENT_W = Dimensions.get('screen').width - 24;
const getStyles = createGetStyles2024(ctx =>
  StyleSheet.create({
    screen: {
      backgroundColor: 'black',
      flexDirection: 'column',
      justifyContent: 'center',
      height: '100%',
    },
    areaTitle: {
      fontSize: 36,
      marginBottom: 12,
      color: ctx.colors2024['neutral-title-1'],
    },
    screenScrollableView: {
      minHeight: '100%',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      // marginTop: 12,
      paddingHorizontal: 12,
      paddingBottom: 64,
      // ...makeDebugBorder(),
    },
    showCaseRowsContainer: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',

      paddingTop: 16,
      paddingBottom: 12,
      borderTopWidth: 2,
      borderStyle: 'dotted',
      borderTopColor: ctx.colors2024['neutral-foot'],
    },
    componentName: {
      color: ctx.colors2024['blue-default'],
      textAlign: 'left',
      fontSize: 24,
    },
    propertyDesc: {
      flexDirection: 'row',
      width: '100%',
      maxWidth: CONTENT_W,
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
    },
    propertyType: {
      color: ctx.colors2024['blue-default'],
      fontSize: 16,
    },
  }),
);

export default DevUIFormShowCase;
