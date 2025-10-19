import type { LegalLink, LegalPage } from './terms';

const exportLink: LegalLink = {
  label: 'Submit Export Request',
  href: '/privacy/export',
  description:
    'Use the export endpoint to generate a secure package of your personal data. We deliver results within 7 calendar days.',
};

const deleteLink: LegalLink = {
  label: 'Submit Deletion Request',
  href: '/privacy/delete',
  description:
    'Verified administrators can start a deletion workflow and receive confirmation once retention obligations are met.',
};

const privacyControlsSummary =
  'Access controls, encryption, and immutable audit trails protect personal information. We segregate production and analytics environments, monitor for anomalous access, and document third-party processors in our vendor registry.';

export const privacy: LegalPage = {
  title: 'Privacy Policy',
  updated: '2024-11-01',
  sections: [
    {
      heading: 'Collection & Purpose',
      body: [
        'We collect the minimum personal information necessary to deliver APGMS services, authenticate users, and comply with financial regulations.',
        'Data is sourced directly from customers, integrated payment providers, and operational support tickets submitted by administrators.',
      ],
    },
    {
      heading: 'Data Handling & Retention',
      body: [
        privacyControlsSummary,
        'Backups are encrypted and retained for 30 days. Operational data is retained for 7 years unless a verified deletion request is approved.',
      ],
      links: [exportLink, deleteLink],
    },
    {
      heading: 'Individual Rights',
      body: [
        'Customers may request confirmation of processing, access to records, corrections, and opt-out of marketing communications at any time.',
        'All privacy requests are acknowledged within 48 hours and fulfilled within statutory SLAs. Any denials include the rationale and appeal path.',
      ],
      links: [exportLink, deleteLink],
    },
  ],
};

export default privacy;
