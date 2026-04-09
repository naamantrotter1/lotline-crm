export default function Card({ children, className = '' }) {
  return (
    <div className={`bg-card rounded-xl shadow-sm p-4 ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, subtext, icon: Icon, color = 'text-accent' }) {
  return (
    <div className="bg-card rounded-xl shadow-sm p-4 flex items-center gap-4">
      {Icon && (
        <div className={`p-3 rounded-lg bg-white ${color}`}>
          <Icon size={20} />
        </div>
      )}
      <div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-sidebar mt-0.5">{value}</p>
        {subtext && <p className="text-xs text-gray-400 mt-0.5">{subtext}</p>}
      </div>
    </div>
  );
}
