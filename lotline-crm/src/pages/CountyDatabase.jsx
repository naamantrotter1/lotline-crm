import { useState, useMemo } from 'react';
import { ExternalLink, Search, ChevronRight } from 'lucide-react';
import { NC_COUNTIES, SC_COUNTIES, SECTIONS, COUNTY_DATA } from '../data/counties';

const DEPT_LABELS = [
  { key: 'zoning', label: 'Zoning / Planning Department' },
  { key: 'deeds', label: 'Register of Deeds Office' },
  { key: 'health', label: 'County Health Department' },
  { key: 'inspections', label: 'Building Inspections Department' },
  { key: 'tax', label: 'County Tax Office' },
  { key: 'water', label: 'Water Utility Providers' },
  { key: 'sewer', label: 'Sewer Utility Providers' },
  { key: 'electric', label: 'Electric Utility Providers' },
  { key: 'dot', label: 'NCDOT / SCDOT Division Office' },
  { key: 'contractors', label: 'Recommended Local Contractors' },
];

function FieldCard({ label, children }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      {children}
    </div>
  );
}

function UrlField({ value, onChange, placeholder }) {
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || 'https://'}
          className="flex-1 text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300"
        />
        {value && (
          <a href={value} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-2 bg-teal-600 text-white text-xs rounded hover:bg-teal-700 whitespace-nowrap">
            <ExternalLink size={12} /> Open
          </a>
        )}
      </div>
      {value && (
        <a href={value} target="_blank" rel="noopener noreferrer"
          className="text-xs text-orange-600 hover:underline flex items-center gap-1">
          <ExternalLink size={10} /> {value}
        </a>
      )}
    </div>
  );
}

function TextArea({ value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300 resize-y"
    />
  );
}

function DepartmentContact({ label, data, onChange }) {
  const d = data || {};
  const set = (field, val) => onChange({ ...d, [field]: val });
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-700">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={d.name || ''} onChange={e => set('name', e.target.value)}
          placeholder="Business / Contact Name"
          className="text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300" />
        <input type="text" value={d.phone || ''} onChange={e => set('phone', e.target.value)}
          placeholder="(555) 555-5555"
          className="text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300" />
        <input type="text" value={d.email || ''} onChange={e => set('email', e.target.value)}
          placeholder="email@example.com"
          className="text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300" />
        <input type="text" value={d.address || ''} onChange={e => set('address', e.target.value)}
          placeholder="Address"
          className="text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300" />
        <input type="text" value={d.website || ''} onChange={e => set('website', e.target.value)}
          placeholder="https://website.com" colSpan="2"
          className="col-span-2 text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300" />
      </div>
      {label === 'Recommended Local Contractors' && (
        <textarea value={d.notes || ''} onChange={e => set('notes', e.target.value)}
          placeholder="Notes about local contractors..."
          rows={2}
          className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300 resize-y" />
      )}
    </div>
  );
}

function SectionProgress({ section, data }) {
  // Simple completion estimate based on filled fields
  const fields = Object.values(data || {}).filter(v => v && typeof v === 'string' && v.length > 0);
  const pct = section.key === 'keyContacts' ? 100 : fields.length > 0 ? 100 : 0;
  return (
    <button className="w-full text-left group">
      <div className="flex items-center justify-between py-2">
        <span className="text-xs text-gray-600 flex items-center gap-1.5">
          <span>{section.icon}</span>
          <span className="truncate">{section.label}</span>
        </span>
        <span className="text-xs text-orange-600 font-medium ml-2 shrink-0">{pct}%</span>
      </div>
      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </button>
  );
}

function KeyContactsSection({ data, onChange }) {
  const d = data || {};
  const set = (field, val) => onChange({ ...d, [field]: val });
  const setDept = (key, val) => onChange({ ...d, departments: { ...(d.departments || {}), [key]: val } });
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-sidebar flex items-center gap-2 mb-1">
          📞 Key Contacts &amp; Resources
        </h2>
        <p className="text-sm text-gray-500">All important phone numbers, emails, websites, and personnel for this county.</p>
      </div>
      <FieldCard label="County Official Website">
        <UrlField value={d.countyWebsite} onChange={v => set('countyWebsite', v)} placeholder="https://www.countync.gov" />
      </FieldCard>
      <FieldCard label="County GIS / Parcel Viewer URL">
        <UrlField value={d.gisUrl} onChange={v => set('gisUrl', v)} placeholder="https://gis.countync.gov" />
      </FieldCard>
      <FieldCard label="Register of Deeds Online Search URL">
        <UrlField value={d.deedsUrl} onChange={v => set('deedsUrl', v)} placeholder="https://rod.countync.gov" />
      </FieldCard>
      <FieldCard label="Online Permit Portal URL">
        <UrlField value={d.permitPortalUrl} onChange={v => set('permitPortalUrl', v)} placeholder="https://" />
      </FieldCard>
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Department Contacts</h3>
        <div className="space-y-3">
          {DEPT_LABELS.map(dept => (
            <DepartmentContact
              key={dept.key}
              label={dept.label}
              data={(d.departments || {})[dept.key]}
              onChange={val => setDept(dept.key, val)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ZoningSection({ data, onChange }) {
  const d = data || {};
  const set = (f, v) => onChange({ ...d, [f]: v });
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-sidebar flex items-center gap-2 mb-1">🗺️ Zoning &amp; Land Use Rules</h2>
        <p className="text-sm text-gray-500">Zoning designations, lot requirements, and land use rules specific to manufactured homes.</p>
      </div>
      <FieldCard label="Manufactured Home Allowed Zones">
        <TextArea value={d.mhAllowedZones} onChange={v => set('mhAllowedZones', v)} placeholder="Describe which zones allow manufactured homes..." />
      </FieldCard>
      <FieldCard label="Minimum Lot Size Requirements">
        <TextArea value={d.minLotSize} onChange={v => set('minLotSize', v)} placeholder="Minimum lot size by zone..." />
      </FieldCard>
      <FieldCard label="Setback Requirements">
        <TextArea value={d.setbackRequirements} onChange={v => set('setbackRequirements', v)} placeholder="Front, rear, side setbacks..." />
      </FieldCard>
      <FieldCard label="Subdivision Rules &amp; Process">
        <TextArea value={d.subdivisionRules} onChange={v => set('subdivisionRules', v)} placeholder="Minor vs major subdivision process..." />
      </FieldCard>
      <FieldCard label="Special Use Permit Requirements">
        <TextArea value={d.specialUsePermit} onChange={v => set('specialUsePermit', v)} placeholder="When a special use permit is required..." />
      </FieldCard>
      <FieldCard label="Additional Notes">
        <TextArea value={d.additionalNotes} onChange={v => set('additionalNotes', v)} placeholder="Any other zoning notes..." rows={3} />
      </FieldCard>
    </div>
  );
}

function DeedsSection({ data, onChange }) {
  const d = data || {};
  const set = (f, v) => onChange({ ...d, [f]: v });
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-sidebar flex items-center gap-2 mb-1">📄 Deeds, Title &amp; Survey Procedures</h2>
        <p className="text-sm text-gray-500">Recording fees, survey requirements, and title procedures for this county.</p>
      </div>
      <FieldCard label="Recording Fees">
        <TextArea value={d.recordingFees} onChange={v => set('recordingFees', v)} placeholder="Deed recording fees, excise tax rates..." />
      </FieldCard>
      <FieldCard label="Survey Requirements">
        <TextArea value={d.surveyRequirements} onChange={v => set('surveyRequirements', v)} placeholder="Survey licensing and requirements..." />
      </FieldCard>
      <FieldCard label="Title Search Process">
        <TextArea value={d.titleSearchProcess} onChange={v => set('titleSearchProcess', v)} placeholder="Title search chain of title requirements..." />
      </FieldCard>
      <FieldCard label="Deed Type / Conveyance Notes">
        <TextArea value={d.deedType} onChange={v => set('deedType', v)} placeholder="Warranty deed, quitclaim deed notes..." />
      </FieldCard>
      <FieldCard label="Additional Notes">
        <TextArea value={d.additionalNotes} onChange={v => set('additionalNotes', v)} placeholder="Any other deed/title notes..." rows={3} />
      </FieldCard>
    </div>
  );
}

function WaterSection({ data, onChange }) {
  const d = data || {};
  const set = (f, v) => onChange({ ...d, [f]: v });
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-sidebar flex items-center gap-2 mb-1">💧 Water Supply SOP</h2>
        <p className="text-sm text-gray-500">Public water availability, well permitting, and water connection requirements.</p>
      </div>
      <FieldCard label="Public Water Availability">
        <TextArea value={d.publicWaterAvailability} onChange={v => set('publicWaterAvailability', v)} placeholder="Where public water is available in this county..." />
      </FieldCard>
      <FieldCard label="Well Permit Process">
        <TextArea value={d.wellPermitProcess} onChange={v => set('wellPermitProcess', v)} placeholder="How to obtain a well permit..." />
      </FieldCard>
      <FieldCard label="Well Drilling Requirements">
        <TextArea value={d.wellDrillingRequirements} onChange={v => set('wellDrillingRequirements', v)} placeholder="Setback from septic, depth requirements..." />
      </FieldCard>
      <FieldCard label="Typical Cost">
        <TextArea value={d.typicalCost} onChange={v => set('typicalCost', v)} placeholder="Typical well drilling cost range..." rows={2} />
      </FieldCard>
      <FieldCard label="Additional Notes">
        <TextArea value={d.additionalNotes} onChange={v => set('additionalNotes', v)} placeholder="Any other water supply notes..." rows={3} />
      </FieldCard>
    </div>
  );
}

function SewerSection({ data, onChange }) {
  const d = data || {};
  const set = (f, v) => onChange({ ...d, [f]: v });
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-sidebar flex items-center gap-2 mb-1">🚽 Sewer &amp; Septic SOP</h2>
        <p className="text-sm text-gray-500">Public sewer availability, septic permitting, and soil evaluation requirements.</p>
      </div>
      <FieldCard label="Public Sewer Availability">
        <TextArea value={d.publicSewerAvailability} onChange={v => set('publicSewerAvailability', v)} placeholder="Where public sewer is available..." />
      </FieldCard>
      <FieldCard label="Septic Permit Process">
        <TextArea value={d.septicPermitProcess} onChange={v => set('septicPermitProcess', v)} placeholder="Steps to obtain a septic permit..." />
      </FieldCard>
      <FieldCard label="Soil / Perc Test Process">
        <TextArea value={d.soilPercTest} onChange={v => set('soilPercTest', v)} placeholder="Soil evaluation and perc test requirements..." />
      </FieldCard>
      <FieldCard label="Engineered Septic Rules">
        <TextArea value={d.engineeredSeptic} onChange={v => set('engineeredSeptic', v)} placeholder="When engineered systems are required..." />
      </FieldCard>
      <FieldCard label="Typical Cost">
        <TextArea value={d.typicalCost} onChange={v => set('typicalCost', v)} placeholder="Typical septic system cost range..." rows={2} />
      </FieldCard>
      <FieldCard label="Septic Contractors">
        <TextArea value={d.septicContractors} onChange={v => set('septicContractors', v)} placeholder="Recommended septic contractors..." rows={2} />
      </FieldCard>
      <FieldCard label="Additional Notes">
        <TextArea value={d.additionalNotes} onChange={v => set('additionalNotes', v)} placeholder="Any other septic notes..." rows={3} />
      </FieldCard>
    </div>
  );
}

function ElectricSection({ data, onChange }) {
  const d = data || {};
  const set = (f, v) => onChange({ ...d, [f]: v });
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-sidebar flex items-center gap-2 mb-1">⚡ Electric &amp; Utilities SOP</h2>
        <p className="text-sm text-gray-500">Electric utility providers, connection process, and utility requirements.</p>
      </div>
      <FieldCard label="Utility Providers">
        <TextArea value={d.utilityProviders} onChange={v => set('utilityProviders', v)} placeholder="Electric providers serving this county..." />
      </FieldCard>
      <FieldCard label="Connection Process">
        <TextArea value={d.connectionProcess} onChange={v => set('connectionProcess', v)} placeholder="Steps to connect electric service..." />
      </FieldCard>
      <FieldCard label="Temporary Power Requirements">
        <TextArea value={d.tempPower} onChange={v => set('tempPower', v)} placeholder="Requirements for temporary construction power..." />
      </FieldCard>
      <FieldCard label="Typical Cost">
        <TextArea value={d.typicalCost} onChange={v => set('typicalCost', v)} placeholder="Typical connection and service fees..." rows={2} />
      </FieldCard>
      <FieldCard label="Additional Notes">
        <TextArea value={d.additionalNotes} onChange={v => set('additionalNotes', v)} placeholder="Any other electric utility notes..." rows={3} />
      </FieldCard>
    </div>
  );
}

function PermittingSection({ data, onChange }) {
  const d = data || {};
  const set = (f, v) => onChange({ ...d, [f]: v });
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-sidebar flex items-center gap-2 mb-1">🏗️ Permitting &amp; Inspections SOP</h2>
        <p className="text-sm text-gray-500">Building permit process, required inspections, and typical timelines.</p>
      </div>
      <FieldCard label="Permit Application Process">
        <TextArea value={d.permitProcess} onChange={v => set('permitProcess', v)} placeholder="How to apply for a building permit..." />
      </FieldCard>
      <FieldCard label="Required Inspections">
        <TextArea value={d.inspectionRequirements} onChange={v => set('inspectionRequirements', v)} placeholder="List of required inspections and sequencing..." />
      </FieldCard>
      <FieldCard label="Typical Timeline">
        <TextArea value={d.typicalTimeline} onChange={v => set('typicalTimeline', v)} placeholder="How long permits and inspections typically take..." />
      </FieldCard>
      <FieldCard label="Permit Fees">
        <TextArea value={d.fees} onChange={v => set('fees', v)} placeholder="Building permit fee schedule..." rows={2} />
      </FieldCard>
      <FieldCard label="Additional Notes">
        <TextArea value={d.additionalNotes} onChange={v => set('additionalNotes', v)} placeholder="Any other permitting notes..." rows={3} />
      </FieldCard>
    </div>
  );
}

function MHSetupSection({ data, onChange }) {
  const d = data || {};
  const set = (f, v) => onChange({ ...d, [f]: v });
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-sidebar flex items-center gap-2 mb-1">🏠 MH Setup &amp; Site Requirements</h2>
        <p className="text-sm text-gray-500">Manufactured home installation requirements for this county.</p>
      </div>
      <FieldCard label="Foundation Requirements">
        <TextArea value={d.foundationRequirements} onChange={v => set('foundationRequirements', v)} placeholder="Pier type, spacing, footing requirements..." />
      </FieldCard>
      <FieldCard label="Anchoring Requirements">
        <TextArea value={d.anchoringRequirements} onChange={v => set('anchoringRequirements', v)} placeholder="Tie-down and anchoring system requirements..." />
      </FieldCard>
      <FieldCard label="Utility Connections">
        <TextArea value={d.utilityConnections} onChange={v => set('utilityConnections', v)} placeholder="Utility hookup requirements and standards..." />
      </FieldCard>
      <FieldCard label="Skirting Requirements">
        <TextArea value={d.skirting} onChange={v => set('skirting', v)} placeholder="Skirting material and installation requirements..." />
      </FieldCard>
      <FieldCard label="HUD Label Requirements">
        <TextArea value={d.hudLabel} onChange={v => set('hudLabel', v)} placeholder="HUD certification label requirements..." rows={2} />
      </FieldCard>
      <FieldCard label="Additional Notes">
        <TextArea value={d.additionalNotes} onChange={v => set('additionalNotes', v)} placeholder="Any other MH setup notes..." rows={3} />
      </FieldCard>
    </div>
  );
}

function CostsSection({ data, onChange }) {
  const d = data || {};
  const set = (f, v) => onChange({ ...d, [f]: v });
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-sidebar flex items-center gap-2 mb-1">💰 Typical Costs &amp; Budget Guide</h2>
        <p className="text-sm text-gray-500">Estimated costs for permits, utilities, and site work in this county.</p>
      </div>
      <FieldCard label="Permit Fees">
        <TextArea value={d.permitFees} onChange={v => set('permitFees', v)} placeholder="Building permit fee estimates..." />
      </FieldCard>
      <FieldCard label="Utility Connection Fees">
        <TextArea value={d.utilityConnectionFees} onChange={v => set('utilityConnectionFees', v)} placeholder="Water, sewer, electric connection cost ranges..." />
      </FieldCard>
      <FieldCard label="Site Preparation Costs">
        <TextArea value={d.sitePrep} onChange={v => set('sitePrep', v)} placeholder="Land clearing, grading, driveway cost ranges..." />
      </FieldCard>
      <FieldCard label="Well &amp; Septic">
        <TextArea value={d.wellSeptic} onChange={v => set('wellSeptic', v)} placeholder="Well drilling and septic system cost ranges..." />
      </FieldCard>
      <FieldCard label="Typical Total Budget">
        <TextArea value={d.typicalBudget} onChange={v => set('typicalBudget', v)} placeholder="Typical all-in budget for a deal in this county..." rows={2} />
      </FieldCard>
      <FieldCard label="Additional Notes">
        <TextArea value={d.additionalNotes} onChange={v => set('additionalNotes', v)} placeholder="Any other cost notes..." rows={3} />
      </FieldCard>
    </div>
  );
}

function LinksSection({ data, onChange }) {
  const d = data || {};
  const set = (f, v) => onChange({ ...d, [f]: v });
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-sidebar flex items-center gap-2 mb-1">📎 Useful Links &amp; Documents</h2>
        <p className="text-sm text-gray-500">Important links, forms, and documents for working in this county.</p>
      </div>
      <FieldCard label="Useful Links">
        <TextArea value={d.usefulLinks} onChange={v => set('usefulLinks', v)} placeholder="List useful URLs with descriptions..." rows={6} />
      </FieldCard>
      <FieldCard label="Documents &amp; Forms">
        <TextArea value={d.documents} onChange={v => set('documents', v)} placeholder="List important forms and documents..." rows={4} />
      </FieldCard>
    </div>
  );
}

function ChecklistSection({ data, onChange }) {
  const d = data || {};
  const items = d.items || [
    'Verify zoning allows manufactured home',
    'Confirm lot size meets minimum requirements',
    'Check setbacks and building envelope',
    'Verify well setback from septic',
    'Confirm FEMA flood zone classification',
    'Review subdivision plat requirements',
    'Confirm driveway / road access permit needed',
    'Verify HOA restrictions (if any)',
    'Confirm utility availability (water, sewer, electric)',
    'Check for any deed restrictions',
    'Confirm permit timeline with county',
    'Review soil evaluation requirements',
  ];
  const completed = d.completed || [];
  const toggle = (item) => {
    const next = completed.includes(item) ? completed.filter(i => i !== item) : [...completed, item];
    onChange({ ...d, completed: next });
  };
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-sidebar flex items-center gap-2 mb-1">✅ Development Checklist</h2>
        <p className="text-sm text-gray-500">Key items to verify before committing to a deal in this county.</p>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {items.map((item, i) => (
          <label key={i} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={completed.includes(item)} onChange={() => toggle(item)}
              className="w-4 h-4 accent-orange-500 rounded" />
            <span className={`text-sm ${completed.includes(item) ? 'line-through text-gray-400' : 'text-gray-700'}`}>{item}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function SummarySection({ data, onChange }) {
  const d = data || {};
  const set = (f, v) => onChange({ ...d, [f]: v });
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-sidebar flex items-center gap-2 mb-1">📝 County SOP Summary</h2>
        <p className="text-sm text-gray-500">High-level summary of the county SOP for quick reference.</p>
      </div>
      <FieldCard label="Overview">
        <TextArea value={d.overview} onChange={v => set('overview', v)} placeholder="General overview of working in this county..." rows={5} />
      </FieldCard>
      <FieldCard label="Key Considerations">
        <TextArea value={d.keyConsiderations} onChange={v => set('keyConsiderations', v)} placeholder="Most important things to know..." rows={4} />
      </FieldCard>
      <FieldCard label="Unique County Requirements">
        <TextArea value={d.uniqueRequirements} onChange={v => set('uniqueRequirements', v)} placeholder="Anything unusual or specific to this county..." rows={3} />
      </FieldCard>
      <FieldCard label="Last Updated">
        <input type="text" value={d.lastUpdated || ''} onChange={e => set('lastUpdated', e.target.value)}
          placeholder="e.g. April 2026"
          className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300" />
      </FieldCard>
    </div>
  );
}

const SECTION_COMPONENTS = {
  keyContacts: KeyContactsSection,
  zoning: ZoningSection,
  deeds: DeedsSection,
  water: WaterSection,
  sewer: SewerSection,
  electric: ElectricSection,
  permitting: PermittingSection,
  mhSetup: MHSetupSection,
  costs: CostsSection,
  links: LinksSection,
  checklist: ChecklistSection,
  summary: SummarySection,
};

export default function CountyDatabase() {
  const [activeState, setActiveState] = useState('NC');
  const [search, setSearch] = useState('');
  const [selectedCounty, setSelectedCounty] = useState('Alamance');
  const [activeSection, setActiveSection] = useState('keyContacts');
  const [countyData, setCountyData] = useState(COUNTY_DATA);
  const [gisUrls, setGisUrls] = useState(
    Object.fromEntries(Object.entries(COUNTY_DATA).map(([k, v]) => [k, v.gisPortalUrl || '']))
  );

  const counties = activeState === 'NC' ? NC_COUNTIES : SC_COUNTIES;
  const filtered = useMemo(() =>
    counties.filter(c => c.name.toLowerCase().includes(search.toLowerCase())),
    [counties, search]
  );

  const completeCount = counties.filter(c => c.completion === 100).length;

  const currentData = countyData[selectedCounty] || {};

  const updateSection = (sectionKey, val) => {
    setCountyData(prev => ({
      ...prev,
      [selectedCounty]: {
        ...(prev[selectedCounty] || {}),
        [sectionKey]: val,
      }
    }));
  };

  const SectionComp = SECTION_COMPONENTS[activeSection];

  return (
    <div className="flex h-[calc(100vh-60px)] overflow-hidden -m-6">
      {/* Left county list */}
      <div className="w-52 shrink-0 border-r border-gray-200 bg-white flex flex-col">
        {/* State toggle */}
        <div className="flex border-b border-gray-200">
          {['NC', 'SC'].map(s => (
            <button key={s} onClick={() => { setActiveState(s); setSelectedCounty(null); }}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${activeState === s ? 'bg-orange-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              {s}
            </button>
          ))}
        </div>
        {/* Search */}
        <div className="p-2 border-b border-gray-100">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
        </div>
        {/* County list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map(c => (
            <button
              key={c.name}
              onClick={() => setSelectedCounty(c.name)}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors border-b border-gray-50 ${selectedCounty === c.name ? 'bg-orange-600 text-white' : 'text-gray-700 hover:bg-orange-50'}`}
            >
              <span className="font-medium truncate">{c.name}</span>
            </button>
          ))}
        </div>
        {/* State summary */}
        <div className="p-3 border-t border-gray-100 bg-gray-50">
          <p className="text-xs font-semibold text-gray-600">{activeState === 'NC' ? 'North Carolina' : 'South Carolina'}</p>
          <p className="text-xs text-gray-500 mt-0.5">{counties.length} counties started</p>
          <p className="text-xs text-gray-500">{completeCount} complete</p>
        </div>
      </div>

      {/* Main content */}
      {selectedCounty ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* County header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h1 className="text-xl font-bold text-sidebar">
                  {selectedCounty} County, {activeState} — SOP
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">Standard Operating Procedures — Contract to Construction</p>
              </div>
            </div>
            {/* GIS Portal URL */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm text-gray-500 shrink-0">
                <span>📍</span> GIS Portal URL
              </div>
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={gisUrls[selectedCounty] || ''}
                  onChange={e => setGisUrls(prev => ({ ...prev, [selectedCounty]: e.target.value }))}
                  placeholder="https://gis.example.com — Enter this county's GIS / parcel viewer URL"
                  className="flex-1 text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
                {gisUrls[selectedCounty] && (
                  <a href={gisUrls[selectedCounty]} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 px-4 py-1.5 bg-teal-600 text-white text-sm rounded hover:bg-teal-700">
                    <ExternalLink size={14} /> Open
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Section tabs */}
          <div className="bg-white border-b border-gray-200 px-4 shrink-0 overflow-x-auto">
            <div className="flex gap-0 min-w-max">
              {SECTIONS.map(s => (
                <button
                  key={s.key}
                  onClick={() => setActiveSection(s.key)}
                  className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${activeSection === s.key
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section content */}
          <div className="flex-1 overflow-y-auto p-6">
            {SectionComp && (
              <SectionComp
                data={currentData[activeSection]}
                onChange={val => updateSection(activeSection, val)}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <div className="text-4xl mb-3">🗺️</div>
            <p className="text-sm">Select a county to view its SOP</p>
          </div>
        </div>
      )}

    </div>
  );
}
