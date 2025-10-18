import React, { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import FormSection from '../components/FormSection';

const claimTemplates = [
  'An autonomous greenhouse mesh system comprising sensor clusters orchestrated by adaptive AI agents.',
  'The system of claim 1 wherein predictive irrigation is tuned via reinforcement learning loops.',
  'A method for dynamically allocating solar shading and nutrient delivery using digital twin feedback.',
];

const jurisdictions = ['United States (USPTO)', 'European Union (EPO)', 'Japan (JPO)', 'Australia (IP Australia)'];

const ApplicationBuilderPage: React.FC = () => {
  const [selectedTemplate, setSelectedTemplate] = useState(claimTemplates[0]);
  const [selectedJurisdictions, setSelectedJurisdictions] = useState<string[]>(['United States (USPTO)']);

  const jurisdictionSummary = useMemo(() => {
    return selectedJurisdictions.join(', ');
  }, [selectedJurisdictions]);

  return (
    <div className="page-grid" style={{ gap: 32 }}>
      <PageHeader
        title="Application builder"
        description="Author, localize, and validate your patent package from a single workspace. Start with AI-assisted claim drafting, harmonize embodiments, and export to jurisdiction-ready formats."
        actions={
          <button className="primary-button" type="button">
            Create filing packet
          </button>
        }
      />

      <FormSection
        title="Filing overview"
        subtitle="Foundation details shared across all jurisdictions"
        description="Capture the commercial context and designate strategic territories. The studio pre-fills disclosure templates and harmonizes metadata for each office."
      >
        <div className="form-field">
          <label htmlFor="working-title">Working title</label>
          <input id="working-title" placeholder="Autonomous greenhouse mesh orchestration" defaultValue="Autonomous greenhouse mesh orchestration" />
        </div>
        <div className="form-field">
          <label htmlFor="inventors">Inventors</label>
          <input id="inventors" placeholder="Add inventors" defaultValue="Clara Preston, Tariq Menon" />
        </div>
        <div className="form-field">
          <label htmlFor="jurisdictions">Target jurisdictions</label>
          <select
            id="jurisdictions"
            multiple
            value={selectedJurisdictions}
            onChange={(event) => {
              const options = Array.from(event.target.selectedOptions).map((option) => option.value);
              setSelectedJurisdictions(options);
            }}
          >
            {jurisdictions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="summary">Commercial summary</label>
          <textarea
            id="summary"
            placeholder="What market problem does this invention solve?"
            defaultValue="Our autonomous greenhouse mesh coordinates climate, nutrient, and energy systems across 80+ micro-zones with AI-driven control."
          />
        </div>
        <div className="form-field" style={{ gridColumn: '1 / -1' }}>
          <label>Localization plan</label>
          <div className="prior-art-result">
            <strong>{jurisdictionSummary}</strong>
            <span style={{ color: '#475467' }}>
              Translation and formatting will be harmonized. Auto-generate country-specific figures and claim numbering.
            </span>
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Claim architect"
        subtitle="Curate independent and dependent claim sets"
        description="Start from AI proposals, edit collaboratively, and map dependencies. Drafting insights surface enablement gaps before review."
        action={<button className="secondary-button">Export claim tree</button>}
      >
        <div className="form-field" style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="claim-template">Suggested independent claim</label>
          <select
            id="claim-template"
            value={selectedTemplate}
            onChange={(event) => setSelectedTemplate(event.target.value)}
          >
            {claimTemplates.map((template) => (
              <option key={template} value={template}>
                {template}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field" style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="claim-draft">Current draft</label>
          <textarea
            id="claim-draft"
            rows={8}
            defaultValue={`${selectedTemplate} The system interfaces with distributed actuator arrays via a secure mesh protocol to maintain optimal agronomic conditions.`}
          />
        </div>
        <div className="form-field">
          <label htmlFor="claim-dependencies">Dependency map</label>
          <textarea
            id="claim-dependencies"
            rows={6}
            defaultValue={`Claim 2 depends on Claim 1 and restricts the irrigation agent to reinforcement tuning.\nClaim 3 depends on Claim 1 and adds solar shading orchestration.`}
          />
        </div>
        <div className="form-field">
          <label htmlFor="supporting-figures">Supporting figures</label>
          <textarea
            id="supporting-figures"
            rows={6}
            defaultValue={`Fig. 3: Sensor cluster architecture\nFig. 5: Digital twin feedback loop\nFig. 7: Reinforcement learning controller`}
          />
        </div>
      </FormSection>

      <FormSection
        title="Enablement evidence"
        subtitle="Attach experiments, data, and implementation detail"
        description="Demonstrate the invention's reproducibility with structured annexes. Drag in CAD models, lab results, and code extracts."
      >
        <div className="form-field">
          <label htmlFor="prototype-status">Prototype maturity</label>
          <select id="prototype-status" defaultValue="Pilot validated">
            <option>Concept validated</option>
            <option>Pilot validated</option>
            <option>Commercial deployment</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="evidence-links">Evidence repository</label>
          <input id="evidence-links" placeholder="https://drive.com/patent-folder" defaultValue="https://drive.com/greenhouse-autonomy" />
        </div>
        <div className="form-field" style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="notes">Reviewer notes</label>
          <textarea id="notes" rows={4} placeholder="Add reviewer-specific context" />
        </div>
      </FormSection>
    </div>
  );
};

export default ApplicationBuilderPage;
