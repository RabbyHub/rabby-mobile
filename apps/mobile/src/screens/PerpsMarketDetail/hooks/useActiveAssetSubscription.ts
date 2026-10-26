// Keep the Simple-screen import stable while sharing the subscription owner
// with Perps Pro. The shared hook defaults to enabled, preserving Simple's
// existing subscription, cache seeding, foreground, and account-switch rules.
export { useActiveAssetSubscription } from '@/hooks/perps/subscriptions/useActiveAssetSubscription';
