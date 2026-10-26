import Link from 'next/link';

// Small building blocks used by every screen. Colours only through design tokens.

const BUTTON = {
  primary: 'bg-brand text-white hover:bg-brand-strong',
  secondary: 'border border-border bg-surface text-text hover:bg-raised',
  danger: 'bg-danger text-white hover:opacity-90',
  ghost: 'text-muted hover:bg-raised hover:text-text',
};

export function buttonClass(variant = 'primary', size = 'md') {
  const sizes = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm', lg: 'h-12 px-5 text-base' };
  return `inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${BUTTON[variant]}`;
}

export function Button({ variant, size, className = '', type = 'button', ...props }) {
  return <button type={type} className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}

export function ButtonLink({ variant, size, className = '', ...props }) {
  return <Link className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}

export function Card({ className = '', children, ...props }) {
  return (
    <section className={`rounded-xl border border-border bg-surface ${className}`} {...props}>
      {children}
    </section>
  );
}

export function CardHeader({ title, action, subtitle }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const TONES = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
  brand: 'bg-brand/10 text-brand',
  neutral: 'bg-raised text-muted',
};

export function Badge({ tone = 'neutral', children }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      {text && <p className="max-w-sm text-sm text-muted">{text}</p>}
      {action}
    </div>
  );
}

export function StatTile({ label, value, tone = 'neutral', hint, href }) {
  const toneText = {
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    info: 'text-info',
    brand: 'text-brand',
    neutral: 'text-text',
  }[tone];
  const content = (
    <>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneText}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </>
  );
  const className = 'block rounded-xl border border-border bg-surface p-4';
  return href ? (
    <Link href={href} className={`${className} transition-colors hover:border-brand/50`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

export function ErrorText({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}

export function Spinner({ className = 'h-4 w-4' }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  );
}
