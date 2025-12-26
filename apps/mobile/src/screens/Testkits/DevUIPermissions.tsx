import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Permission,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { Button } from '@/components2024/Button';
import useAsync from 'react-use/lib/useAsync';
import { PerAndroid } from '@/core/utils/permissions';
import { toast } from '@/components2024/Toast';

const ANDROID_PERMISSIONS = [...PerAndroid.requiredPermissions];

function DevUIPermissions() {
  const { styles, colors2024, colors } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  const [grantedPermissions, setGrantedPermissions] = useState<
    {
      permission: Permission;
      permissionLabel: string;
      status: boolean;
    }[]
  >([]);
  const checkGrantedPermissions = useCallback(async () => {
    return Promise.all(
      ANDROID_PERMISSIONS.map(async permission => {
        return {
          permission,
          permissionLabel:
            PerAndroid.formatAndroidPermission(permission).keyLabel,
          status: await PermissionsAndroid.check(permission),
        };
      }),
    ).then(results => {
      setGrantedPermissions(results);
    });
  }, []);

  useAsync(() => {
    return checkGrantedPermissions();
  }, [checkGrantedPermissions]);

  const deniedPermissions = ANDROID_PERMISSIONS.filter(permission => {
    return !grantedPermissions.find(
      item => item.permission === permission && item.status,
    );
  });

  return (
    <NormalScreenContainer
      noHeader
      style={styles.screen}
      overwriteStyle={{ backgroundColor: colors['neutral-card-1'] }}>
      <ScrollView
        nestedScrollEnabled={true}
        contentContainerStyle={[styles.screenScrollableView]}
        horizontal={false}>
        <Text style={styles.areaTitle}>Permissions</Text>
        <Text style={[styles.propertyLabel, { marginVertical: 12 }]}>
          <Text style={[{ fontSize: 18, fontWeight: '700' }]}>
            Summary{' '.repeat(100)}
          </Text>
          <Text style={{ marginBottom: 12 }}>
            This page is used to test the permissions
          </Text>
        </Text>
        <View style={styles.showCaseRowsContainer}>
          <Text
            style={[styles.componentName, { fontSize: 24, marginBottom: 12 }]}>
            Required permissions:
          </Text>
          {grantedPermissions.map(item => {
            const key = `${item.permission}-${item.status}`;
            return (
              <View key={key} style={styles.propertyItem}>
                <Text style={styles.propertyLabel}>
                  {item.permissionLabel}:
                </Text>
                <Text style={styles.propertyValue}>
                  {item.status ? 'Granted' : 'Denied'}
                </Text>
              </View>
            );
          })}
        </View>
        {deniedPermissions.map((permission, index) => {
          const key = `${permission}-${index}`;
          return (
            <Button
              key={key}
              containerStyle={{ marginBottom: 12 }}
              onPress={async () => {
                try {
                  console.debug('Requesting permission:', permission);
                  const result = await PerAndroid.applyAndroidPermission(
                    permission,
                  );
                  console.debug('Permission result:', result);
                  if (result === 'never_ask_again') {
                    toast.error('Permission denied permanently');
                    setTimeout(() => {
                      PerAndroid.goToSystemSettingsFor(permission);
                    }, 2000);
                  }

                  checkGrantedPermissions();
                } catch (error) {
                  console.error(error);
                }
              }}
              title={`Request: ${
                PerAndroid.formatAndroidPermission(permission).keyLabel
              }`}
              titleStyle={{ fontSize: 16, fontWeight: '500' }}
            />
          );
        })}
        <View style={styles.showCaseRowsContainer}>
          <Button
            containerStyle={{ marginBottom: 12, marginHorizontal: 'auto' }}
            onPress={async () => {
              PerAndroid.goToSystemSettingsFor();
            }}
            title={`Go Package's settings`}
            titleStyle={{ fontSize: 16, fontWeight: '500' }}
          />
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
    propertyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      maxWidth: CONTENT_W,
      justifyContent: 'flex-start',
      width: '100%',
      flexWrap: 'wrap',
      marginBottom: 4,
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

export default DevUIPermissions;
