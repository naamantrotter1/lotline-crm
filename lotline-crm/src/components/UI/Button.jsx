export default function Button({ children, onClick, variant = 'primary', size = 'md', className = '', disabled = false }) {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none';
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };
  const variants = {
    primary: 'bg-accent text-white hover:bg-orange-600 disabled:opacity-50',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50',
    ghost: 'text-gray-600 hover:bg-gray-100 disabled:opacity-50',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
