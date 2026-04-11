import { useState, useEffect } from 'react';
import { HOME_MODELS } from '../data/homeModels';
import { Search, Plus, ExternalLink, ChevronUp, ChevronDown, Pencil, Trash2, X } from 'lucide-react';
import Button from '../components/UI/Button';

const STORAGE_KEY = 'homeModels_data';

const EMPTY_MODEL = {
  model: '',
  manufacturer: 'Clayton',
  sections: 'Single-Wide',
  beds: 3,
  baths: 2,
  sqft: '',
  price: '',
  link: '',
};

export default function HomeModels() {
  const [models, setModels] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : HOME_MODELS;
    } catch {
      return HOME_MODELS;
    }
  });

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('price');
  const [sortDir, setSortDir] = useState('asc');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState(null); // null = add new
  const [form, setForm] = useState(EMPTY_MODEL);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(models));
  }, [models]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const openAdd = () => {
    setEditingModel(null);
    setForm(EMPTY_MODEL);
    setModalOpen(true);
  };

  const openEdit = (model) => {
    setEditingModel(model);
    setForm({ ...model });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingModel(null);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    const parsed = {
      ...form,
      beds: parseInt(form.beds) || 0,
      baths: parseFloat(form.baths) || 0,
      sqft: parseInt(form.sqft) || 0,
      price: parseInt(form.price) || 0,
    };

    if (editingModel) {
      setModels((prev) => prev.map((m) => (m.id === editingModel.id ? { ...parsed, id: editingModel.id } : m)));
    } else {
      const newId = Math.max(0, ...models.map((m) => m.id)) + 1;
      setModels((prev) => [...prev, { ...parsed, id: newId }]);
    }
    closeModal();
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this model?')) {
      setModels((prev) => prev.filter((m) => m.id !== id));
    }
  };

  const filtered = models
    .filter((m) =>
      [m.model, m.manufacturer, m.sections].some((v) =>
        v.toLowerCase().includes(search.toLowerCase())
      )
    )
    .sort((a, b) => {
      const v1 = a[sortKey];
      const v2 = b[sortKey];
      const dir = sortDir === 'asc' ? 1 : -1;
      return v1 > v2 ? dir : v1 < v2 ? -dir : 0;
    });

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ChevronUp size={12} className="text-gray-300" />;
    return sortDir === 'asc' ? <ChevronUp size={12} className="text-accent" /> : <ChevronDown size={12} className="text-accent" />;
  };

  const TH = ({ col, label }) => (
    <th
      className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 select-none"
      onClick={() => handleSort(col)}
    >
      <span className="flex items-center gap-1">
        {label} <SortIcon col={col} />
      </span>
    </th>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-sidebar">Home Models</h1>
          <p className="text-sm text-gray-500 mt-1">{models.length} models in catalog</p>
        </div>
        <Button onClick={openAdd}>
          <Plus size={14} className="mr-1" />
          Add Model
        </Button>
      </div>

      <div className="bg-card rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <TH col="manufacturer" label="Manufacturer" />
                <TH col="model" label="Model" />
                <TH col="sections" label="Type" />
                <TH col="beds" label="Beds" />
                <TH col="baths" label="Baths" />
                <TH col="sqft" label="Sq Ft" />
                <TH col="price" label="Price" />
                <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Link</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((model) => (
                <tr key={model.id} className="group relative border-b border-gray-100 hover:bg-white/60 transition-colors">
                  <td className="py-3 px-4 text-sm font-medium text-sidebar">{model.manufacturer}</td>
                  <td className="py-3 px-4 text-sm text-gray-700">
                    <span className="flex items-center gap-2">
                      {model.model}
                      <span className="hidden group-hover:flex items-center gap-1">
                        <button
                          onClick={() => openEdit(model)}
                          className="text-gray-400 hover:text-accent transition-colors"
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(model.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </span>
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      model.sections === 'Single-Wide'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {model.sections}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-center text-gray-700">{model.beds}</td>
                  <td className="py-3 px-4 text-sm text-center text-gray-700">{model.baths}</td>
                  <td className="py-3 px-4 text-sm text-gray-700">{model.sqft.toLocaleString()} sf</td>
                  <td className="py-3 px-4 text-sm font-semibold text-accent">${model.price.toLocaleString()}</td>
                  <td className="py-3 px-4">
                    {model.link ? (
                      <a href={model.link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                        <ExternalLink size={14} />
                      </a>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Models', value: models.length },
          { label: 'Single-Wide', value: models.filter((m) => m.sections === 'Single-Wide').length },
          { label: 'Double-Wide', value: models.filter((m) => m.sections === 'Double-Wide').length },
          { label: 'Avg Price', value: models.length ? `$${Math.round(models.reduce((s, m) => s + m.price, 0) / models.length).toLocaleString()}` : '$0' },
        ].map((c) => (
          <div key={c.label} className="bg-card rounded-xl shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-sidebar">{c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Edit / Add Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-sidebar">
                {editingModel ? 'Edit Model' : 'Add Model'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Manufacturer</label>
                  <select
                    name="manufacturer"
                    value={form.manufacturer}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
                  >
                    <option>Clayton</option>
                    <option>Cavco</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Model Name</label>
                  <input
                    name="model"
                    value={form.model}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
                    placeholder="e.g. Tide"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                  <select
                    name="sections"
                    value={form.sections}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
                  >
                    <option>Single-Wide</option>
                    <option>Double-Wide</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Price ($)</label>
                  <input
                    name="price"
                    type="number"
                    value={form.price}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Beds</label>
                  <input
                    name="beds"
                    type="number"
                    value={form.beds}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Baths</label>
                  <input
                    name="baths"
                    type="number"
                    step="0.5"
                    value={form.baths}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Sq Ft</label>
                  <input
                    name="sqft"
                    type="number"
                    value={form.sqft}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Manufacturer Link (optional)</label>
                <input
                  name="link"
                  type="url"
                  value={form.link}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <Button onClick={handleSave}>
                {editingModel ? 'Save Changes' : 'Add Model'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
