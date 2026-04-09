import { HardHat, Phone, Star } from 'lucide-react';

const CONTRACTORS = [
  { id: 1, name: "Tony's Mobile Home Service", trade: 'Setup Crew', contact: 'Tony', phone: '', rating: 5, notes: 'Met week of Mar 30. Primary setup crew.', active: true },
  { id: 2, name: 'Bonnie (Dealer License)', trade: "Dealer's License", contact: 'Bonnie', phone: '', rating: 4, notes: 'Working on dealer license process.', active: true },
  { id: 3, name: 'TBD Septic', trade: 'Septic Installation', contact: '', phone: '', rating: null, notes: 'Need to source reliable septic contractors by county.', active: false },
  { id: 4, name: 'TBD Well', trade: 'Well Drilling', contact: '', phone: '', rating: null, notes: 'Need well drillers for NC markets.', active: false },
  { id: 5, name: 'TBD Electric', trade: 'Electrical', contact: '', phone: '', rating: null, notes: 'Need licensed electricians.', active: false },
];

function StarRating({ rating }) {
  if (!rating) return <span className="text-xs text-gray-400">Not rated</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} size={12} className={star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
      ))}
    </div>
  );
}

export default function ContractorDatabase() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-sidebar rounded-lg">
          <HardHat size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-sidebar">Contractor Database</h1>
          <p className="text-sm text-gray-500">Trusted contractors and service providers</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {CONTRACTORS.map((c) => (
          <div key={c.id} className="bg-card rounded-xl shadow-sm p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-sidebar">{c.name}</h3>
                <p className="text-xs text-accent font-medium mt-0.5">{c.trade}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {c.active ? 'Active' : 'Sourcing'}
              </span>
            </div>

            {c.contact && (
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-sidebar text-white text-xs flex items-center justify-center font-bold">
                  {c.contact[0]}
                </div>
                <span className="text-sm text-gray-600">{c.contact}</span>
              </div>
            )}

            <StarRating rating={c.rating} />

            {c.notes && (
              <p className="mt-2 text-xs text-gray-500 leading-relaxed">{c.notes}</p>
            )}
          </div>
        ))}

        {/* Add Contractor Card */}
        <div className="bg-white/60 rounded-xl border-2 border-dashed border-gray-300 p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white transition-colors min-h-36">
          <HardHat size={24} className="text-gray-300" />
          <p className="text-sm text-gray-400 font-medium">Add Contractor</p>
        </div>
      </div>
    </div>
  );
}
