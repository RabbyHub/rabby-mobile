import {
  DocumentDirectoryPath,
  mkdir,
  writeFile,
} from '@rabby-wallet/react-native-fs';

type ParseOverride = {
  typedDataKey: string;
  response: any;
};

let parseOverride: ParseOverride | null = null;
let captureName: string | null = null;

export function setApprovalParseOverride(value: ParseOverride | null) {
  parseOverride = value;
}

export function clearApprovalParseOverride() {
  parseOverride = null;
}

export function getApprovalParseOverride(typedData: any) {
  if (!parseOverride) {
    return null;
  }
  try {
    return JSON.stringify(typedData) === parseOverride.typedDataKey
      ? parseOverride.response
      : null;
  } catch {
    return null;
  }
}

export function setApprovalParseCapture(name: string | null) {
  captureName = name;
}

export async function maybeCaptureApprovalParse(typedData: any, response: any) {
  if (!captureName) {
    return;
  }
  const name = captureName;
  captureName = null;
  const dir = `${DocumentDirectoryPath}/screen-registry-fixtures`;
  await mkdir(dir);
  const typedDataKey = JSON.stringify(typedData);
  await writeFile(
    `${dir}/${name}.json`,
    JSON.stringify({ typedData, typedDataKey, response }, null, 2),
    'utf8',
  );
  console.log('[approval-parse] captured', name);
}
