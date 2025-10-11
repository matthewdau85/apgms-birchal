import { Link, useLocation, matchPath } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NAVIGATION_ROUTES, ONBOARDING_STEPS, type OnboardingStepId } from '@/routes/config';

interface Crumb {
  label: string;
  path: string;
}

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const { t } = useTranslation();

  const crumbs: Crumb[] = [];

  if (pathname !== '/') {
    crumbs.push({ label: t('navigation.dashboard'), path: '/' });
  }

  const primaryMatch = NAVIGATION_ROUTES.find(route => route.path !== '/' && pathname.startsWith(route.path));
  if (primaryMatch) {
    const label = t(primaryMatch.translationKey);
    crumbs.push({ label, path: primaryMatch.path === '/onboarding' ? '/onboarding' : primaryMatch.path });
  }

  const onboardingMatch = matchPath('/onboarding/:stepId', pathname);
  if (onboardingMatch && onboardingMatch.params.stepId) {
    const stepId = onboardingMatch.params.stepId as OnboardingStepId;
    if (ONBOARDING_STEPS.includes(stepId)) {
      crumbs.push({ label: t(`onboarding.steps.${stepId}.name`), path: `/onboarding/${stepId}` });
    }
  }

  if (crumbs.length === 0) {
    crumbs.push({ label: t('navigation.dashboard'), path: '/' });
  }

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-2">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={crumb.path} className="flex items-center gap-2">
              {isLast ? (
                <span aria-current="page" className="font-medium text-foreground">
                  {crumb.label}
                </span>
              ) : (
                <Link className="hover:text-foreground" to={crumb.path}>
                  {crumb.label}
                </Link>
              )}
              {!isLast && <span aria-hidden>/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
