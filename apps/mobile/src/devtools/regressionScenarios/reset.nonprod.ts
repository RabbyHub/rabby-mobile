import { RABBY_MOBILE_KR_PWD } from '@/constant/encryptor';
import { apisKeychain, apisLock } from '@/core/apis';

import { REGRESSION_DEFAULT_PASSWORD } from './credentials.nonprod';
import { clearRegressionScenarioRuntime } from './runtimeStore';
import { removeRegressionScenarioSession } from './sessionStore';

export async function resetRegressionWalletCredentials() {
  const result = await apisLock.dangerouslyResetPasswordAndKeyrings(
    REGRESSION_DEFAULT_PASSWORD,
    RABBY_MOBILE_KR_PWD,
  );
  if (result.error) {
    throw new Error(result.error);
  }

  await apisKeychain.resetGenericPassword();
  removeRegressionScenarioSession();
  clearRegressionScenarioRuntime();
}
