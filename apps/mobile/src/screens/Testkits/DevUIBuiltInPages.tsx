import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppTheme, useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { LocalWebView } from '@/components/WebView/LocalWebView/LocalWebView';
import { RabbySwitch as Switch } from '@/components/Switch/Switch';
import { Button } from '@rneui/themed';
import { useTranslation } from 'react-i18next';
import { useAppLanguage } from '@/hooks/lang';
import { SupportedLang } from '@/utils/i18n';

function DevUIBuiltInPages() {
  const { styles, colors2024, colors } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  const { appTheme, toggleThemeMode } = useAppTheme();

  const { currentLanguage, setCurrentLanguage } = useAppLanguage();

  const { t } = useTranslation();

  const [forceUseLocalResource, setForceUseLocalResource] = useState(!__DEV__);

  return (
    <NormalScreenContainer
      noHeader
      style={styles.screen}
      overwriteStyle={{ backgroundColor: colors['neutral-card-1'] }}>
      <ScrollView
        nestedScrollEnabled={true}
        contentContainerStyle={[styles.screenScrollableView]}
        horizontal={false}>
        <Text style={styles.areaTitle}>Built-in WebView Widgets</Text>
        <Text style={[styles.propertyLabel, { marginVertical: 12 }]}>
          <Text style={[{ fontSize: 18, fontWeight: '700' }]}>
            Summary{' '.repeat(100)}
          </Text>
          <Text style={[styles.text, { marginBottom: 12 }]}>
            This page is used to show usages of built-in webview pages
          </Text>
        </Text>
        <View style={styles.showCaseRowsContainer}>
          <Text
            style={[styles.componentName, { fontSize: 24, marginBottom: 12 }]}>
            Sample widgets:
          </Text>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 12,
            }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 12,
              }}>
              <Text style={[styles.text, { marginRight: 16, fontSize: 16 }]}>
                Force Use Local
              </Text>
              <Switch
                value={forceUseLocalResource}
                onValueChange={setForceUseLocalResource}
              />
            </View>
          </View>

          {/* switch theme :start */}
          <View
            style={{
              flexDirection: 'column',
              marginBottom: 12,
            }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 12,
              }}>
              <Text style={[styles.text, { marginRight: 16, fontSize: 16 }]}>
                Switch App Theme
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}>
              <Button
                type="outline"
                containerStyle={[
                  { width: 80 },
                  appTheme === 'system' && styles.btnContainerActive,
                ]}
                titleStyle={[appTheme === 'system' && styles.btnTextActive]}
                onPress={() => toggleThemeMode('system')}>
                System
              </Button>
              <Button
                type="outline"
                containerStyle={[
                  { width: 80 },
                  appTheme === 'light' && styles.btnContainerActive,
                ]}
                titleStyle={[appTheme === 'light' && styles.btnTextActive]}
                onPress={() => toggleThemeMode('light')}>
                Light
              </Button>
              <Button
                type="outline"
                containerStyle={[
                  { width: 80 },
                  appTheme === 'dark' && styles.btnContainerActive,
                ]}
                titleStyle={[appTheme === 'dark' && styles.btnTextActive]}
                onPress={() => toggleThemeMode('dark')}>
                Dark
              </Button>
            </View>
          </View>
          {/* switch theme :end */}

          {/* switch lang :start */}
          <View
            style={{
              flexDirection: 'column',
              marginBottom: 12,
            }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 12,
              }}>
              <Text style={[styles.text, { marginRight: 16, fontSize: 16 }]}>
                Switch Language
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}>
              <Button
                type="outline"
                containerStyle={[
                  { width: 80 },
                  currentLanguage === 'en-US' && styles.btnContainerActive,
                ]}
                titleStyle={[
                  currentLanguage === 'en-US' && styles.btnTextActive,
                ]}
                onPress={() => setCurrentLanguage(SupportedLang['en-US'])}>
                English
              </Button>
              <Button
                type="outline"
                containerStyle={[
                  { width: 80 },
                  currentLanguage === 'zh-CN' && styles.btnContainerActive,
                ]}
                titleStyle={[
                  currentLanguage === 'zh-CN' && styles.btnTextActive,
                ]}
                onPress={() => setCurrentLanguage(SupportedLang['zh-CN'])}>
                中文
              </Button>
            </View>
          </View>
          {/* switch lang :end */}

          <Text
            style={[styles.componentName, { fontSize: 16, marginBottom: 12 }]}>
            Vite Based Index
          </Text>
          <View style={styles.widgetItem}>
            <LocalWebView
              forceUseLocalResource={forceUseLocalResource}
              entryPath={'/pages/index.html'}
              webviewSize={{ height: 390 }}
              nestedScrollEnabled={false}
              i18nTexts={{
                'page.devUIBuiltInPages.builtInPageTitle': t(
                  'page.devUIBuiltInPages.builtInPageTitle',
                ),
              }}
            />
          </View>

          {/* <Text
            style={[styles.componentName, { fontSize: 16, marginBottom: 12 }]}>
            Chart Demo
          </Text>
          <View style={styles.widgetItem}>
            <LocalWebView
              forceUseLocalResource={forceUseLocalResource}
              entryPath={'/pages/chart-demo.html'}
              webviewSize={{ height: 300 }}
            />
          </View> */}
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
    text: {
      color: ctx.colors2024['neutral-title-1'],
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
    widgetItem: {
      flexDirection: 'row',
      alignItems: 'center',
      maxWidth: CONTENT_W,
      justifyContent: 'flex-start',
      width: '100%',
      flexWrap: 'wrap',
      marginBottom: 4,
      borderWidth: 1,
      borderColor: ctx.colors2024['neutral-line'],
      borderRadius: 8,
      padding: 12,
    },
    propertyLabel: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      marginRight: 8,
      color: ctx.colors2024['neutral-title-1'],
    },
    propertyType: {
      color: ctx.colors2024['blue-default'],
      fontSize: 16,
    },
    propertyValue: {
      fontSize: 16,
      color: ctx.colors2024['neutral-title-1'],
    },

    openedDappRecord: {
      borderBottomColor: ctx.colors2024['neutral-line'],
      borderBottomWidth: 1,
    },

    btnContainerActive: {
      backgroundColor: ctx.colors2024['blue-default'],
    },

    btnTextActive: {
      color: ctx.colors2024['neutral-card-2'],
    },
  }),
);

export default DevUIBuiltInPages;
