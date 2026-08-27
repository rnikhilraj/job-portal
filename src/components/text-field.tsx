type TextFieldProps = {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'tel';
  value: string;
  onChange: (value: string) => void;
  errors?: string[];
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  hint?: string;
};

/** Input plus label, hint and the server's per-field validation messages. */
export function TextField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  errors,
  required,
  placeholder,
  autoComplete,
  hint,
}: TextFieldProps) {
  const errorId = `${name}-error`;
  const hasError = Boolean(errors?.length);

  return (
    <div>
      <label htmlFor={name} className="field-label">
        {label}
        {required ? <span className="ml-0.5 text-red-600">*</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="field-input"
      />
      {hint && !hasError ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      {hasError ? (
        <p id={errorId} className="field-error">
          {errors?.join(' ')}
        </p>
      ) : null}
    </div>
  );
}
