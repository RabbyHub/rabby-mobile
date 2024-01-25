import provider from '../controllers';
import { ProviderRequest } from '../controllers/type';

export function sendRequest<T = any>(
  data: ProviderRequest['data'],
  session: ProviderRequest['session'],
) {
  return provider<T>({
    data,
    session,
  });
}
