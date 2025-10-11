import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Shield, CheckCircle, AlertTriangle } from 'lucide-react';

export function DashboardPage() {
  const { t } = useTranslation();

  return (
    <section className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm text-muted-foreground">{t('dashboard.welcome')} Jordan</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('navigation.dashboard')}</h1>
          <p className="text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>
        <Button type="button" className="self-start">
          Launch workspace
          <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
        </Button>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{t('dashboard.readiness')}</CardTitle>
            <CardDescription>Overview of current control performance.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/60 p-4">
              <Shield className="mt-1 h-5 w-5 text-primary" aria-hidden />
              <div>
                <p className="font-medium text-foreground">Critical controls</p>
                <p className="text-sm text-muted-foreground">92% passing across 14 monitored controls.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/60 p-4">
              <CheckCircle className="mt-1 h-5 w-5 text-emerald-500" aria-hidden />
              <div>
                <p className="font-medium text-foreground">Tasks completed</p>
                <p className="text-sm text-muted-foreground">18 actions closed out in the past 7 days.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.openTasks')}</CardTitle>
            <CardDescription>Upcoming obligations needing attention.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              <li>
                <p className="text-sm font-medium">Prepare Q2 BAS evidence</p>
                <p className="text-xs text-muted-foreground">Due in 3 days · Assigned to Jordan Diaz</p>
              </li>
              <li>
                <p className="text-sm font-medium">Review payroll reconciliation</p>
                <p className="text-xs text-muted-foreground">Due in 6 days · Assigned to Sam Chen</p>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.recentActivity')}</CardTitle>
          <CardDescription>Latest updates across BAS, reconciliation, and evidence.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border text-sm">
            <li className="flex items-start gap-3 py-3">
              <AlertTriangle className="mt-1 h-4 w-4 text-amber-500" aria-hidden />
              <div>
                <p className="font-medium text-foreground">Variance flagged in payroll clearing account</p>
                <p className="text-xs text-muted-foreground">Recon Center · Investigate within 24 hours</p>
              </div>
            </li>
            <li className="flex items-start gap-3 py-3">
              <CheckCircle className="mt-1 h-4 w-4 text-emerald-500" aria-hidden />
              <div>
                <p className="font-medium text-foreground">Evidence item verified: Supplier agreements</p>
                <p className="text-xs text-muted-foreground">Evidence & Audit · Marked by Leila Rao</p>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
