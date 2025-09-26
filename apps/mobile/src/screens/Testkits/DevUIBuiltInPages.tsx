import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { LocalWebView } from '@/components/WebView/LocalWebView/LocalWebView';
import { Switch } from 'react-native-switch';

function DevUIBuiltInPages() {
  const { styles, colors2024, colors } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

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
          <Text style={{ marginBottom: 12 }}>
            This page is used to show usages of built-in webview pages
          </Text>
        </Text>
        <View style={styles.showCaseRowsContainer}>
          <Text
            style={[styles.componentName, { fontSize: 24, marginBottom: 12 }]}>
            Sample widgets:
          </Text>

          <View>
            <Switch
              value={forceUseLocalResource}
              onValueChange={setForceUseLocalResource}
            />
          </View>

          <Text
            style={[styles.componentName, { fontSize: 16, marginBottom: 12 }]}>
            Chart Demo
          </Text>
          <View style={styles.widgetItem}>
            <LocalWebView
              forceUseLocalResource={forceUseLocalResource}
              entryPath={'/pages/chart-demo.html'}
              webviewSize={{ height: 300 }}
            />
          </View>

          <Text
            style={[styles.componentName, { fontSize: 16, marginBottom: 12 }]}>
            Vite Based Index
          </Text>
          <View style={styles.widgetItem}>
            <LocalWebView
              forceUseLocalResource={forceUseLocalResource}
              entryPath={'/pages/index.html'}
              webviewSize={{ height: 500 }}
            />
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
  }),
);

export default DevUIBuiltInPages;
