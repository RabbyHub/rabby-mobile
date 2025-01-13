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
import { useSQLiteInfo } from '@/core/databases/hooks';

function DevDataSQLite() {
  const { styles, colors2024, colors } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  const { sqliteInfo } = useSQLiteInfo({ enableAutoFetch: true });

  return (
    <NormalScreenContainer
      noHeader
      style={styles.screen}
      overwriteStyle={{ backgroundColor: colors['neutral-card-1'] }}>
      <ScrollView
        nestedScrollEnabled={true}
        contentContainerStyle={[styles.screenScrollableView]}
        horizontal={false}>
        <Text style={styles.areaTitle}>SQLite</Text>
        <Text style={[styles.propertyDesc, { marginVertical: 12 }]}>
          <Text style={[{ fontSize: 18, fontWeight: '700' }]}>
            Summary{' '.repeat(100)}
          </Text>
          <Text style={{ marginBottom: 12 }}>
            This screen shows the basic capability for high-performance Data
            Workflow, which is based on the SQLite database.
          </Text>
        </Text>
        <View style={styles.showCaseRowsContainer}>
          <Text
            style={[styles.componentName, { fontSize: 24, marginBottom: 12 }]}>
            SQLite information
          </Text>
          <Text
            style={[
              styles.propertyDesc,
              { marginVertical: 12, flexWrap: 'wrap' },
            ]}>
            <View
              style={{
                marginBottom: 8,
                maxWidth: '100%',
                height: 20,
                flexWrap: 'wrap',
              }}>
              <Text>
                version: {sqliteInfo?.version || '-'}
                {' '.repeat(100)}
              </Text>
            </View>

            <View
              style={{
                marginBottom: 8,
                maxWidth: '100%',
                height: 20,
                flexWrap: 'wrap',
              }}>
              <Text>
                source_id: {sqliteInfo?.source_id || '-'}
                {' '.repeat(50)}
              </Text>
            </View>

            <View
              style={{
                marginBottom: 8,
                maxWidth: '100%',
                height: 20,
                flexWrap: 'wrap',
              }}>
              <Text>
                thread_safe:{' '}
                {typeof sqliteInfo?.thread_safe === 'boolean'
                  ? sqliteInfo?.thread_safe + ''
                  : '-'}
                {' '.repeat(100)}
              </Text>
            </View>
          </Text>
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

    openedDappRecord: {
      borderBottomColor: ctx.colors2024['neutral-line'],
      borderBottomWidth: 1,
    },
  }),
);

export default DevDataSQLite;
