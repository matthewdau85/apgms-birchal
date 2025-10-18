import React from 'react';

type TimelineEvent = {
  date: string;
  title: string;
  description: string;
  owner: string;
};

type TimelineProps = {
  events: TimelineEvent[];
};

const Timeline: React.FC<TimelineProps> = ({ events }) => {
  return (
    <div className="timeline">
      {events.map((event) => (
        <div key={`${event.date}-${event.title}`} className="timeline-item">
          <span className="timeline-item__date">{event.date}</span>
          <div className="timeline-item__content">
            <strong>{event.title}</strong>
            <p style={{ margin: '8px 0 0' }}>{event.description}</p>
            <small style={{ color: '#1d4ed8', fontWeight: 600 }}>Owner: {event.owner}</small>
          </div>
        </div>
      ))}
    </div>
  );
};

export type { TimelineEvent };
export default Timeline;
