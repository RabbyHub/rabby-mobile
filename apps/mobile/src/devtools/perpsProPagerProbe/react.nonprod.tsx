import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useEffect, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';

import {
  PERPS_PRO_PAGER_PROBE_AVAILABLE,
  getPerpsProPagerProbeStatus,
  markPerpsProPagerProbeIncident,
  startPerpsProPagerProbeCapture,
  stopAndSharePerpsProPagerProbeCapture,
  subscribePerpsProPagerProbe,
} from './runtime.nonprod';

type ProbeButtonProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void | Promise<void>;
};

const ProbeButton = ({ disabled, label, onPress }: ProbeButtonProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && styles.buttonDisabled]}>
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
};

const PerpsProPagerProbeControlsInner = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const [errorMessage, setErrorMessage] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [status, setStatus] = useState(getPerpsProPagerProbeStatus);

  useEffect(
    () =>
      subscribePerpsProPagerProbe(() =>
        setStatus(getPerpsProPagerProbeStatus()),
      ),
    [],
  );

  const handleStart = useCallback(() => {
    setErrorMessage('');
    if (startPerpsProPagerProbeCapture()) {
      setExpanded(true);
    } else {
      setErrorMessage('Pager probe is unavailable in this build');
    }
  }, []);

  const handleShare = useCallback(async () => {
    setErrorMessage('');
    setSharing(true);
    try {
      const shared = await stopAndSharePerpsProPagerProbeCapture();
      if (!shared) {
        setErrorMessage('Start the pager probe before sharing');
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to share pager probe',
      );
    } finally {
      setSharing(false);
    }
  }, []);

  if (!expanded) {
    return (
      <View pointerEvents="box-none" style={styles.collapsedContainer}>
        <ProbeButton label="Pager probe" onPress={() => setExpanded(true)} />
      </View>
    );
  }

  const capturing = status.state === 'capturing';
  return (
    <View pointerEvents="box-none" style={styles.container}>
      <View style={styles.panel}>
        <Text style={styles.title}>Android pager probe</Text>
        <Text style={styles.status}>
          {status.state} · {status.eventCount} events · {status.droppedEvents}{' '}
          dropped
        </Text>
        <Text style={styles.help}>
          Start → reproduce → Blank → small vertical move → Recovered → Share
        </Text>
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        <View style={styles.actions}>
          <ProbeButton
            disabled={capturing}
            label="Start"
            onPress={handleStart}
          />
          <ProbeButton
            disabled={!capturing}
            label="Blank"
            onPress={() => markPerpsProPagerProbeIncident('blank')}
          />
          <ProbeButton
            disabled={!capturing}
            label="Recovered"
            onPress={() => markPerpsProPagerProbeIncident('recovered')}
          />
          <ProbeButton
            disabled={status.state === 'idle' || sharing}
            label={sharing ? 'Sharing…' : 'Stop + Share'}
            onPress={handleShare}
          />
          <ProbeButton label="Hide" onPress={() => setExpanded(false)} />
        </View>
      </View>
    </View>
  );
};

export const PerpsProPagerProbeControls = PERPS_PRO_PAGER_PROBE_AVAILABLE
  ? PerpsProPagerProbeControlsInner
  : () => null;

const getStyles = createGetStyles2024(ctx => ({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  button: {
    backgroundColor: ctx.colors2024['brand-default'],
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  buttonText: {
    color: ctx.colors2024['neutral-bg-1'],
    fontSize: 11,
    fontWeight: '600',
  },
  collapsedContainer: {
    position: 'absolute',
    right: 8,
    top: 112,
    zIndex: 1000,
  },
  container: {
    left: 8,
    position: 'absolute',
    right: 8,
    top: 112,
    zIndex: 1000,
  },
  error: {
    color: ctx.colors2024['red-default'],
    fontSize: 10,
  },
  help: {
    color: ctx.colors2024['neutral-body'],
    fontSize: 10,
    lineHeight: 14,
  },
  panel: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    borderColor: ctx.colors2024['neutral-line'],
    borderRadius: 8,
    borderWidth: 1,
    elevation: 12,
    gap: 6,
    padding: 8,
  },
  status: {
    color: ctx.colors2024['neutral-foot'],
    fontSize: 10,
  },
  title: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 12,
    fontWeight: '700',
  },
}));
