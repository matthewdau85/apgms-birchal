import React from 'react';
import SectionCard from './SectionCard';

type FormSectionProps = {
  title: string;
  subtitle?: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
};

const FormSection: React.FC<FormSectionProps> = ({
  title,
  subtitle,
  description,
  children,
  action,
}) => {
  return (
    <SectionCard title={title} subtitle={subtitle} action={action}>
      {description ? <p style={{ margin: 0, color: '#475467' }}>{description}</p> : null}
      <div className="form-grid">{children}</div>
    </SectionCard>
  );
};

export default FormSection;
