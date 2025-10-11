import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Paperclip, Upload } from 'lucide-react';

const EVIDENCE_ITEMS = [
  {
    id: 'ev-1',
    title: 'Supplier contracts FY24',
    owner: 'Leila Rao',
    status: 'Approved'
  },
  {
    id: 'ev-2',
    title: 'Payroll tax statements',
    owner: 'Jordan Diaz',
    status: 'Pending review'
  },
  {
    id: 'ev-3',
    title: 'Lease agreements',
    owner: 'Sam Chen',
    status: 'Updated'
  }
];

export function EvidenceAuditPage() {
  const { t } = useTranslation();

  return (
    <section className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('evidence.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('evidence.subtitle')}</p>
        </div>
        <Button type="button" className="self-start">
          <Upload className="mr-2 h-4 w-4" aria-hidden />
          Upload evidence
        </Button>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>{t('evidence.evidenceLog')}</CardTitle>
          <CardDescription>Ensure auditors have everything they need.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-72">
            <table className="w-full table-fixed border-separate border-spacing-y-2 text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    Evidence name
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Owner
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-2 sr-only">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {EVIDENCE_ITEMS.map(item => (
                  <tr key={item.id} className="rounded-lg border border-border bg-card/80">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-primary" aria-hidden />
                        <span className="font-medium text-foreground">{item.title}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{item.owner}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-secondary px-2 py-1 text-xs text-secondary-foreground">{item.status}</span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button type="button" variant="ghost" size="sm">
                        View details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>
    </section>
  );
}
