import React, { useId, useState, type PropsWithChildren } from 'react';
import { cn } from '../../lib/utils';

type TabsProps = PropsWithChildren<{ defaultValue: string; className?: string }>;

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
  id: string;
};

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

function TabsRoot({ defaultValue, className, children }: TabsProps) {
  const [value, setValue] = useState(defaultValue);
  const id = useId();

  return (
    <TabsContext.Provider value={{ value, setValue, id }}>
      <div className={cn('tabs', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

function useTabsContext() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within Tabs');
  }
  return context;
}

type TabsListProps = PropsWithChildren;

function TabsList({ children }: TabsListProps) {
  return (
    <div className="tabs-list" role="tablist">
      {children}
    </div>
  );
}

type TabsTriggerProps = PropsWithChildren<{ value: string }>;

function TabsTrigger({ value, children }: TabsTriggerProps) {
  const { value: selected, setValue, id } = useTabsContext();
  const tabId = `${id}-tab-${value}`;
  const panelId = `${id}-panel-${value}`;

  return (
    <button
      id={tabId}
      role="tab"
      type="button"
      aria-selected={selected === value}
      aria-controls={panelId}
      className={cn('tab-trigger', selected === value && 'active')}
      onClick={() => setValue(value)}
    >
      {children}
    </button>
  );
}

type TabsContentProps = PropsWithChildren<{ value: string }>;

function TabsContent({ value, children }: TabsContentProps) {
  const { value: selected, id } = useTabsContext();
  const isActive = selected === value;
  const panelId = `${id}-panel-${value}`;
  const tabId = `${id}-tab-${value}`;

  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={tabId}
      hidden={!isActive}
      className="tab-content"
    >
      {isActive && children}
    </div>
  );
}

export const Tabs = Object.assign(TabsRoot, {
  List: TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent
});
