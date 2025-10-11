import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      navigation: {
        dashboard: 'Dashboard',
        basWorkspace: 'BAS Workspace',
        reconCenter: 'Recon Center',
        evidenceAudit: 'Evidence & Audit',
        settings: 'Settings',
        onboarding: 'Onboarding Wizard'
      },
      topbar: {
        search: 'Search the platform',
        help: 'Help center',
        notifications: 'Notifications',
        profile: 'Profile'
      },
      orgs: {
        primary: 'Birchal Capital',
        secondary: 'APGMS Advisory',
        tertiary: 'Launch Partners'
      },
      dashboard: {
        welcome: 'Welcome back,',
        subtitle: 'Here is a quick overview of your compliance posture today.',
        readiness: 'Readiness status',
        openTasks: 'Open tasks',
        recentActivity: 'Recent activity'
      },
      bas: {
        title: 'BAS Workspace',
        subtitle: 'Track and manage your Business Activity Statements with confidence.',
        summary: 'Submission summary',
        upcoming: 'Upcoming lodgements'
      },
      recon: {
        title: 'Recon Center',
        subtitle: 'Monitor reconciliation progress across ledgers and banking.',
        status: 'Reconciliation status'
      },
      evidence: {
        title: 'Evidence & Audit',
        subtitle: 'Centralize documentation for fast audit response.',
        evidenceLog: 'Evidence log'
      },
      settings: {
        title: 'Settings',
        subtitle: 'Configure organization, preferences, and integrations.'
      },
      onboarding: {
        title: 'Onboarding wizard',
        subtitle: 'Complete these steps to get APGMS ready for your team.',
        steps: {
          welcome: {
            name: 'Welcome',
            description: 'Overview of the onboarding process.'
          },
          organization: {
            name: 'Organization details',
            description: 'Confirm legal entity information.'
          },
          compliance: {
            name: 'Compliance scope',
            description: 'Select frameworks and obligations.'
          },
          team: {
            name: 'Team access',
            description: 'Invite collaborators and assign roles.'
          },
          integrations: {
            name: 'Integrations',
            description: 'Connect accounting and evidence sources.'
          },
          review: {
            name: 'Review & launch',
            description: 'Validate setup and finish onboarding.'
          }
        },
        actions: {
          next: 'Next',
          back: 'Back',
          finish: 'Finish setup'
        }
      }
    }
  }
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  }
});

export default i18n;
