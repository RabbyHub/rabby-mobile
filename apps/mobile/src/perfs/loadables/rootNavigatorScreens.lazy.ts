import { registerAppScreen } from '@/perfs/apis';

export const WebViewControlPreload = registerAppScreen<
  typeof import('@/components/WebView/WebViewControlPreload').default
>({
  loader: () => import('@/components/WebView/WebViewControlPreload'),
  name: 'WebViewControlPreload',
});
