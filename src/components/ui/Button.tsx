import React from 'react';

const VARIANT_CLASSES: Record<string, string> = {
  primary:
    'bg-[#2563eb] text-white hover:bg-[#196348] disabled:bg-[#2563eb] transition-colors',
  secondary:
    'bg-white border border-[#cbd5e1] text-[#0f172a] hover:bg-[#f8fafc] disabled:bg-[#f1f5f9] disabled:text-[#94a3b8] disabled:border-[#e2e8f0] transition-colors',
  ghost:
    'hover:bg-slate-100 text-slate-700 disabled:text-slate-400 transition-colors',
  danger:
    'text-red-600 hover:bg-red-50 disabled:text-red-300 disabled:bg-transparent transition-colors',
};

const SIZE_CLASSES: Record<string, string> = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3.5 py-2 text-sm',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className,
  children,
  ...props
}) => {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className ?? ''}`}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
};
