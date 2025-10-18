import { cloneElement, isValidElement, type ReactNode } from 'react';

interface FormFieldProps {
  id: string;
  label: string;
  description?: string;
  error?: string;
  children: ReactNode;
}

export function FormField({ id, label, description, error, children }: FormFieldProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const shouldEnhance =
    isValidElement(children) &&
    (typeof children.type !== 'string' || ['input', 'select', 'textarea'].includes(children.type));

  const control = shouldEnhance
    ? cloneElement(children, {
        id,
        'aria-describedby': [descriptionId, errorId, children.props['aria-describedby']]
          .filter(Boolean)
          .join(' ') || undefined,
        'aria-invalid': Boolean(error) || undefined
      })
    : children;

  return (
    <div className="form-field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {description && (
        <p className="muted" id={descriptionId}>
          {description}
        </p>
      )}
      <div>{control}</div>
      {error && (
        <p role="alert" className="error-text" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}
