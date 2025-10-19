export type ReportType =
  | 'COMPLIANCE_SUMMARY'
  | 'PAYMENT_HISTORY'
  | 'TAX_OBLIGATIONS'
  | 'DISCREPANCY_LOG';

export interface GenerateReportPayload {
  reportType: ReportType;
  startDate: string;
  endDate: string;
}

export interface GenerateReportResponse {
  reportId: string;
}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
};

const throwOnError = async (response: Response) => {
  if (!response.ok) {
    let detail: string | undefined;
    try {
      const payload = await response.json();
      if (payload && typeof payload.message === 'string') {
        detail = payload.message;
      }
    } catch (error) {
      // Swallow JSON parsing errors – fall back to the status text below.
    }

    const message = detail ?? response.statusText ?? 'Request failed';
    throw new Error(message);
  }
};

export const dashboardAPI = {
  async generateReport(payload: GenerateReportPayload) {
    const response = await fetch('/api/reports/generate', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    });

    await throwOnError(response);
    const data = (await response.json()) as GenerateReportResponse;
    return { data };
  },

  async downloadReport(reportId: string) {
    const response = await fetch(`/api/reports/${encodeURIComponent(reportId)}/download`, {
      method: 'GET',
      headers: {
        Accept: 'application/pdf',
      },
    });

    await throwOnError(response);
    const data = await response.blob();
    return { data };
  },
};

export type DashboardAPI = typeof dashboardAPI;
