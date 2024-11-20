import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { Text, View } from 'react-native';

import { default as RcCaretDownCC } from './icons/caret-down-cc.svg';
import TouchableView from '../Touchable/TouchableView';

export function AccountsPanelInModal() {
  const { styles, colors2024 } = useTheme2024({ getStyle: getPanelStyle });

  return (
    <>
      <View style={styles.contentWrapper}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Address</Text>
        </View>
        <View style={[styles.section, { marginTop: 18 }]}>
          <TouchableView
            style={styles.sectionTitleContainer}
            onPress={() => {
              console.debug('Implement me');
            }}>
            <Text style={styles.sectionTitle}>Imported Watch-only address</Text>
            <RcCaretDownCC
              style={{ marginLeft: 4 }}
              width={18}
              height={18}
              color={colors2024['neutral-secondary']}
            />
          </TouchableView>
        </View>
      </View>
      <View style={styles.bottomBarContainer}>
        <View style={styles.bottomBarStyle} />
      </View>
    </>
  );
}
const getPanelStyle = createGetStyles2024(ctx => {
  return {
    contentWrapper: {
      height: '100%',
      flexShrink: 1,
      // ...makeDebugBorder('blue'),
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      padding: 16,
    },
    section: {
      flexDirection: 'column',
    },
    sectionTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    sectionTitle: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontWeight: '500',
      lineHeight: 20,
      color: ctx.colors2024['neutral-secondary'],
    },
    bottomBarContainer: {
      width: '100%',
      height: 31,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bottomBarStyle: {
      backgroundColor: '#d1d4db',
      height: 6,
      width: 50,
      borderRadius: 104,
    },
  };
});
