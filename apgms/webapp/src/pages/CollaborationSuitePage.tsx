import React from 'react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';

const reviewers = [
  { name: 'Clara Preston', role: 'Lead inventor', focus: 'Technical enablement', status: 'Online' },
  { name: 'Sarah Ito', role: 'Patent counsel', focus: 'Claim strategy', status: 'Reviewing' },
  { name: 'Diego Alvarez', role: 'Market analyst', focus: 'Commercial positioning', status: 'Offline' },
];

const tasks = [
  { title: 'Validate AI search hits', owner: 'Sarah Ito', due: 'Apr 22', status: 'In review' },
  { title: 'Upload pilot data annex', owner: 'Clara Preston', due: 'Apr 19', status: 'In progress' },
  { title: 'Draft commercialization abstract', owner: 'Diego Alvarez', due: 'Apr 24', status: 'Not started' },
];

const comments = [
  {
    author: 'Sarah Ito',
    message: 'Reviewed claims 1-8. Suggest clarifying actuator latency thresholds for international filing.',
    time: '1 hour ago',
  },
  {
    author: 'Clara Preston',
    message: 'Uploaded greenhouse telemetry CSV — ready for enablement annex.',
    time: 'Yesterday',
  },
  {
    author: 'Tariq Menon',
    message: 'Added reinforcement learning diagrams to figure library (see Fig. 9).',
    time: 'Mon 09:30',
  },
];

const CollaborationSuitePage: React.FC = () => {
  return (
    <div className="page-grid" style={{ gap: 32 }}>
      <PageHeader
        title="Collaboration suite"
        description="Synchronize inventors, counsel, and analysts in one command center. Assign tasks, review drafts, and capture feedback anchored to each claim."
        actions={<button className="primary-button">Start review session</button>}
      />

      <div className="page-grid page-grid--two-column">
        <SectionCard title="Contributors" subtitle="Live presence across the patent team">
          <div className="page-grid" style={{ gap: 16 }}>
            {reviewers.map((reviewer) => (
              <div key={reviewer.name} className="section-card" style={{ boxShadow: 'none', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{reviewer.name}</strong>
                  <span className="tag">
                    <span className="status-dot" style={{ background: reviewer.status === 'Offline' ? '#94a3b8' : '#16a34a' }} />
                    {reviewer.status}
                  </span>
                </div>
                <p style={{ margin: '6px 0', color: '#475467' }}>{reviewer.role}</p>
                <small style={{ color: '#155eef', fontWeight: 600 }}>{reviewer.focus}</small>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Action items" subtitle="Workstream aligned with filing timeline">
          <div className="task-list">
            {tasks.map((task) => (
              <div key={task.title} className="task-item">
                <div>
                  <strong>{task.title}</strong>
                  <p style={{ margin: '4px 0 0', color: '#475467' }}>{task.owner}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="badge">Due {task.due}</span>
                  <p style={{ margin: '6px 0 0', color: '#0f172a', fontWeight: 600 }}>{task.status}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Comment stream"
        subtitle="Contextual feedback anchored to claims and annexes"
        action={<button className="secondary-button">Open transcript</button>}
      >
        <div className="comment-thread">
          {comments.map((comment) => (
            <div key={comment.author + comment.time} className="comment">
              <div className="status-dot" style={{ marginTop: 6 }} />
              <div>
                <div className="comment__author">{comment.author}</div>
                <p style={{ margin: '6px 0', color: '#475467' }}>{comment.message}</p>
                <small style={{ color: '#155eef', fontWeight: 600 }}>{comment.time}</small>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
};

export default CollaborationSuitePage;
