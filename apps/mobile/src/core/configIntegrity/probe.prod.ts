import type { ConfigIntegrityRuntime } from './coordinator';

export function instrumentConfigIntegrityRuntime(
  runtime: ConfigIntegrityRuntime,
) {
  return runtime;
}

export function beforeConfigIntegrityMetadataWrite() {}
