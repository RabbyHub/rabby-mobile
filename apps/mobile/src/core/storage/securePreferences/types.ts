import { APP_STORE_NAMES } from '../storeConstant';

export const securePreferenceNames = [
  APP_STORE_NAMES.whitelist,
  APP_STORE_NAMES.contactBook,
  APP_STORE_NAMES.securityEngine,
  APP_STORE_NAMES.rpc,
] as const;

export const securePreferenceEventNames = {
  damaged: 'sec-setting-damaged',
  unavailable: 'sec-setting-unavailable',
} as const;

export const securePreferenceStages = [
  'key-open',
  'key-commit',
  'initialize-records',
  'record-missing',
  'record-read',
  'record-verify',
  'record-write',
] as const;

export type SecurePreferenceName = (typeof securePreferenceNames)[number];
export type SecurePreferenceStage = (typeof securePreferenceStages)[number];
export type SecurePreferenceIssue = {
  name: SecurePreferenceName;
  kind: keyof typeof securePreferenceEventNames;
};
export type SecurePreferenceReport = SecurePreferenceIssue & {
  stage: SecurePreferenceStage;
};
