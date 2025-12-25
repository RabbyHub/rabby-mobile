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
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { FooterButtonScreenContainer as FooterButtonScreenContainer2024 } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { FooterButtonScreenContainer } from '@/components/ScreenContainer/FooterButtonScreenContainer';
import { Button } from '@/components2024/Button';

const ScreenContainers = {
  NormalScreenContainer,
  FooterButtonScreenContainer2024,
  FooterButtonScreenContainer,
};

function DevUIScreenContainerShowCase() {
  const { styles, colors2024, colors } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  const [{ screenType }, setScreenSetting] = useState<{
    screenType: keyof typeof ScreenContainers;
  }>({
    screenType: 'NormalScreenContainer',
  });

  const navigation = useNavigation();

  const mainContentNode = (() => {
    return (
      <ScrollView
        nestedScrollEnabled={true}
        contentContainerStyle={[styles.screenScrollableView]}
        horizontal={false}>
        <Text style={styles.areaTitle}>ScreenContainer</Text>
        <Text style={[styles.propertyDesc, { marginVertical: 12 }]}>
          <Text style={[{ fontSize: 18, fontWeight: '700' }]}>
            Summary{' '.repeat(100)}
          </Text>
          <Text style={{ marginBottom: 12 }}>
            NormalScreenContainer is a commonly used screen type that features a
            simple vertical layout. In most cases, you can safely place your
            main content within it.
          </Text>
        </Text>

        <View style={styles.showCaseRowsContainer}>
          <Text
            style={[styles.componentName, { fontSize: 24, marginBottom: 12 }]}>
            Classical `NormalScreenContainer``
          </Text>
          <Text style={[styles.propertyDesc, { marginVertical: 12 }]}>
            <Text style={{ marginBottom: 12 }}>
              FooterButtonScreenContainer can be used to adapt screens that have
              buttons at the bottom. These screens require that the button (or
              button group) is always positioned at the bottom, while the height
              of the main content does not extend to the bottom buttons but
              instead maintains a certain distance from them.
            </Text>
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Button
              buttonStyle={{ height: 32 }}
              containerStyle={{ height: 32 }}
              type="primary"
              title={'Switch To NormalScreenContainer'}
              disabled={screenType === 'NormalScreenContainer'}
              onPress={() => {
                setScreenSetting({ screenType: 'NormalScreenContainer' });
              }}
              titleStyle={{ fontSize: 14, lineHeight: 32 }}
            />
          </View>
        </View>

        <View style={styles.showCaseRowsContainer}>
          <Text
            style={[styles.componentName, { fontSize: 24, marginBottom: 12 }]}>
            `FooterButtonScreenContainer` (2024)
          </Text>
          <Text style={[styles.propertyDesc, { marginVertical: 12 }]}>
            <Text style={{ marginBottom: 12 }}>
              FooterButtonScreenContainer can be used to adapt screens that have
              buttons at the bottom. These screens require that the button (or
              button group) is always positioned at the bottom, while the height
              of the main content does not extend to the bottom buttons but
              instead maintains a certain distance from them.
            </Text>
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Button
              buttonStyle={{ height: 32 }}
              containerStyle={{ height: 32 }}
              type="primary"
              title={'Switch To FooterButtonScreenContainer(2024)'}
              disabled={screenType === 'FooterButtonScreenContainer2024'}
              onPress={() => {
                setScreenSetting({
                  screenType: 'FooterButtonScreenContainer2024',
                });
              }}
              titleStyle={{ fontSize: 14, lineHeight: 32 }}
            />
          </View>
        </View>

        <View style={styles.showCaseRowsContainer}>
          <Text
            style={[styles.componentName, { fontSize: 24, marginBottom: 12 }]}>
            Classical `FooterButtonScreenContainer`
          </Text>
          <Text style={[styles.propertyDesc, { marginVertical: 12 }]}>
            <Text style={{ marginBottom: 12 }}>
              The old version of FooterButtonContainer differs slightly from the
              2024 version. It expects you to place a footer area with a top
              border line at the bottom of the screen. Inside, it uses a
              ScrollView to allow the main content to exceed the screen size
              (some content may be hidden under the footer by default, but you
              can reveal it by scrolling down the main content). Additionally,
              the internal ScrollView comes with default padding values, which
              you can override using the scrollableViewStyle property.
            </Text>
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Button
              buttonStyle={{ height: 32 }}
              containerStyle={{ height: 32 }}
              type="primary"
              title={'Switch To FooterButtonScreenContainer'}
              disabled={screenType === 'FooterButtonScreenContainer'}
              onPress={() => {
                setScreenSetting({ screenType: 'FooterButtonScreenContainer' });
              }}
              titleStyle={{ fontSize: 14, lineHeight: 32 }}
            />
          </View>
        </View>
      </ScrollView>
    );
  })();

  switch (screenType) {
    default:
    case 'NormalScreenContainer':
      return (
        <NormalScreenContainer
          noHeader
          style={styles.screen}
          overwriteStyle={{ backgroundColor: colors['neutral-card-1'] }}>
          {mainContentNode}
        </NormalScreenContainer>
      );
    case 'FooterButtonScreenContainer2024': {
      return (
        <FooterButtonScreenContainer2024
          noHeader
          style={[styles.screen, { backgroundColor: colors['neutral-card-1'] }]}
          buttonProps={{
            title: 'I am footer button',
            onPress: () => {
              Alert.alert('Footer button pressed');
            },
          }}>
          {mainContentNode}
        </FooterButtonScreenContainer2024>
      );
    }
    case 'FooterButtonScreenContainer': {
      return (
        <FooterButtonScreenContainer
          buttonText={'I am footer button'}
          onPressButton={() => {
            Alert.alert('Footer button pressed');
          }}
          style={[styles.screen, { backgroundColor: colors['neutral-card-1'] }]}
          scrollableViewStyle={{ paddingHorizontal: 0 }}>
          {mainContentNode}
        </FooterButtonScreenContainer>
      );
    }
  }

  // eslint-disable-next-line no-unreachable
  return null;
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

export default DevUIScreenContainerShowCase;
