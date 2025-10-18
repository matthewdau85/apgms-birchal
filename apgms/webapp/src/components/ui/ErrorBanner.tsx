interface ErrorBannerProps {
  message: string;
}

export const ErrorBanner = ({ message }: ErrorBannerProps) => (
  <div role="alert" className="error-banner">
    <span>⚠️</span>
    <p>{message}</p>
  </div>
);
