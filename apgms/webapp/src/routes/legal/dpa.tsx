import type { LegalLink, LegalPage } from './terms';

const exportLink: LegalLink = {
  label: 'Administrator Export Endpoint',
  href: '/privacy/export',
  description: 'Submit structured export requests for all data processed on behalf of the controller.',
};

const deleteLink: LegalLink = {
  label: 'Administrator Deletion Endpoint',
  href: '/privacy/delete',
  description: 'Certify erasure workflows for controller-supplied data and obtain completion attestations.',
};

const processingSummary =
  'APGMS acts as a data processor, providing managed fundraising and investor management tooling. Processing occurs within Australian data centres with sub-processors listed in the vendor appendix. Security measures include ISO 27001-aligned controls, encryption at rest, and role-based access for support staff.';

export const dpa: LegalPage = {
  title: 'Data Processing Addendum',
  updated: '2024-11-01',
  sections: [
    {
      heading: 'Scope & Subject Matter',
      body: [
        'This DPA supplements the master services agreement between APGMS and the data controller, defining obligations for personal data processed by the platform.',
        processingSummary,
      ],
    },
    {
      heading: 'Processor Obligations',
      body: [
        'APGMS processes personal data solely on documented controller instructions, ensures confidentiality commitments, and maintains technical and organisational measures described in Annex B.',
        'Data transfers outside Australia require prior written approval and leverage standard contractual clauses when available.',
      ],
      links: [exportLink, deleteLink],
    },
    {
      heading: 'Assistance & Cooperation',
      body: [
        'We assist controllers in meeting privacy obligations, including responding to data subject access requests, breach notifications, and DPIAs.',
        'Incident notifications occur without undue delay and include remediation actions, impact assessments, and contact information for the appointed privacy officer.',
      ],
      links: [exportLink, deleteLink],
    },
  ],
};

export default dpa;
