import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle } from 'lucide-react';

export function ReconCenterPage() {
  const { t } = useTranslation();

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('recon.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('recon.subtitle')}</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>{t('recon.status')}</CardTitle>
          <CardDescription>Ledger connections and variance monitoring.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Bank feed reconciliation</span>
              <span className="font-medium text-emerald-500">98% matched</span>
            </div>
            <Progress value={98} aria-label="Bank feed reconciliation 98 percent matched" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Payroll clearing account</span>
              <span className="font-medium text-amber-500">Variance $1,240</span>
            </div>
            <Progress value={62} aria-label="Payroll clearing account reconciliation 62 percent complete" />
          </div>
          <ul className="space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <AlertCircle className="mt-1 h-4 w-4 text-amber-500" aria-hidden />
              <div>
                <p className="font-medium text-foreground">Variance detected in clearing account</p>
                <p className="text-muted-foreground">Assigning to Recon Analyst queue</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="mt-1 h-4 w-4 text-emerald-500" aria-hidden />
              <div>
                <p className="font-medium text-foreground">Stripe settlement matched</p>
                <p className="text-muted-foreground">Confirmed by Automation rules 23 mins ago</p>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
