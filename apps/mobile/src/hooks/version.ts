import { useAtomValue } from 'jotai';

import { atomByMMKV } from '@/core/storage/mmkv';

import { writeAtom } from '@/components/JotaiNexus';

export type RemoteVersionRes = {
  version?: string;
  downloadUrl?: string;
  versionDesc?: string;
  forceUpdate?: boolean;
};

const RemoteVersionState = atomByMMKV<RemoteVersionRes>(
  'RemoteVersionMMKV',
  {},
);

export const useRemoteVersion = () => {
  return useAtomValue(RemoteVersionState);
};

export const setRemoteVersion = (arg: RemoteVersionRes) => {
  writeAtom(RemoteVersionState, [arg]);
};
