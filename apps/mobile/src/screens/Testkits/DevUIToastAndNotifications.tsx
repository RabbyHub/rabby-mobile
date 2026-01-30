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
import { RcIconCorrectCC } from '@/assets/icons/common';
import { RcIconScannerCC } from '@/assets/icons/address';
import TouchableView from '@/components/Touchable/TouchableView';
import { Button } from '@/components2024/Button';
import { toast, toastLoadingSuccess } from '@/components2024/Toast';

function DevUIToastAndNotifications(): JSX.Element {
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
        <Text style={styles.areaTitle}>Toast & Notifications</Text>

        <View style={styles.showCaseRowsContainer}>
          <Text
            style={[styles.componentName, { fontSize: 24, marginBottom: 12 }]}>
            Toast
          </Text>
          <View style={{ width: '100%', flexDirection: 'column' }}>
            <Text style={[styles.propertyDesc, { marginVertical: 12 }]}>
              <Text style={[{ fontSize: 18, fontWeight: '700' }]}>
                Summary{' '.repeat(100)}
              </Text>
              <Text style={{ marginBottom: 12 }}>
                `toast` is a series of functions to show toast notifications.
                <Text>{'\n'}</Text>
                Currently supported types are: `success`, `error`, `info`,
                `loading`, and normal.
              </Text>
            </Text>

            {/* toast string */}
            <View style={{ width: '100%', marginBottom: 24 }}>
              <View style={[styles.propertyDesc, { marginTop: 12 }]}>
                <Text style={styles.propertyType}>
                  toast string as content{' '.repeat(100)}
                </Text>
                <Text style={{ marginBottom: 12 }}>
                  You can simply call `toast.success('Your message here')` to
                  show a success toast with the provided string as content.
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 0 }}>
                <Button
                  height={48}
                  titleStyle={{ color: colors2024['neutral-title-2'] }}
                  type={'success'}
                  title={'Success'}
                  containerStyle={[styles.btnOnGroup, { marginTop: 12 }]}
                  onPress={() => {
                    toast.success('This is a success toast!');
                  }}
                />

                <Button
                  height={48}
                  titleStyle={{ color: colors2024['neutral-title-2'] }}
                  type={'danger'}
                  title={'Error'}
                  containerStyle={[styles.btnOnGroup, { marginTop: 12 }]}
                  onPress={() => {
                    toast.error('This is an error toast!');
                  }}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 0 }}>
                <Button
                  height={48}
                  titleStyle={{ color: colors2024['blue-default'] }}
                  type={'ghost'}
                  title={'Show'}
                  containerStyle={[styles.btnOnGroup, { marginTop: 12 }]}
                  onPress={() => {
                    toast.show('Importing', {
                      duration: 5000,
                    });
                  }}
                />
                <Button
                  height={48}
                  titleStyle={{ color: colors2024['blue-default'] }}
                  type={'ghost'}
                  title={'Info'}
                  containerStyle={[styles.btnOnGroup, { marginTop: 12 }]}
                  onPress={() => {
                    toast.info('This is an info toast with 5s duration!', {
                      duration: 5000,
                    });
                  }}
                />
              </View>
            </View>

            {/* toast custom node */}
            <View style={{ width: '100%', marginBottom: 24 }}>
              <View style={[styles.propertyDesc, { marginTop: 12 }]}>
                <Text style={styles.propertyType}>
                  toast with custom React Node as content{' '.repeat(100)}
                </Text>
                <Text style={{ marginBottom: 12 }}>
                  You can also pass a custom React Node to `toast` functions to
                  create more complex toast notifications.
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 0 }}>
                <Button
                  height={48}
                  titleStyle={{ color: colors2024['neutral-title-2'] }}
                  type={'primary'}
                  title={'Custom Success'}
                  containerStyle={[styles.btnOnGroup, { marginTop: 12 }]}
                  onPress={() => {
                    toast.success(ctx => (
                      <View
                        style={[
                          ctx.styles.containerInner,
                          {
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                          },
                        ]}>
                        <ctx.Icon
                          style={[ctx.styles.icon, { marginRight: 0 }]}
                        />
                        <Text
                          style={[
                            ctx.styles.text,
                            {
                              color: colors2024['neutral-title-2'],
                              fontSize: 16,
                            },
                          ]}>
                          This is a custom success toast!
                        </Text>
                      </View>
                    ));
                  }}
                />

                <Button
                  height={48}
                  titleStyle={{ color: colors2024['blue-default'] }}
                  type={'ghost'}
                  title={'Custom Info'}
                  containerStyle={[styles.btnOnGroup, { marginTop: 12 }]}
                  onPress={() => {
                    toast.info(
                      ctx => {
                        return (
                          <View
                            style={[
                              ctx.styles.containerInner,
                              {
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                              },
                            ]}>
                            <ctx.Icon
                              style={[ctx.styles.icon, { marginRight: 0 }]}
                            />
                            <Text
                              style={[
                                ctx.styles.text,
                                {
                                  color: colors2024['neutral-title-2'],
                                  fontSize: 16,
                                },
                              ]}>
                              This is a custom info toast!
                            </Text>
                          </View>
                        );
                      },
                      { duration: 4000 },
                    );
                  }}
                />
              </View>
            </View>

            {/* special api toastLoadingSuccess */}
            <View style={{ width: '100%', marginBottom: 24 }}>
              <View style={[styles.propertyDesc, { marginTop: 12 }]}>
                <Text style={styles.propertyType}>
                  toastLoading with success indication{' '.repeat(100)}
                </Text>
                <Text style={{ marginBottom: 12 }}>
                  You can use `toastLoadingSuccess` to show a loading toast, and
                  then call the returned function to hide it. You can also show
                  a success toast after hiding the loading toast.
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 0 }}>
                <Button
                  height={48}
                  titleStyle={{ color: colors2024['neutral-title-2'] }}
                  type={'primary'}
                  title={'Loading then Success'}
                  containerStyle={[styles.btnOnGroup, { marginTop: 12 }]}
                  onPress={() => {
                    const hideLoading = toastLoadingSuccess(
                      'Loaded Successfully!',
                    );
                  }}
                />
              </View>
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
    buttonGroup: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    btnOnGroup: {
      flexShrink: 1,
      width: '100%',
    },
  }),
);

export default DevUIToastAndNotifications;
