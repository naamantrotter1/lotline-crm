export function GradeBadge({ grade }) {
  const colors = {
    A: 'bg-teal-100 text-teal-800',
    B: 'bg-blue-100 text-blue-800',
    C: 'bg-yellow-100 text-yellow-800',
    D: 'bg-red-100 text-red-800',
  };
  if (!grade) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${colors[grade] || 'bg-gray-100 text-gray-700'}`}>
      {grade}
    </span>
  );
}

export function Tag({ children, type }) {
  const colors = {
    investor: 'bg-purple-100 text-purple-700',
    'Land Clearing': 'bg-green-100 text-green-700',
    Subdivide: 'bg-orange-100 text-orange-700',
    'Low Margin 14%': 'bg-red-100 text-red-700',
    default: 'bg-gray-100 text-gray-700',
  };
  const color = colors[type] || colors[children] || colors.default;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const colors = {
    'Completed': 'bg-green-100 text-green-700',
    'In Progress': 'bg-blue-100 text-blue-700',
    'Rolled Over': 'bg-yellow-100 text-yellow-700',
    'Not Started': 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}
