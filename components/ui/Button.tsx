import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  loading = false,
  className = '',
  disabled,
  icon,
  ...props 
}) => {
  // Brutalist / Technical styles
  const baseStyles = "inline-flex items-center justify-center font-mono transition-all focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider font-medium active:translate-y-[1px]";
  
  const variants = {
    // Primary: Solid Accent (Amber)
    primary: "bg-accent text-black hover:bg-amber-400 border border-transparent",
    // Secondary: Dark surface with visible border
    secondary: "bg-zinc-900 text-zinc-300 border border-zinc-700 hover:bg-zinc-800 hover:text-white hover:border-zinc-500",
    // Ghost: Minimal
    ghost: "text-zinc-500 hover:text-white hover:bg-zinc-800/50",
    // Danger: Red outline
    danger: "text-red-500 border border-red-900/50 hover:bg-red-950 hover:border-red-500"
  };

  const sizes = {
    sm: "px-3 py-1 text-xs h-8",
    md: "px-5 py-2 text-xs h-10",
    lg: "px-8 py-3 text-sm h-12"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className} rounded-sm`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="mr-2 h-3 w-3 animate-spin rounded-none border border-current border-t-transparent" />
      ) : icon ? (
        <span className="mr-2">{icon}</span>
      ) : null}
      {children}
    </button>
  );
};