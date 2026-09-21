import { callCoreService } from './serviceRegistry';

export async function initServices() {
  return Promise.all([
    callCoreService('securityEngineService', securityEngineService =>
      securityEngineService.init(),
    ),
  ]);
}
