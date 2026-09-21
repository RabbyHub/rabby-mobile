export const APP_FILE_LOGGING_ONLINE_SWITCH =
  '20260410.enable_app_file_logging' as const;

export type AppLogPolicyEnv = 'development' | 'regression' | 'production';

export function resolveAppLogPolicyEnv(options: {
  runtimeEnv: string;
  isNonPublicProductionEnv: boolean;
}): AppLogPolicyEnv {
  const { runtimeEnv, isNonPublicProductionEnv } = options;

  if (runtimeEnv === 'development') {
    return 'development';
  }

  return isNonPublicProductionEnv ? 'regression' : 'production';
}

export function getDefaultLocalAppFileLoggingEnabled(runtimeEnv: string) {
  switch (runtimeEnv) {
    case 'development':
      return true;
    case 'regression':
      return false;
    default:
      return false;
  }
}

export function resolveAppFileLoggingEnabled(options: {
  runtimeEnv: string;
  localEnabled: boolean;
  prodOnlineEnabled: boolean;
}) {
  const { runtimeEnv, localEnabled, prodOnlineEnabled } = options;

  return runtimeEnv === 'production' ? prodOnlineEnabled : localEnabled;
}

export function resolveConsoleCaptureEnabled(options: {
  runtimeEnv: string;
  localEnabled: boolean;
  prodOnlineEnabled: boolean;
}) {
  return resolveAppFileLoggingEnabled(options);
}
