export interface LegalLink {
  readonly label: string;
  readonly href: string;
  readonly description: string;
}

export interface LegalSection {
  readonly heading: string;
  readonly body: readonly string[];
  readonly links?: readonly LegalLink[];
}

export interface LegalPage {
  readonly title: string;
  readonly updated: string;
  readonly sections: readonly LegalSection[];
}

const privacyLinks: readonly LegalLink[] = [
  {
    label: 'Request Data Export',
    href: '/privacy/export',
    description:
      'Submit a formal export request via the administrative privacy endpoint to receive a machine-readable archive of your records.',
  },
  {
    label: 'Request Data Deletion',
    href: '/privacy/delete',
    description:
      'Trigger a deletion workflow through the administrative privacy endpoint. We confirm completion within mandated retention timelines.',
  },
];

const dataHandlingSummary =
  'We collect only operational account details, payment confirmations, and audit trails. All customer data is encrypted at rest, limited to least-privilege operators, and retained for the minimum statutory period (currently 7 years for financial records).';

export const terms: LegalPage = {
  title: 'Terms of Service',
  updated: '2024-11-01',
  sections: [
    {
      heading: 'Acceptance of Terms',
      body: [
        'By accessing the APGMS platform you agree to the service rules, acceptable use, and platform policies published herein.',
        'Updates to these terms are communicated via email with at least 14 days notice and archived in the release notes.',
      ],
    },
    {
      heading: 'Data Handling & Privacy',
      body: [
        dataHandlingSummary,
        'Customers may invoke the privacy export or deletion workflows at any time. Requests are authenticated and logged for compliance review.',
      ],
      links: privacyLinks,
    },
    {
      heading: 'Service Availability & Support',
      body: [
        'Platform availability targets 99.5% monthly uptime with scheduled maintenance windows announced 72 hours in advance.',
        'Priority incidents are triaged within 1 business hour through the on-call escalation path documented in the NDB runbook.',
      ],
    },
  ],
};

export default terms;

export function renderLegalPage(page: LegalPage): string {
  const sectionHtml = page.sections
    .map((section) => {
      const paragraphs = section.body.map((paragraph) => `<p>${paragraph}</p>`).join('');
      const links = (section.links ?? [])
        .map(
          (link) =>
            `<li><a href="${link.href}">${link.label}</a><span class="description">${link.description}</span></li>`
        )
        .join('');
      const listMarkup = links ? `<ul class="legal-links">${links}</ul>` : '';
      return `<section><h2>${section.heading}</h2>${paragraphs}${listMarkup}</section>`;
    })
    .join('');
  return `<main><h1>${page.title}</h1><p class="updated">Last updated ${page.updated}</p>${sectionHtml}</main>`;
}
