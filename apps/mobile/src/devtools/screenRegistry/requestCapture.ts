import {
  DocumentDirectoryPath,
  mkdir,
  writeFile,
} from '@rabby-wallet/react-native-fs';

let captureEnabled = false;
let allowAnyApproval = false;

export function setAllowAnyApproval(value: boolean) {
  allowAnyApproval = value;
}

export function isAllowAnyApproval() {
  return allowAnyApproval;
}

export function setRequestCaptureEnabled(value: boolean) {
  captureEnabled = value;
}

export function isRequestCaptureEnabled() {
  return captureEnabled;
}

/**
 * Dump an incoming provider request before any approval/window logic runs.
 * Useful for real dapp requests that `ApprovalContent` would otherwise hide
 * (e.g. a tab-id mismatch renders "No approve found").
 */
export async function captureProviderRequest(request: any) {
  if (!captureEnabled) {
    return;
  }
  const method = request?.data?.method;
  if (!method) {
    return;
  }
  const dir = `${DocumentDirectoryPath}/screen-registry-fixtures/requests`;
  await mkdir(dir);
  const name = `${Date.now()}-${String(method).replace(/[^\w.-]/g, '_')}`;
  await writeFile(
    `${dir}/${name}.json`,
    JSON.stringify(
      {
        capturedAt: Date.now(),
        method,
        origin:
          request?.requestContext?.origin || request?.session?.origin || null,
        requestContext: request?.requestContext ?? null,
        session: request?.session ?? null,
        account: request?.account ?? null,
        data: request?.data ?? null,
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log('[request-capture] wrote', name, method);
}
