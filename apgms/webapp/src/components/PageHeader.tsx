import React from 'react';

type PageHeaderProps = {
  title: string;
  description: string;
  actions?: React.ReactNode;
};

const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions }) => {
  return (
    <header className="page-header">
      <div>
        <h1 className="page-header__title">{title}</h1>
        <p className="page-header__description">{description}</p>
      </div>
      {actions ? <div>{actions}</div> : null}
    </header>
  );
};

export default PageHeader;
