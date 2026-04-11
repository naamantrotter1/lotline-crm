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

  // ── NORTH CAROLINA — Coming Soon ─────────────────────────────────────────
  { id: 'wake-nc',        county: 'Wake',        state: 'NC', comingSoon: true },
  { id: 'mecklenburg-nc', county: 'Mecklenburg', state: 'NC', comingSoon: true },
  { id: 'forsyth-nc',     county: 'Forsyth',     state: 'NC', comingSoon: true },
  { id: 'durham-nc',      county: 'Durham',      state: 'NC', comingSoon: true },
  { id: 'cumberland-nc',  county: 'Cumberland',  state: 'NC', comingSoon: true },
  { id: 'union-nc',       county: 'Union',       state: 'NC', comingSoon: true },
  { id: 'cabarrus-nc',    county: 'Cabarrus',    state: 'NC', comingSoon: true },
  { id: 'johnston-nc',    county: 'Johnston',    state: 'NC', comingSoon: true },
  { id: 'brunswick-nc',   county: 'Brunswick',   state: 'NC', comingSoon: true },
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
  { id: 'horry-sc',       county: 'Horry',       state: 'SC', comingSoon: true },
  { id: 'lexington-sc',   county: 'Lexington',   state: 'SC', comingSoon: true },
  { id: 'york-sc',        county: 'York',        state: 'SC', comingSoon: true },
  { id: 'anderson-sc',    county: 'Anderson',    state: 'SC', comingSoon: true },
  { id: 'berkeley-sc',    county: 'Berkeley',    state: 'SC', comingSoon: true },
  { id: 'dorchester-sc',  county: 'Dorchester',  state: 'SC', comingSoon: true },
];

// Helpers
export function totalPermits(county) {
  return (county.builders || []).reduce((s, b) => s + b.permits, 0);
}
export function topBuilder(county) {
  return (county.builders || [])[0] || null;
}
