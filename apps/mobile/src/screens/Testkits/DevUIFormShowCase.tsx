import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { useNavigation } from '@react-navigation/native';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { NextInput } from '@/components2024/Form/Input';
import { RcIconCorrectCC } from '@/assets/icons/common';

function wrapSampleInput<
  T extends typeof NextInput | typeof NextInput.Password,
>(Input: T) {
  return function SampleInput(props: React.ComponentProps<T>) {
    const [sampleValue, setSampleValue] = useState(
      props.inputProps?.value ?? 'rabbywallet',
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

function DevUIFormShowCase(): JSX.Element {
  const { styles, colors2024 } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  const navigation = useNavigation();

  return (
    <NormalScreenContainer style={styles.screen} noHeader>
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
              Default{' '.repeat(100)}
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
                customIcon: boolean{' '.repeat(100)}
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

        {/* <View
          style={{
            marginVertical: 16,
            borderTopWidth: 2,
            borderStyle: 'dotted',
            borderTopColor: colors2024['neutral-foot'],
          }}
        /> */}

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
      </ScrollView>
    </NormalScreenContainer>
  );
}

const CONTENT_W = Dimensions.get('screen').width - 24;
const getStyles = createGetStyles2024(ctx =>
  StyleSheet.create({
    screen: {
      backgroundColor: ctx.colors['neutral-card1'],
      flexDirection: 'column',
      justifyContent: 'center',
      // paddingTop: 0,
      // height: '100%',
    },
    areaTitle: {
      fontSize: 36,
      marginBottom: 12,
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
