import React, { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';

const sampleResults = [
  {
    patent: 'US 11,923,004',
    title: 'Automated horticulture canopy control',
    score: 0.34,
    summary: 'Focuses on canopy sensors but lacks multi-agent mesh coordination.',
    actions: ['Compare claims', 'Add to watchlist'],
  },
  {
    patent: 'EP 3 876 211',
    title: 'Greenhouse climate orchestration platform',
    score: 0.58,
    summary: 'Utilizes cloud orchestration but no reinforcement learning loops.',
    actions: ['Compare claims'],
  },
  {
    patent: 'JP 2023-771211',
    title: 'Nutrient dosing control for vertical farms',
    score: 0.27,
    summary: 'Targets dosing but no predictive solar shading integration.',
    actions: ['Translate', 'Notify counsel'],
  },
];

const filters = ['Novelty overlap', 'Enablement depth', 'AI-generated'];

const PriorArtSearchPage: React.FC = () => {
  const [query, setQuery] = useState('autonomous greenhouse mesh');
  const [activeFilters, setActiveFilters] = useState<string[]>(['Novelty overlap']);

  const filteredResults = useMemo(() => {
    if (!activeFilters.length) {
      return sampleResults;
    }
    return sampleResults.filter((result) => result.score < 0.6);
  }, [activeFilters]);

  return (
    <div className="page-grid" style={{ gap: 32 }}>
      <PageHeader
        title="Prior art intelligence"
        description="Run semantic searches across 120M global assets. Blend USPTO, EPO, JPO and private data, and let the AI engine cluster results by novelty and enablement." 
        actions={<button className="primary-button">Launch semantic map</button>}
      />

      <SectionCard
        title="Query builder"
        subtitle="Refine your search with semantic and Boolean inputs"
        action={<button className="secondary-button">Save search profile</button>}
      >
        <div className="form-grid">
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="query">Semantic query</label>
            <textarea
              id="query"
              rows={3}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="boolean">Boolean must include</label>
            <input id="boolean" placeholder="mesh AND greenhouse" defaultValue="mesh AND greenhouse" />
          </div>
          <div className="form-field">
            <label htmlFor="exclude">Exclude</label>
            <input id="exclude" placeholder="hydroponics" />
          </div>
          <div className="form-field">
            <label htmlFor="published-after">Published after</label>
            <input id="published-after" type="date" defaultValue="2021-01-01" />
          </div>
          <div className="form-field">
            <label htmlFor="jurisdiction">Jurisdiction focus</label>
            <select id="jurisdiction" defaultValue="Global">
              <option>Global</option>
              <option>United States</option>
              <option>European Union</option>
              <option>Japan</option>
            </select>
          </div>
        </div>
        <div className="prior-art-filters">
          {filters.map((filter) => {
            const active = activeFilters.includes(filter);
            return (
              <button
                key={filter}
                className={active ? 'primary-button' : 'secondary-button'}
                type="button"
                onClick={() => {
                  setActiveFilters((prev) =>
                    active ? prev.filter((item) => item !== filter) : [...prev, filter],
                  );
                }}
              >
                {filter}
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Result clusters" subtitle="AI-ranked assets sorted by semantic distance">
        <div className="page-grid" style={{ gap: 20 }}>
          {filteredResults.map((result) => (
            <div key={result.patent} className="prior-art-result">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                  <strong>{result.patent}</strong>
                  <p style={{ margin: '4px 0 0' }}>{result.title}</p>
                </div>
                <div className="badge">Overlap score {(result.score * 100).toFixed(0)}%</div>
              </div>
              <p style={{ margin: 0, color: '#475467' }}>{result.summary}</p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {result.actions.map((action) => (
                  <button key={action} className="secondary-button" type="button">
                    {action}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Signal analytics"
        subtitle="Overlap trend vs last six searches"
        action={<button className="secondary-button">Download CSV</button>}
      >
        <div className="mini-chart">
          {[32, 44, 28, 51, 36, 22].map((value, index) => (
            <div
              key={index}
              className={['mini-chart__bar', index === 3 ? 'mini-chart__bar--accent' : ''].join(' ')}
              style={{ height: `${value + 10}px` }}
            />
          ))}
        </div>
        <p style={{ margin: 0, color: '#475467' }}>
          Week-over-week novelty overlap trending downward 12%. Suggest exploring new reinforcement learning keywords for broader coverage.
        </p>
      </SectionCard>
    </div>
  );
};

export default PriorArtSearchPage;
