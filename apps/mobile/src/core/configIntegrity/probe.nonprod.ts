import { getRegressionScenarioRuntimeControlSnapshot } from '@/devtools/regressionScenarios/runtimeStore';
import { appMMKV } from '../storage/mmkvInstances';
import type { ConfigIntegrityRuntime } from './coordinator';
import type { Diagnostic } from './schema';

const ARMED_PROBE_KEY = '__configIntegrityRegressionProbe';

const faults = ['none', 'key-read', 'metadata-write'] as const;
type Fault = (typeof faults)[number];
let observations: Diagnostic[] | undefined;
let failMetadataWrite = false;

function isFault(value: unknown): value is Fault {
  return faults.some(fault => fault === value);
}

// Called only by the validated, one-shot regression scenario. The next app
// process consumes the arm once, independently of when navigation is ready.
export function armConfigIntegrityProbe(fault: string, expiresAt: number) {
  if (!isFault(fault)) {
    throw new Error('Unknown configuration integrity probe fault');
  }
  appMMKV.set(ARMED_PROBE_KEY, JSON.stringify({ fault, expiresAt }));
}

function takeFault(): Fault | undefined {
  const raw = appMMKV.getString(ARMED_PROBE_KEY);
  if (!raw || !getRegressionScenarioRuntimeControlSnapshot().enabled) {
    return;
  }
  appMMKV.delete(ARMED_PROBE_KEY);
  try {
    const arm = JSON.parse(raw);
    if (arm?.expiresAt > Date.now() && isFault(arm.fault)) {
      return arm.fault;
    }
  } catch {
    // A corrupt test command is ignored.
  }
}

export function instrumentConfigIntegrityRuntime(
  runtime: ConfigIntegrityRuntime,
) {
  const fault = takeFault();
  if (fault) {
    observations = [];
    failMetadataWrite = fault === 'metadata-write';
  }
  return {
    ...runtime,
    keychain: {
      ...runtime.keychain,
      read: async () => {
        if (fault === 'key-read') {
          throw new Error(
            'Injected configuration integrity Keychain read failure',
          );
        }
        return runtime.keychain.read();
      },
    },
    report: diagnostic => {
      if (observations) {
        observations.push(diagnostic);
      } else {
        runtime.report(diagnostic);
      }
    },
  };
}

export function beforeConfigIntegrityMetadataWrite() {
  if (
    failMetadataWrite &&
    getRegressionScenarioRuntimeControlSnapshot().enabled
  ) {
    failMetadataWrite = false;
    throw new Error('Injected configuration integrity metadata write failure');
  }
}

export function getConfigIntegrityProbeDiagnostics() {
  return observations ?? null;
}

export function failNextConfigIntegrityMetadataWrite() {
  observations = [];
  failMetadataWrite = true;
}
