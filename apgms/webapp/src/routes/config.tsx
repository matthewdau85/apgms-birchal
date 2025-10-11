import { LayoutDashboard, Settings, Briefcase, Radar, FileCheck, Rocket } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavigationRoute {
  path: string;
  translationKey: string;
  icon: LucideIcon;
}

export const NAVIGATION_ROUTES: NavigationRoute[] = [
  { path: '/', translationKey: 'navigation.dashboard', icon: LayoutDashboard },
  { path: '/bas-workspace', translationKey: 'navigation.basWorkspace', icon: Briefcase },
  { path: '/recon-center', translationKey: 'navigation.reconCenter', icon: Radar },
  { path: '/evidence-audit', translationKey: 'navigation.evidenceAudit', icon: FileCheck },
  { path: '/settings', translationKey: 'navigation.settings', icon: Settings },
  { path: '/onboarding', translationKey: 'navigation.onboarding', icon: Rocket }
];

export const ONBOARDING_STEPS = [
  'welcome',
  'organization',
  'compliance',
  'team',
  'integrations',
  'review'
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number];

export const DEFAULT_ONBOARDING_STEP: OnboardingStepId = 'welcome';
