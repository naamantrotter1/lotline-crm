import { useState } from 'react';
import { Settings as SettingsIcon, Upload } from 'lucide-react';
import Button from '../components/UI/Button';

export default function Settings() {
  const [tab, setTab] = useState('branding');
  const [companyName, setCompanyName] = useState('LotLine Homes');
  const [primaryColor, setPrimaryColor] = useState('#c8613a');
  const [sidebarColor, setSidebarColor] = useState('#1a2332');
  const [bgColor, setBgColor] = useState('#f5f3ee');

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-600 rounded-lg">
          <SettingsIcon size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-sidebar">Settings</h1>
          <p className="text-sm text-gray-500">Configure your CRM preferences</p>
        </div>
      </div>

      <div className="flex bg-card rounded-lg p-1 w-fit">
        {['branding', 'team', 'notifications', 'integrations'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-white text-sidebar shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'branding' && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-sidebar mb-4">Company Branding</h3>

            {/* Logo Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Company Logo</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-sidebar flex items-center justify-center">
                  <span className="text-white font-bold text-lg">LL</span>
                </div>
                <div>
                  <Button variant="outline">
                    <Upload size={14} className="mr-2" />
                    Upload Logo
                  </Button>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG up to 2MB</p>
                </div>
              </div>
            </div>

            {/* Company Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>

            {/* Colors */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Primary Accent', value: primaryColor, set: setPrimaryColor },
                { label: 'Sidebar Color', value: sidebarColor, set: setSidebarColor },
                { label: 'Background Color', value: bgColor, set: setBgColor },
              ].map((c) => (
                <div key={c.label}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{c.label}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={c.value}
                      onChange={(e) => c.set(e.target.value)}
                      className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={c.value}
                      onChange={(e) => c.set(e.target.value)}
                      className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <Button>Save Branding</Button>
            </div>
          </div>
        </div>
      )}

      {tab === 'team' && (
        <div className="bg-card rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-sidebar mb-4">Team Members</h3>
          <div className="space-y-3">
            {['Naaman Trotter', 'Benson', 'Zach', 'Alex'].map((member) => (
              <div key={member} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold">
                    {member[0]}
                  </div>
                  <span className="text-sm font-medium text-gray-700">{member}</span>
                </div>
                <span className="text-xs text-gray-400">Team Member</span>
              </div>
            ))}
          </div>
          <Button className="mt-4" variant="outline">Add Team Member</Button>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="bg-card rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-sidebar mb-4">Notification Preferences</h3>
          <p className="text-sm text-gray-500">Notification settings coming soon.</p>
        </div>
      )}

      {tab === 'integrations' && (
        <div className="bg-card rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-sidebar mb-4">Integrations</h3>
          <p className="text-sm text-gray-500">External integrations coming soon.</p>
        </div>
      )}
    </div>
  );
}
