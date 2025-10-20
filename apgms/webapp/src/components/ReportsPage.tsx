import React, { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { AxiosError } from 'axios';

import StatusBadge from './StatusBadge';
import { dashboardAPI } from '../services/api';
import { ReportRequest, reportRequestSchema, reportTypeEnum } from '../schemas/reportSchema';

type FormErrors = Partial<Record<keyof ReportRequest, string>>;

type GeneratedReport = {
  id: string;
  status?: string;
  requestedAt?: string;
};

const formatReportType = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const ensurePdfExtension = (filename: string) =>
  filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;

const extractFilename = (dispositionHeader?: string | null, fallback = 'report.pdf') => {
  if (!dispositionHeader) return fallback;

  const filenameStarMatch = dispositionHeader.match(/filename\*\s*=\s*([^;]+)/i);
  if (filenameStarMatch) {
    const value = filenameStarMatch[1].trim();
    const parts = value.split("''");
    if (parts.length === 2) {
      try {
        const decoded = decodeURIComponent(parts[1].replace(/"/g, ''));
        if (decoded) return ensurePdfExtension(decoded);
      } catch (err) {
        console.warn('Failed to decode RFC5987 filename', err);
      }
    }
  }

  const filenameMatch = dispositionHeader.match(/filename\s*=\s*"?([^";]+)"?/i);
  if (filenameMatch && filenameMatch[1]) {
    return ensurePdfExtension(filenameMatch[1].trim());
  }

  return fallback;
};

const deriveReportId = (payload: any) => {
  const candidate =
    payload?.reportId ??
    payload?.id ??
    payload?.data?.reportId ??
    payload?.data?.id ??
    payload?.reference ??
    payload?.uuid ??
    payload?.jobId;
  return (candidate ? String(candidate) : `report-${Date.now()}`) as string;
};

export default function ReportsPage() {
  const reportTypeOptions = useMemo(() => reportTypeEnum.options, []);

  const [formData, setFormData] = useState<ReportRequest>({
    reportType: reportTypeOptions[0],
    startDate: '',
    endDate: '',
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [report, setReport] = useState<GeneratedReport | null>(null);

  const handleInputChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setDownloadError(null);

    const result = reportRequestSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: FormErrors = {};
      const flattened = result.error.flatten();
      (Object.keys(flattened.fieldErrors) as Array<keyof ReportRequest>).forEach((key) => {
        const messages = flattened.fieldErrors[key];
        if (messages?.length) {
          fieldErrors[key] = messages[0];
        }
      });
      setFormErrors(fieldErrors);
      return;
    }

    setFormErrors({});
    setIsSubmitting(true);

    try {
      const { data } = await dashboardAPI.generateReport(result.data);
      const id = deriveReportId(data);
      const status = data?.status ?? data?.state ?? 'READY';
      const requestedAt = data?.requestedAt ?? data?.createdAt ?? new Date().toISOString();

      setReport({ id, status, requestedAt });
    } catch (error) {
      const err = error as AxiosError<any>;
      const message =
        (err.response?.data &&
          (err.response.data.message || err.response.data.error || err.response.data.detail)) ||
        err.message ||
        'Failed to generate report. Please try again later.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async () => {
    if (!report?.id) return;
    setDownloadError(null);
    setIsDownloading(true);

    try {
      const response = await dashboardAPI.downloadReport(report.id);
      const blob = new Blob([response.data], {
        type: response.headers['content-type'] || 'application/pdf',
      });
      const filename = ensurePdfExtension(
        extractFilename(response.headers['content-disposition'], `report-${report.id}.pdf`)
      );
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      const err = error as AxiosError<any>;
      const message =
        (err.response?.data &&
          (err.response.data.message || err.response.data.error || err.response.data.detail)) ||
        err.message ||
        'Failed to download report. Please try again later.';
      setDownloadError(message);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      <div className="rounded-xl bg-white p-6 shadow">
        <h1 className="text-2xl font-semibold text-gray-900">Generate Compliance Report</h1>
        <p className="mt-2 text-sm text-gray-600">
          Choose a report type and date range. Reports are limited to a 12-month window and dates
          must be in YYYY-MM-DD format.
        </p>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="reportType" className="block text-sm font-medium text-gray-700">
              Report Type
            </label>
            <select
              id="reportType"
              name="reportType"
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 px-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={formData.reportType}
              onChange={handleInputChange}
            >
              {reportTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {formatReportType(option)}
                </option>
              ))}
            </select>
            {formErrors.reportType && (
              <p className="mt-1 text-sm text-red-600">{formErrors.reportType}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                Start Date
              </label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                value={formData.startDate}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="YYYY-MM-DD"
              />
              {formErrors.startDate && (
                <p className="mt-1 text-sm text-red-600">{formErrors.startDate}</p>
              )}
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
                End Date
              </label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                value={formData.endDate}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="YYYY-MM-DD"
              />
              {formErrors.endDate && (
                <p className="mt-1 text-sm text-red-600">{formErrors.endDate}</p>
              )}
            </div>
          </div>

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-indigo-300"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Generating…' : 'Generate Report'}
            </button>
          </div>
        </form>
      </div>

      {report && (
        <div className="rounded-xl border border-green-200 bg-white p-6 shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Report Ready</h2>
            <StatusBadge status={report.status ?? 'READY'} />
          </div>
          <dl className="mt-4 space-y-2 text-sm text-gray-700">
            <div>
              <dt className="font-medium text-gray-600">Report ID</dt>
              <dd className="font-mono text-gray-900">{report.id}</dd>
            </div>
            {report.requestedAt && (
              <div>
                <dt className="font-medium text-gray-600">Requested At</dt>
                <dd>{new Date(report.requestedAt).toLocaleString()}</dd>
              </div>
            )}
          </dl>

          {downloadError && <p className="mt-3 text-sm text-red-600">{downloadError}</p>}

          <div className="mt-4">
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center rounded-md border border-transparent bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-emerald-300"
              disabled={isDownloading}
            >
              {isDownloading ? 'Downloading…' : 'Download PDF'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
