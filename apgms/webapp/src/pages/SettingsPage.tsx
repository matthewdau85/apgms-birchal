import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function SettingsPage() {
  const { t } = useTranslation();

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('settings.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('settings.subtitle')}</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Organisation profile</CardTitle>
            <CardDescription>Control legal entity and contact details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="org-name">
                Legal name
              </label>
              <Input id="org-name" name="org-name" defaultValue="Birchal Capital Pty Ltd" autoComplete="organization" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="org-abn">
                ABN
              </label>
              <Input id="org-abn" name="org-abn" defaultValue="23 456 789 123" autoComplete="off" />
            </div>
            <Button type="button">Save changes</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Notification preferences</CardTitle>
            <CardDescription>Choose how your team receives updates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <label className="flex items-center justify-between gap-4">
              <span>Email summaries</span>
              <input type="checkbox" defaultChecked aria-label="Enable email summaries" className="h-4 w-4" />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span>Slack notifications</span>
              <input type="checkbox" aria-label="Enable Slack notifications" className="h-4 w-4" />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span>Escalation SMS</span>
              <input type="checkbox" aria-label="Enable escalation SMS" className="h-4 w-4" />
            </label>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
