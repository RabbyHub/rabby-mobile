import { securityEngineService } from './shared';

export async function initServices() {
  return Promise.all([securityEngineService.init()]);
}
