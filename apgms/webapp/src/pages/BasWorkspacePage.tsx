import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarClock, FileSpreadsheet } from 'lucide-react';

export function BasWorkspacePage() {
  const { t } = useTranslation();

  return (
    <section className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('bas.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('bas.subtitle')}</p>
        </div>
        <Button type="button" className="self-start">
          Start new BAS
        </Button>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('bas.summary')}</CardTitle>
            <CardDescription>ATO lodgements across the financial year.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="mt-1 h-4 w-4 text-primary" aria-hidden />
              <div>
                <p className="font-medium">FY24 Q1</p>
                <p className="text-muted-foreground">Submitted · Refund of $12,300 processed</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="mt-1 h-4 w-4 text-primary" aria-hidden />
              <div>
                <p className="font-medium">FY24 Q2</p>
                <p className="text-muted-foreground">In review · Awaiting approval from CFO</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('bas.upcoming')}</CardTitle>
            <CardDescription>Keep compliance dates visible for the team.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-1 h-4 w-4 text-primary" aria-hidden />
              <div>
                <p className="font-medium">Prepare FY24 Q3</p>
                <p className="text-muted-foreground">Working papers due 15 Apr · Evidence owner: Asha Patel</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-1 h-4 w-4 text-primary" aria-hidden />
              <div>
                <p className="font-medium">Submit IAS</p>
                <p className="text-muted-foreground">Payment scheduled 21 Apr · Status: Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
