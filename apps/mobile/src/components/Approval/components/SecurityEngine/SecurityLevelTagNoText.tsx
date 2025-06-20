import React, { useMemo } from 'react';
import { Level } from '@rabby-wallet/rabby-security-engine/dist/rules';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { SecurityEngineLevel } from '@/constant/security';
import ArrowRightSVG from '@/assets/icons/approval/arrow-right-lite.svg';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    fontWeight: 'normal',
  },
  icon: {
    width: 16,
    height: 16,
    marginRight: 2,
  },
  wrapper: {
    padding: 2,
    display: 'flex',
    position: 'absolute',
    top: '50%',
    marginTop: -10,
    right: -6,
    paddingLeft: 6,
    borderRadius: 3,
    // @ts-expect-error maybe invalid style
    transition: 'all 0.3s',
    maxWidth: 40,
    overflow: 'hidden',
    alignItems: 'center',
    flexDirection: 'row',
  },
  translucent: {
    opacity: 0.7,
  },
  showText: {
    maxWidth: 170,
    // whiteSpace: 'nowrap',
  },
  safe: {
    color: '#27c193',
    backgroundColor: '#dff6ef',
    borderColor: 'rgba(39, 193, 147, 0.5)',
    borderWidth: StyleSheet.hairlineWidth,
  },
  forbidden: {
    color: '#af160e',
    backgroundColor: '#f3dcdb',
    borderColor: 'rgba(175, 22, 14, 0.5)',
    borderWidth: StyleSheet.hairlineWidth,
  },
  danger: {
    color: '#ec5151',
    backgroundColor: '#fce5e5',
    borderColor: 'rgba(236, 81, 81, 0.5)',
    borderWidth: StyleSheet.hairlineWidth,
  },
  warning: {
    color: '#ffb020',
    backgroundColor: '#fff3de',
    borderColor: 'rgba(255, 176, 32, 0.5)',
    borderWidth: StyleSheet.hairlineWidth,
  },
  proceed: {
    color: '#707280',
    backgroundColor: '#eaeaec',
    borderColor: 'rgba(112, 114, 128, 0.5)',
    borderWidth: StyleSheet.hairlineWidth,
  },
  closed: {
    color: '#b4bdcc',
    backgroundColor: '#eaeaec',
    borderColor: 'rgba(112, 114, 128, 0.5)',
    borderWidth: StyleSheet.hairlineWidth,
  },
  error: {
    color: '#b4bdcc',
    backgroundColor: '#eaeaec',
    borderColor: 'rgba(112, 114, 128, 0.5)',
    borderWidth: StyleSheet.hairlineWidth,
  },
});

const SecurityLevelTagNoText = ({
  enable,
  level,
  showText,
}: {
  enable: boolean;
  level: Level | 'proceed';
  showText: boolean;
}) => {
  const currentLevel = useMemo(() => {
    if (!enable) {
      return SecurityEngineLevel.closed;
    }
    return SecurityEngineLevel[level];
  }, [level, enable]);

  return (
    <View style={styles.container}>
      <currentLevel.icon style={styles.icon} />
      {showText && <Text>{currentLevel.text}</Text>}
    </View>
  );
};

const SecurityLevelTag = ({
  enable,
  level,
  translucent,
  onClick,
  right = -28,
  style,
  inSubTable,
}: {
  enable: boolean;
  level: Level | 'proceed';
  translucent?: boolean;
  onClick?(): void;
  right?: number;
  style?: StyleProp<ViewStyle>;
  // adjust position for sub table
  inSubTable?: boolean;
}) => {
  if (inSubTable) {
    right = right - 12;
  }

  const wrapperStyles = StyleSheet.flatten([
    styles.wrapper,
    translucent && styles.translucent,
    // showText && styles.showText,
    level === 'safe' && styles.safe,
    level === 'forbidden' && styles.forbidden,
    level === 'danger' && styles.danger,
    level === 'warning' && styles.warning,
    level === 'proceed' && styles.proceed,
    level === 'error' && styles.error,
    { right },
    style,
  ]);

  return (
    <TouchableOpacity style={wrapperStyles} onPress={onClick}>
      <SecurityLevelTagNoText enable={enable} level={level} showText={false} />
      {/* @ts-ignore */}
      <ArrowRightSVG style={[styles.icon, { color: wrapperStyles.color }]} />
    </TouchableOpacity>
  );
};

export default SecurityLevelTag;
