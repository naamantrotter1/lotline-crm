/**
 * Builder Network — County Data
 *
 * ADMIN NOTE: Builder permit data per county should be populated from monthly
 * public permit reports published by each county's local inspections/building
 * department. In NC and SC, most counties publish monthly PDF or spreadsheet
 * reports listing every permit pulled, including contractor name, permit type,
 * job value, and parcel address. These are available at each county's official
 * website under departments like "Inspections & Permits", "Building Services",
 * or "Planning & Development". Parse contractor names monthly to keep rankings
 * current. Dominant builders typically pull 15+ permits/month in active markets.
 */

export const COUNTIES = [
  // ── LIVE DATA ────────────────────────────────────────────────────────────
  {
    id: 'guilford-nc',
    county: 'Guilford',
    state: 'NC',
    comingSoon: false,
    buildersTracked: 15,
    dataNote: '6 months of 2025 data',
    builders: [
      {
        rank: 1, name: 'DR Horton', permits: 28, specialty: 'Single Family', status: 'Dominant',
        contact: { phone: '(336) 499-7450', website: 'https://www.drhorton.com', email: null, address: '4150 Mendenhall Oaks Pkwy, High Point, NC 27265' },
      },
      {
        rank: 2, name: 'Garman Homes', permits: 16, specialty: 'Custom', status: 'Very Active',
        contact: { phone: '(984) 217-3220', website: 'https://www.garmanhomes.com', email: null, address: '4000 Paramount Pkwy, Suite 250, Morrisville, NC 27560' },
      },
      {
        rank: 3, name: 'Keystone Group', permits: 10, specialty: 'Single Family', status: 'Very Active',
        contact: { phone: '(336) 500-1638', website: 'https://www.gokeystone.com', email: 'salesandmarketing@gokeystone.com', address: '3708 Alliance Dr., Greensboro, NC 27407' },
      },
      {
        rank: 4, name: 'Clayton Properties Group', permits: 9, specialty: 'Single Family', status: 'Active',
        contact: { phone: '(803) 749-9000', website: 'https://www.claytonhomebuildinggroup.com', email: 'CustomerAdvocacy@claytonhomes.com', address: 'Winston-Salem, NC 27104' },
      },
      {
        rank: 5, name: 'Windsor Investments LLC', permits: 7, specialty: 'Mixed', status: 'Active',
        contact: { phone: '(336) 282-3535', website: 'https://www.windsorhomes.us', email: 'info@windsorhomes.us', address: '5603 New Garden Village Dr., Greensboro, NC 27410' },
      },
      {
        rank: 6, name: 'Wise Master Builders', permits: 5, specialty: 'Custom', status: 'Active',
        contact: { phone: '(336) 501-5578', website: 'https://wisemasterbuildersconstruction.com', email: null, address: '6907 Wittington Ct., Oak Ridge, NC 27310' },
      },
      {
        rank: 7, name: 'M & J Developers', permits: 5, specialty: 'Multi-Family', status: 'Active',
        contact: { phone: '(336) 601-7259', website: 'https://www.mjdevelopers.com', email: null, address: '3714 Alliance Drive, Suite 300, Greensboro, NC 27407' },
      },
      {
        rank: 8, name: 'CJ Builders', permits: 5, specialty: 'Single Family', status: 'Active',
        contact: { phone: '(336) 706-2658', website: 'https://www.cjbuilders.biz', email: null, address: '7251F US Highway 158, Stokesdale, NC 27357' },
      },
      {
        rank: 9, name: 'Gingerich Homes', permits: 4, specialty: 'Custom', status: 'Active',
        contact: { phone: '(336) 669-7708', website: 'http://www.gingerichhomes.com', email: null, address: '6352 Poplar Forest Dr., Summerfield, NC 27358' },
      },
      {
        rank: 10, name: 'D Stone Builders', permits: 4, specialty: 'Custom', status: 'Active',
        contact: { phone: '(336) 288-9393', website: 'https://www.dstonebuilders.com', email: null, address: '2904 Lawndale Drive, Greensboro, NC 27408' },
      },
    ],
  },

  {
    id: 'brunswick-nc',
    county: 'Brunswick',
    state: 'NC',
    comingSoon: false,
    buildersTracked: 16,
    topBuilderName: 'DR Horton',
    topBuilderPermits: 136,
    dataNote: '2024–2025 data',
    marketStatus: 'High Growth Market',
    dualTab: true,
    siteBuilt: {
      stats: [
        { value: '2,000+', label: 'Residential New Construction Permits (2024–2025)' },
        { value: 'DR Horton', label: '#1 Active Builder' },
        { value: '8', label: 'National Builders Active' },
        { value: 'Brunswick County', label: "One of NC's fastest growing counties" },
      ],
      builders: [
        { rank: 1, name: 'DR Horton',           permits: 136, type: 'National Builder',  status: 'Dominant',
          contact: { phone: '(910) 371-1597', website: 'https://www.drhorton.com/north-carolina/wilmington/leland', email: null, address: '5011 Northgate Drive, Leland, NC 28451' } },
        { rank: 2, name: 'Chesapeake Homes',    permits: 125, type: 'Regional Builder',  status: 'Very Active',
          contact: { phone: '(910) 431-2709', website: 'https://www.cheshomes.com', email: null, address: '108 N Kerr Ave, Suite K3, Wilmington, NC 28405' } },
        { rank: 3, name: 'Hagood Homes',        permits: 44,  type: 'Local Builder',     status: 'Active',
          contact: { phone: '(910) 256-8284', website: 'https://hagoodhomes.com', email: null, address: '1908 Eastwood Rd, Suite 328, Wilmington, NC 28403' } },
        { rank: 4, name: 'Coleman Fine Homes',  permits: 40,  type: 'Custom Builder',    status: 'Active',
          contact: { phone: '(910) 446-5003', website: 'https://colemanfinehomes.com', email: 'nash@colemanfinehomes.com', address: '1437 Military Cutoff Rd, Suite 200, Wilmington, NC 28403' } },
        { rank: 5, name: 'NVR Inc (Ryan Homes)', permits: 37, type: 'National Builder',  status: 'Active',
          contact: { phone: '(443) 362-0471', website: 'https://www.ryanhomes.com/new-homes/communities/north-carolina/brunswick-county', email: null, address: '1105 Military Cutoff Rd, Suite 201, Wilmington, NC 28405' } },
        { rank: 6, name: 'Meritage Homes',      permits: 33,  type: 'National Builder',  status: 'Active',
          contact: { phone: '(855) 588-6374', website: 'https://www.meritagehomes.com/state/nc', email: null, address: '3300 Paramount Pkwy, Suite 120, Morrisville, NC 27560' } },
        { rank: 7, name: 'Dream Finders Homes', permits: 21,  type: 'Regional Builder',  status: 'Active',
          contact: { phone: '(910) 219-1485', website: 'https://dreamfindershomes.com/new-homes/nc/leland/', email: null, address: '2163 Britton Rd, Suite 140, Leland, NC 28451' } },
        { rank: 8, name: 'Lennar Carolinas',    permits: 21,  type: 'National Builder',  status: 'Active',
          contact: { phone: '(919) 337-9420', website: 'https://www.lennar.com/new-homes/north-carolina/wilmington', email: null, address: '909 Aviation Pkwy, Morrisville, NC 27560' } },
      ],
    },
    manufactured: {
      stats: [
        { value: '498', label: 'MH Primary Permits (2024–2025)' },
        { value: '496', label: 'New Home Installs' },
        { value: '8',   label: 'Active Installers/Movers' },
        { value: '5',   label: 'Top Brands Being Placed' },
      ],
      monthlyTrend: [
        { label: "Jan '24", permits: 77,  year: 2024 },
        { label: "Feb '24", permits: 116, year: 2024 },
        { label: "Mar '24", permits: 78,  year: 2024 },
        { label: "Apr '24", permits: 107, year: 2024 },
        { label: "May '24", permits: 136, year: 2024 },
        { label: "Jun '24", permits: 78,  year: 2024 },
        { label: "Jul '24", permits: 96,  year: 2024 },
        { label: "Aug '24", permits: 98,  year: 2024 },
        { label: "Sep '24", permits: 80,  year: 2024 },
        { label: "Oct '24", permits: 97,  year: 2024 },
        { label: "Nov '24", permits: 47,  year: 2024 },
        { label: "Dec '24", permits: 93,  year: 2024 },
        { label: "Jan '25", permits: 78,  year: 2025 },
        { label: "Feb '25", permits: 102, year: 2025 },
        { label: "Mar '25", permits: 86,  year: 2025 },
        { label: "Apr '25", permits: 130, year: 2025 },
        { label: "May '25", permits: 145, year: 2025 },
        { label: "Jun '25", permits: 92,  year: 2025 },
        { label: "Jul '25", permits: 126, year: 2025 },
        { label: "Aug '25", permits: 56,  year: 2025 },
        { label: "Sep '25", permits: 46,  year: 2025 },
      ],
      installers: [
        { rank: 1, name: 'C Morgan Mobile Home Movers',  permits: 97, specialty: 'Transport & Setup', status: 'Dominant',
          contact: { phone: null, website: 'https://www.buildzoom.com/contractor/c-morgan-mobile-home-movers', email: null, address: '1547 Morgan Rd SW, Supply, NC 28462' } },
        { rank: 2, name: 'Herring MH Movers',            permits: 94, specialty: 'Transport & Setup', status: 'Very Active',
          contact: { phone: '(910) 371-3370', website: null, email: 'lindaherring24@gmail.com', address: '107 Baldwin Dr, Leland, NC 28451' } },
        { rank: 3, name: 'D & S Enterprises',            permits: 82, specialty: 'General Setup',     status: 'Very Active',
          contact: { phone: null, website: 'https://www.buildzoom.com/contractor/d-and-s-enterprises', email: null, address: '2332 Crestwood Dr SW, Supply, NC 28462' } },
        { rank: 4, name: 'Rogers Mobile Home Transport', permits: 36, specialty: 'Transport & Setup', status: 'Active',
          contact: { phone: '(910) 654-3074', website: null, email: null, address: '267 Black Cherry Rd, Chadbourn, NC 28431' } },
        { rank: 5, name: 'Zendal Whaley',                permits: 34, specialty: 'Setup Contractor',  status: 'Active',
          contact: { phone: '(910) 367-6078', website: null, email: null, address: '1375 Gray Bridge Rd, Shallotte, NC 28470' } },
        { rank: 6, name: 'C & J Home Services',          permits: 26, specialty: 'Setup Contractor',  status: 'Active',
          contact: { phone: '(843) 373-1013', website: null, email: null, address: '1080 Main St, Fair Bluff, NC 28439' } },
        { rank: 7, name: "Dougies Mobile Home Movers",   permits: 21, specialty: 'Transport & Setup', status: 'Active',
          contact: { phone: '(910) 740-2030', website: null, email: 'dougielocklear@gmail.com', address: '411 Barker Ten Mile Rd, Lumberton, NC 28358' } },
        { rank: 8, name: 'Carolina Homes of Lumberton',  permits: 13, specialty: 'Dealer + Setup',    status: 'Active',
          contact: { phone: '(910) 536-1005', website: 'https://www.carolinahomesoflumberton.com', email: 'salesoffice@carolinahomeslumberton.com', address: '3601 E Elizabethtown Rd, Lumberton, NC 28358' } },
      ],
      brands: ['Champion', 'Cavco', 'Clayton', 'Hamilton', 'Fleetwood', 'TRU', 'Rockwell', 'Cavalier'],
      dataSource: 'Data sourced from Brunswick County NC Open Data Portal (data-brunsco.opendata.arcgis.com) — Permit Locations feature service. 2024–2025 active permits. Updated monthly.',
    },
  },

  {
    id: 'horry-sc',
    county: 'Horry',
    state: 'SC',
    comingSoon: false,
    permitType: 'Manufactured / Mobile Homes',
    permitCount: 344,
    permits2025: 273,
    newInstalls: 177,
    usedRelocated: 137,
    marketStatus: 'Very Active Market',
    monthlyTrend: [
      { label: "Jan '24", permits: 1,  year: 2024 },
      { label: "Feb '24", permits: 3,  year: 2024 },
      { label: "Mar '24", permits: 0,  year: 2024 },
      { label: "Apr '24", permits: 3,  year: 2024 },
      { label: "May '24", permits: 2,  year: 2024 },
      { label: "Jun '24", permits: 0,  year: 2024 },
      { label: "Jul '24", permits: 0,  year: 2024 },
      { label: "Aug '24", permits: 1,  year: 2024 },
      { label: "Sep '24", permits: 5,  year: 2024 },
      { label: "Oct '24", permits: 9,  year: 2024 },
      { label: "Nov '24", permits: 4,  year: 2024 },
      { label: "Dec '24", permits: 2,  year: 2024 },
      { label: "Jan '25", permits: 24, year: 2025 },
      { label: "Feb '25", permits: 24, year: 2025 },
      { label: "Mar '25", permits: 26, year: 2025 },
      { label: "Apr '25", permits: 49, year: 2025 },
      { label: "May '25", permits: 29, year: 2025 },
      { label: "Jun '25", permits: 27, year: 2025 },
      { label: "Jul '25", permits: 33, year: 2025 },
      { label: "Aug '25", permits: 33, year: 2025 },
      { label: "Sep '25", permits: 28, year: 2025 },
    ],
    dataSource: 'Data sourced from Horry County GIS Active Permits database (horrycounty.org). Installer rankings based on market presence. For exact permit-by-installer data, contact Horry County Code Enforcement (843) 915-5090 or submit a public records request.',
    builders: [
      { rank: 1, name: 'Clayton Homes of Conway',  type: 'Dealer + Installer',      notes: 'National brand, high-volume dealer on US-501',                                        status: 'Dominant'    },
      { rank: 2, name: "Herrington's LLC",          type: 'Full Turnkey Installer',  notes: 'Family-owned 30+ years, serves all of Horry County, full site prep + setup',         status: 'Very Active' },
      { rank: 3, name: 'Regional Homes of Conway',  type: 'Dealer',                 notes: 'Major Southeast retailer, strong Horry County presence',                              status: 'Very Active' },
      { rank: 4, name: 'H&H Builders',              type: 'Dealer + Builder',        notes: 'Family-owned since 1974, land & home packages, serves Conway/Horry',                 status: 'Active'      },
      { rank: 5, name: "Rabon's Home Center",       type: 'Dealer',                 notes: 'Conway-based, carries Scotbilt, Cavco, Sunshine, Clayton Tempo',                     status: 'Active'      },
      { rank: 6, name: 'Williamson Mobile Home',    type: 'Installer',              notes: 'Local Conway installer',                                                              status: 'Active'      },
      { rank: 7, name: 'Stevens Mobile Homes Inc',  type: 'Dealer + Installer',      notes: 'Located at 1094 US-501, Conway',                                                     status: 'Active'      },
    ],
  },

  // ── NORTH CAROLINA — Coming Soon ─────────────────────────────────────────
  { id: 'wake-nc',        county: 'Wake',        state: 'NC', comingSoon: true },
  { id: 'mecklenburg-nc', county: 'Mecklenburg', state: 'NC', comingSoon: true },
  { id: 'forsyth-nc',     county: 'Forsyth',     state: 'NC', comingSoon: true },
  { id: 'durham-nc',      county: 'Durham',      state: 'NC', comingSoon: true },
  { id: 'cumberland-nc',  county: 'Cumberland',  state: 'NC', comingSoon: true },
  { id: 'union-nc',       county: 'Union',       state: 'NC', comingSoon: true },
  { id: 'cabarrus-nc',    county: 'Cabarrus',    state: 'NC', comingSoon: true },
  { id: 'johnston-nc',    county: 'Johnston',    state: 'NC', comingSoon: true },
  { id: 'new-hanover-nc', county: 'New Hanover', state: 'NC', comingSoon: true },
  { id: 'onslow-nc',      county: 'Onslow',      state: 'NC', comingSoon: true },
  { id: 'alamance-nc',    county: 'Alamance',    state: 'NC', comingSoon: true },
  { id: 'rowan-nc',       county: 'Rowan',       state: 'NC', comingSoon: true },
  { id: 'randolph-nc',    county: 'Randolph',    state: 'NC', comingSoon: true },
  { id: 'catawba-nc',     county: 'Catawba',     state: 'NC', comingSoon: true },
  { id: 'iredell-nc',     county: 'Iredell',     state: 'NC', comingSoon: true },
  { id: 'gaston-nc',      county: 'Gaston',      state: 'NC', comingSoon: true },
  { id: 'moore-nc',       county: 'Moore',       state: 'NC', comingSoon: true },
  { id: 'harnett-nc',     county: 'Harnett',     state: 'NC', comingSoon: true },
  { id: 'lee-nc',         county: 'Lee',         state: 'NC', comingSoon: true },

  // ── SOUTH CAROLINA — Coming Soon ─────────────────────────────────────────
  { id: 'greenville-sc',  county: 'Greenville',  state: 'SC', comingSoon: true },
  { id: 'spartanburg-sc', county: 'Spartanburg', state: 'SC', comingSoon: true },
  { id: 'richland-sc',    county: 'Richland',    state: 'SC', comingSoon: true },
  { id: 'charleston-sc',  county: 'Charleston',  state: 'SC', comingSoon: true },
  { id: 'lexington-sc',   county: 'Lexington',   state: 'SC', comingSoon: true },
  { id: 'york-sc',        county: 'York',        state: 'SC', comingSoon: true },
  { id: 'anderson-sc',    county: 'Anderson',    state: 'SC', comingSoon: true },
  { id: 'berkeley-sc',    county: 'Berkeley',    state: 'SC', comingSoon: true },
  { id: 'dorchester-sc',  county: 'Dorchester',  state: 'SC', comingSoon: true },
];

// Helpers
export function totalPermits(county) {
  if (county.permitCount !== undefined) return county.permitCount;
  return (county.builders || []).reduce((s, b) => s + (b.permits || 0), 0);
}
export function topBuilder(county) {
  return (county.builders || [])[0] || null;
}
