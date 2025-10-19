import React, { useMemo, useState } from 'react';
import { Calendar, Download, FileText } from 'lucide-react';
import { dashboardAPI, ReportType } from '../services/api';

type FeedbackState = {
  type: 'success' | 'error';
  message: string;
};

const REPORT_OPTIONS: { value: ReportType; label: string; description: string }[] = [
  {
    value: 'COMPLIANCE_SUMMARY',
    label: 'Compliance Summary',
    description:
      'Comprehensive overview of your compliance history, including on-time lodgments, alerts, and compliance score.',
  },
  {
    value: 'PAYMENT_HISTORY',
    label: 'Payment History',
    description: 'Detailed record of all PAYGW and GST payments made during the selected period.',
  },
  {
    value: 'TAX_OBLIGATIONS',
    label: 'Tax Obligations',
    description:
      'Breakdown of all tax obligations calculated during the selected period, including payroll and GST transactions.',
  },
  {
    value: 'DISCREPANCY_LOG',
    label: 'Discrepancy Log',
    description: 'Record of all discrepancies detected and resolved, useful for audit purposes.',
  },
];

const ReportsPage: React.FC = () => {
  const [reportType, setReportType] = useState<ReportType>('COMPLIANCE_SUMMARY');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedReportId, setGeneratedReportId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const isGenerateDisabled = useMemo(
    () => generating || !startDate || !endDate,
    [endDate, generating, startDate],
  );

  const handleGenerateReport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setFeedback(null);

    if (!startDate || !endDate) {
      setFeedback({ type: 'error', message: 'Please select both start and end dates.' });
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setFeedback({ type: 'error', message: 'Start date must be before the end date.' });
      return;
    }

    try {
      setGenerating(true);
      setGeneratedReportId(null);

      const response = await dashboardAPI.generateReport({
        reportType,
        startDate,
        endDate,
      });

      setGeneratedReportId(response.data.reportId);
      setFeedback({ type: 'success', message: 'Report generated successfully.' });
    } catch (error) {
      console.error('Failed to generate report:', error);
      const message = error instanceof Error ? error.message : 'Failed to generate report.';
      setFeedback({ type: 'error', message });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!generatedReportId) {
      return;
    }

    try {
      const response = await dashboardAPI.downloadReport(generatedReportId);
      const blob = response.data;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `apgms-report-${generatedReportId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download report:', error);
      const message = error instanceof Error ? error.message : 'Failed to download report.';
      setFeedback({ type: 'error', message });
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Generate Reports</h1>

      <div className="bg-white rounded-lg shadow-md p-6">
        <form onSubmit={handleGenerateReport} noValidate>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2" htmlFor="report-type">
              Report Type
            </label>
            <select
              id="report-type"
              value={reportType}
              onChange={(event) => setReportType(event.target.value as ReportType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {REPORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <DateInput
              id="start-date"
              label="Start Date"
              value={startDate}
              onChange={setStartDate}
              max={endDate || undefined}
            />

            <DateInput
              id="end-date"
              label="End Date"
              value={endDate}
              onChange={setEndDate}
              min={startDate || undefined}
            />
          </div>

          <button
            type="submit"
            disabled={isGenerateDisabled}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {generating ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" aria-hidden="true" />
                Generating Report...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5 mr-2" aria-hidden="true" />
                Generate Report
              </>
            )}
          </button>
        </form>

        {feedback && (
          <div
            className={`mt-4 rounded-md border px-4 py-3 text-sm ${
              feedback.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
            role="status"
            aria-live="polite"
          >
            {feedback.message}
          </div>
        )}

        {generatedReportId && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FileText className="w-6 h-6 text-green-600 mr-3" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-green-900">Report Ready</p>
                  <p className="text-sm text-green-700">Report ID: {generatedReportId}</p>
                </div>
              </div>
              <button
                onClick={handleDownloadReport}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                type="button"
              >
                <Download className="w-4 h-4 mr-2" aria-hidden="true" />
                Download PDF
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORT_OPTIONS.map((option) => (
          <ReportTypeCard key={option.value} title={option.label} description={option.description} />
        ))}
      </div>
    </div>
  );
};

interface DateInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}

const DateInput: React.FC<DateInputProps> = ({ id, label, value, onChange, min, max }) => (
  <div>
    <label className="block text-sm font-medium mb-2" htmlFor={id}>
      {label}
    </label>
    <div className="relative">
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        required
      />
      <Calendar className="absolute right-3 top-2.5 w-5 h-5 text-gray-400 pointer-events-none" aria-hidden="true" />
    </div>
  </div>
);

const ReportTypeCard: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="bg-white rounded-lg shadow-md p-4">
    <h3 className="font-semibold mb-2">{title}</h3>
    <p className="text-sm text-gray-600">{description}</p>
  </div>
);

export default ReportsPage;
