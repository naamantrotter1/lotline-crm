import { useState, useMemo } from 'react';
import { MapPin, Search, Info } from 'lucide-react';
import { MARKET_COUNTY_DATA as COUNTY_DATA } from '../data/counties.js';

const ARV_DATA = [
  { county: 'Alamance', state: 'NC', minArv: 150000, maxArv: 220900, avgArv: 191700, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Bertie', state: 'NC', minArv: 35000, maxArv: 35000, avgArv: 35000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Brunswick', state: 'NC', minArv: 125000, maxArv: 265000, avgArv: 199326, comps: 25, lastUpdated: 'Apr 2026' },
  { county: 'Buncombe', state: 'NC', minArv: 231000, maxArv: 400000, avgArv: 296368, comps: 19, lastUpdated: 'Apr 2026' },
  { county: 'Burke', state: 'NC', minArv: 125000, maxArv: 237000, avgArv: 198550, comps: 10, lastUpdated: 'Apr 2026' },
  { county: 'Caldwell', state: 'NC', minArv: 167500, maxArv: 257500, avgArv: 221800, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Carteret', state: 'NC', minArv: 190000, maxArv: 249400, avgArv: 223471, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Caswell', state: 'NC', minArv: 130000, maxArv: 130000, avgArv: 130000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Catawba', state: 'NC', minArv: 170000, maxArv: 215000, avgArv: 189000, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Chowan', state: 'NC', minArv: 120000, maxArv: 250000, avgArv: 175200, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Clay', state: 'NC', minArv: 135000, maxArv: 135000, avgArv: 135000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Columbus', state: 'NC', minArv: 120000, maxArv: 231000, avgArv: 178580, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Craven', state: 'NC', minArv: 160000, maxArv: 255500, avgArv: 208757, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Cumberland', state: 'NC', minArv: 175000, maxArv: 260000, avgArv: 215975, comps: 8, lastUpdated: 'Apr 2026' },
  { county: 'Currituck', state: 'NC', minArv: 180000, maxArv: 180000, avgArv: 180000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Dare', state: 'NC', minArv: 186000, maxArv: 186000, avgArv: 186000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Davidson', state: 'NC', minArv: 105200, maxArv: 106000, avgArv: 105600, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Davie', state: 'NC', minArv: 106000, maxArv: 115000, avgArv: 110500, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Duplin', state: 'NC', minArv: 145000, maxArv: 175000, avgArv: 160000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Durham', state: 'NC', minArv: 150000, maxArv: 280000, avgArv: 215000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Edgecombe', state: 'NC', minArv: 75000, maxArv: 125000, avgArv: 100000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Forsyth', state: 'NC', minArv: 105000, maxArv: 105000, avgArv: 105000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Franklin', state: 'NC', minArv: 165000, maxArv: 240000, avgArv: 202500, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Gaston', state: 'NC', minArv: 175000, maxArv: 320000, avgArv: 224292, comps: 13, lastUpdated: 'Apr 2026' },
  { county: 'Graham', state: 'NC', minArv: 658000, maxArv: 658000, avgArv: 658000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Granville', state: 'NC', minArv: 124735, maxArv: 124735, avgArv: 124735, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Guilford', state: 'NC', minArv: 135000, maxArv: 220000, avgArv: 182975, comps: 9, lastUpdated: 'Apr 2026' },
  { county: 'Harnett', state: 'NC', minArv: 176220, maxArv: 205000, avgArv: 190610, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Haywood', state: 'NC', minArv: 65000, maxArv: 65000, avgArv: 65000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Henderson', state: 'NC', minArv: 210000, maxArv: 318000, avgArv: 249322, comps: 9, lastUpdated: 'Apr 2026' },
  { county: 'Hertford', state: 'NC', minArv: 30500, maxArv: 30500, avgArv: 30500, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Hoke', state: 'NC', minArv: 143000, maxArv: 275000, avgArv: 193522, comps: 9, lastUpdated: 'Apr 2026' },
  { county: 'Iredell', state: 'NC', minArv: 155000, maxArv: 281000, avgArv: 234371, comps: 21, lastUpdated: 'Apr 2026' },
  { county: 'Johnston', state: 'NC', minArv: 205000, maxArv: 249900, avgArv: 220033, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Jones', state: 'NC', minArv: 125000, maxArv: 200000, avgArv: 164500, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Lee', state: 'NC', minArv: 90000, maxArv: 155000, avgArv: 122500, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Lenoir', state: 'NC', minArv: 115000, maxArv: 178000, avgArv: 153300, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Lincoln', state: 'NC', minArv: 140000, maxArv: 259000, avgArv: 202091, comps: 11, lastUpdated: 'Apr 2026' },
  { county: 'Macon', state: 'NC', minArv: 59000, maxArv: 59000, avgArv: 59000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Madison', state: 'NC', minArv: 95000, maxArv: 95000, avgArv: 95000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Martin', state: 'NC', minArv: 25000, maxArv: 30000, avgArv: 27500, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'McDowell', state: 'NC', minArv: 155000, maxArv: 270000, avgArv: 222667, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Mecklenburg', state: 'NC', minArv: 230000, maxArv: 255000, avgArv: 242500, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Moore', state: 'NC', minArv: 140000, maxArv: 175000, avgArv: 160375, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Nash', state: 'NC', minArv: 115500, maxArv: 214900, avgArv: 174971, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'New Hanover', state: 'NC', minArv: 220000, maxArv: 330000, avgArv: 267000, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Northampton', state: 'NC', minArv: 100000, maxArv: 100000, avgArv: 100000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Onslow', state: 'NC', minArv: 160000, maxArv: 275000, avgArv: 213276, comps: 17, lastUpdated: 'Apr 2026' },
  { county: 'Orange', state: 'NC', minArv: 145000, maxArv: 300000, avgArv: 216429, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Pamlico', state: 'NC', minArv: 165000, maxArv: 211000, avgArv: 191500, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Pasquotank', state: 'NC', minArv: 209000, maxArv: 235000, avgArv: 222000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Pender', state: 'NC', minArv: 130000, maxArv: 285000, avgArv: 211568, comps: 37, lastUpdated: 'Apr 2026' },
  { county: 'Perquimans', state: 'NC', minArv: 120000, maxArv: 232000, avgArv: 188796, comps: 12, lastUpdated: 'Apr 2026' },
  { county: 'Pitt', state: 'NC', minArv: 40000, maxArv: 80000, avgArv: 60000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Randolph', state: 'NC', minArv: 140000, maxArv: 273145, avgArv: 212807, comps: 21, lastUpdated: 'Apr 2026' },
  { county: 'Robeson', state: 'NC', minArv: 137000, maxArv: 222900, avgArv: 177170, comps: 10, lastUpdated: 'Apr 2026' },
  { county: 'Rockingham', state: 'NC', minArv: 130000, maxArv: 199900, avgArv: 172040, comps: 10, lastUpdated: 'Apr 2026' },
  { county: 'Rowan', state: 'NC', minArv: 170000, maxArv: 328000, avgArv: 238253, comps: 20, lastUpdated: 'Apr 2026' },
  { county: 'Rutherford', state: 'NC', minArv: 115000, maxArv: 225000, avgArv: 176258, comps: 12, lastUpdated: 'Apr 2026' },
  { county: 'Sampson', state: 'NC', minArv: 80000, maxArv: 174383, avgArv: 138423, comps: 14, lastUpdated: 'Apr 2026' },
  { county: 'Scotland', state: 'NC', minArv: 145000, maxArv: 187000, avgArv: 166000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Stanly', state: 'NC', minArv: 174000, maxArv: 339500, avgArv: 254278, comps: 9, lastUpdated: 'Apr 2026' },
  { county: 'Stokes', state: 'NC', minArv: 165000, maxArv: 165000, avgArv: 165000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Surry', state: 'NC', minArv: 196000, maxArv: 257000, avgArv: 223000, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Swain', state: 'NC', minArv: 111500, maxArv: 111500, avgArv: 111500, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Transylvania', state: 'NC', minArv: 145900, maxArv: 299000, avgArv: 233940, comps: 10, lastUpdated: 'Apr 2026' },
  { county: 'Tyrrell', state: 'NC', minArv: 7500, maxArv: 7500, avgArv: 7500, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Union', state: 'NC', minArv: 170000, maxArv: 352500, avgArv: 258156, comps: 20, lastUpdated: 'Apr 2026' },
  { county: 'Vance', state: 'NC', minArv: 155000, maxArv: 275000, avgArv: 232900, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Wake', state: 'NC', minArv: 228960, maxArv: 339000, avgArv: 273561, comps: 14, lastUpdated: 'Apr 2026' },
  { county: 'Warren', state: 'NC', minArv: 168958, maxArv: 288500, avgArv: 231226, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Washington', state: 'NC', minArv: 113500, maxArv: 175000, avgArv: 137833, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Wayne', state: 'NC', minArv: 120000, maxArv: 212600, avgArv: 178550, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Wilkes', state: 'NC', minArv: 168000, maxArv: 240000, avgArv: 216113, comps: 8, lastUpdated: 'Apr 2026' },
  { county: 'Wilson', state: 'NC', minArv: 738000, maxArv: 738000, avgArv: 738000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Yadkin', state: 'NC', minArv: 100000, maxArv: 156000, avgArv: 135750, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Yancey', state: 'NC', minArv: 123043, maxArv: 240000, avgArv: 201395, comps: 8, lastUpdated: 'Apr 2026' },
  // SC counties
  { county: 'Abbeville', state: 'SC', minArv: 83000, maxArv: 88000, avgArv: 85500, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Aiken', state: 'SC', minArv: 129900, maxArv: 239500, avgArv: 179633, comps: 12, lastUpdated: 'Apr 2026' },
  { county: 'Allendale', state: 'SC', minArv: 58000, maxArv: 58000, avgArv: 58000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Anderson', state: 'SC', minArv: 110000, maxArv: 229000, avgArv: 161325, comps: 12, lastUpdated: 'Apr 2026' },
  { county: 'Barnwell', state: 'SC', minArv: 140000, maxArv: 140000, avgArv: 140000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Beaufort', state: 'SC', minArv: 140000, maxArv: 307500, avgArv: 227886, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Berkeley', state: 'SC', minArv: 250000, maxArv: 374500, avgArv: 291650, comps: 10, lastUpdated: 'Apr 2026' },
  { county: 'Charleston', state: 'SC', minArv: 186000, maxArv: 350000, avgArv: 275857, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Cherokee', state: 'SC', minArv: 149900, maxArv: 270000, avgArv: 198156, comps: 9, lastUpdated: 'Apr 2026' },
  { county: 'Chester', state: 'SC', minArv: 185000, maxArv: 330000, avgArv: 257389, comps: 9, lastUpdated: 'Apr 2026' },
  { county: 'Chesterfield', state: 'SC', minArv: 45000, maxArv: 45000, avgArv: 45000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Colleton', state: 'SC', minArv: 148000, maxArv: 310000, avgArv: 245683, comps: 18, lastUpdated: 'Apr 2026' },
  { county: 'Dillon', state: 'SC', minArv: 45000, maxArv: 48000, avgArv: 46500, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Dorchester', state: 'SC', minArv: 188500, maxArv: 330000, avgArv: 273278, comps: 18, lastUpdated: 'Apr 2026' },
  { county: 'Edgefield', state: 'SC', minArv: 125000, maxArv: 125000, avgArv: 125000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Florence', state: 'SC', minArv: 90000, maxArv: 179000, avgArv: 122988, comps: 8, lastUpdated: 'Apr 2026' },
  { county: 'Georgetown', state: 'SC', minArv: 130000, maxArv: 287000, avgArv: 192315, comps: 23, lastUpdated: 'Apr 2026' },
  { county: 'Greenville', state: 'SC', minArv: 81500, maxArv: 170000, avgArv: 109722, comps: 9, lastUpdated: 'Apr 2026' },
  { county: 'Greenwood', state: 'SC', minArv: 150000, maxArv: 200000, avgArv: 174960, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Hampton', state: 'SC', minArv: 105000, maxArv: 130000, avgArv: 117500, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Horry', state: 'SC', minArv: 115000, maxArv: 254000, avgArv: 189600, comps: 81, lastUpdated: 'Apr 2026' },
  { county: 'Jasper', state: 'SC', minArv: 162000, maxArv: 185000, avgArv: 173500, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Kershaw', state: 'SC', minArv: 250000, maxArv: 250000, avgArv: 250000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Lancaster', state: 'SC', minArv: 375000, maxArv: 375000, avgArv: 375000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Laurens', state: 'SC', minArv: 137000, maxArv: 213000, avgArv: 185067, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Lee', state: 'SC', minArv: 219900, maxArv: 280000, avgArv: 246560, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Lexington', state: 'SC', minArv: 89000, maxArv: 133000, avgArv: 110667, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Marion', state: 'SC', minArv: 92662, maxArv: 185000, avgArv: 142123, comps: 16, lastUpdated: 'Apr 2026' },
  { county: 'Marlboro', state: 'SC', minArv: 119900, maxArv: 199900, avgArv: 155642, comps: 12, lastUpdated: 'Apr 2026' },
  { county: 'McCormick', state: 'SC', minArv: 191000, maxArv: 191000, avgArv: 191000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Newberry', state: 'SC', minArv: 185000, maxArv: 258500, avgArv: 229500, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Oconee', state: 'SC', minArv: 149900, maxArv: 304000, avgArv: 204200, comps: 16, lastUpdated: 'Apr 2026' },
  { county: 'Orangeburg', state: 'SC', minArv: 95000, maxArv: 180000, avgArv: 129025, comps: 11, lastUpdated: 'Apr 2026' },
  { county: 'Pickens', state: 'SC', minArv: 94500, maxArv: 200000, avgArv: 155072, comps: 36, lastUpdated: 'Apr 2026' },
  { county: 'Richland', state: 'SC', minArv: 110764, maxArv: 240000, avgArv: 178924, comps: 21, lastUpdated: 'Apr 2026' },
  { county: 'Saluda', state: 'SC', minArv: 100000, maxArv: 107000, avgArv: 103500, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Spartanburg', state: 'SC', minArv: 133900, maxArv: 225000, avgArv: 191135, comps: 13, lastUpdated: 'Apr 2026' },
  { county: 'Sumter', state: 'SC', minArv: 115000, maxArv: 180500, avgArv: 148750, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Union', state: 'SC', minArv: 106000, maxArv: 232900, avgArv: 177099, comps: 24, lastUpdated: 'Apr 2026' },
  { county: 'Williamsburg', state: 'SC', minArv: 120000, maxArv: 250000, avgArv: 182587, comps: 15, lastUpdated: 'Apr 2026' },
  { county: 'York', state: 'SC', minArv: 147200, maxArv: 309000, avgArv: 228518, comps: 28, lastUpdated: 'Apr 2026' },
  // GA counties
  { county: 'Atkinson', state: 'GA', minArv: 204900, maxArv: 204900, avgArv: 204900, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Baldwin', state: 'GA', minArv: 280000, maxArv: 499900, avgArv: 389950, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Banks', state: 'GA', minArv: 240000, maxArv: 325000, avgArv: 279643, comps: 14, lastUpdated: 'Apr 2026' },
  { county: 'Barrow', state: 'GA', minArv: 284000, maxArv: 284000, avgArv: 284000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Bartow', state: 'GA', minArv: 236000, maxArv: 239000, avgArv: 237500, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Berrien', state: 'GA', minArv: 112800, maxArv: 203900, avgArv: 158350, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Bibb', state: 'GA', minArv: 195000, maxArv: 299000, avgArv: 223475, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Brantley', state: 'GA', minArv: 169900, maxArv: 280000, avgArv: 213394, comps: 53, lastUpdated: 'Apr 2026' },
  { county: 'Bryan', state: 'GA', minArv: 208000, maxArv: 312000, avgArv: 259223, comps: 21, lastUpdated: 'Apr 2026' },
  { county: 'Bulloch', state: 'GA', minArv: 235000, maxArv: 319000, avgArv: 277967, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Burke', state: 'GA', minArv: 21000, maxArv: 21000, avgArv: 21000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Camden', state: 'GA', minArv: 199000, maxArv: 295000, avgArv: 244100, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Candler', state: 'GA', minArv: 189900, maxArv: 275000, avgArv: 226614, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Carroll', state: 'GA', minArv: 189900, maxArv: 313362, avgArv: 250436, comps: 23, lastUpdated: 'Apr 2026' },
  { county: 'Charlton', state: 'GA', minArv: 134900, maxArv: 275000, avgArv: 197737, comps: 21, lastUpdated: 'Apr 2026' },
  { county: 'Chatham', state: 'GA', minArv: 174500, maxArv: 340000, avgArv: 262073, comps: 11, lastUpdated: 'Apr 2026' },
  { county: 'Cherokee', state: 'GA', minArv: 285000, maxArv: 380000, avgArv: 336544, comps: 9, lastUpdated: 'Apr 2026' },
  { county: 'Clarke', state: 'GA', minArv: 349900, maxArv: 349900, avgArv: 349900, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Clayton', state: 'GA', minArv: 60000, maxArv: 60000, avgArv: 60000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Clinch', state: 'GA', minArv: 124900, maxArv: 124900, avgArv: 124900, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Cobb', state: 'GA', minArv: 55000, maxArv: 69500, avgArv: 62250, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Coffee', state: 'GA', minArv: 165000, maxArv: 236000, avgArv: 196750, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Colquitt', state: 'GA', minArv: 19500, maxArv: 35000, avgArv: 27250, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Columbia', state: 'GA', minArv: 175000, maxArv: 175000, avgArv: 175000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Cook', state: 'GA', minArv: 169900, maxArv: 245000, avgArv: 207450, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Coweta', state: 'GA', minArv: 255000, maxArv: 255000, avgArv: 255000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Dodge', state: 'GA', minArv: 134595, maxArv: 179900, avgArv: 159939, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Douglas', state: 'GA', minArv: 199200, maxArv: 361990, avgArv: 247056, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Effingham', state: 'GA', minArv: 219500, maxArv: 343000, avgArv: 260250, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Emanuel', state: 'GA', minArv: 139500, maxArv: 265000, avgArv: 209611, comps: 9, lastUpdated: 'Apr 2026' },
  { county: 'Evans', state: 'GA', minArv: 185000, maxArv: 185000, avgArv: 185000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Fannin', state: 'GA', minArv: 175000, maxArv: 339000, avgArv: 271464, comps: 11, lastUpdated: 'Apr 2026' },
  { county: 'Floyd', state: 'GA', minArv: 150000, maxArv: 150000, avgArv: 150000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Forsyth', state: 'GA', minArv: 265000, maxArv: 265000, avgArv: 265000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Gilmer', state: 'GA', minArv: 202000, maxArv: 330000, avgArv: 257223, comps: 13, lastUpdated: 'Apr 2026' },
  { county: 'Glascock', state: 'GA', minArv: 235000, maxArv: 235000, avgArv: 235000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Glynn', state: 'GA', minArv: 214900, maxArv: 290000, avgArv: 238940, comps: 10, lastUpdated: 'Apr 2026' },
  { county: 'Gordon', state: 'GA', minArv: 225000, maxArv: 379900, avgArv: 296225, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Grady', state: 'GA', minArv: 30000, maxArv: 30000, avgArv: 30000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Greene', state: 'GA', minArv: 210000, maxArv: 271000, avgArv: 239735, comps: 20, lastUpdated: 'Apr 2026' },
  { county: 'Gwinnett', state: 'GA', minArv: 620000, maxArv: 620000, avgArv: 620000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Habersham', state: 'GA', minArv: 173500, maxArv: 307000, avgArv: 258891, comps: 31, lastUpdated: 'Apr 2026' },
  { county: 'Hall', state: 'GA', minArv: 247000, maxArv: 357000, avgArv: 285037, comps: 19, lastUpdated: 'Apr 2026' },
  { county: 'Haralson', state: 'GA', minArv: 219900, maxArv: 300000, avgArv: 263940, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Harris', state: 'GA', minArv: 149000, maxArv: 185000, avgArv: 168000, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Hart', state: 'GA', minArv: 166500, maxArv: 300000, avgArv: 221681, comps: 34, lastUpdated: 'Apr 2026' },
  { county: 'Henry', state: 'GA', minArv: 335000, maxArv: 505210, avgArv: 442093, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Houston', state: 'GA', minArv: 178000, maxArv: 215000, avgArv: 193248, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Irwin', state: 'GA', minArv: 109900, maxArv: 109900, avgArv: 109900, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Jackson', state: 'GA', minArv: 245000, maxArv: 350000, avgArv: 291971, comps: 17, lastUpdated: 'Apr 2026' },
  { county: 'Jeff Davis', state: 'GA', minArv: 137002, maxArv: 274000, avgArv: 197258, comps: 32, lastUpdated: 'Apr 2026' },
  { county: 'Jefferson', state: 'GA', minArv: 248000, maxArv: 302000, avgArv: 275000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Johnson', state: 'GA', minArv: 132000, maxArv: 200000, avgArv: 166000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Jones', state: 'GA', minArv: 180000, maxArv: 197000, avgArv: 188500, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Lamar', state: 'GA', minArv: 292000, maxArv: 292000, avgArv: 292000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Lanier', state: 'GA', minArv: 159900, maxArv: 160000, avgArv: 159950, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Laurens', state: 'GA', minArv: 260000, maxArv: 260000, avgArv: 260000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Liberty', state: 'GA', minArv: 161000, maxArv: 270000, avgArv: 227319, comps: 23, lastUpdated: 'Apr 2026' },
  { county: 'Lincoln', state: 'GA', minArv: 199500, maxArv: 199500, avgArv: 199500, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Long', state: 'GA', minArv: 170622, maxArv: 348000, avgArv: 249193, comps: 20, lastUpdated: 'Apr 2026' },
  { county: 'Lowndes', state: 'GA', minArv: 159000, maxArv: 214500, avgArv: 191208, comps: 11, lastUpdated: 'Apr 2026' },
  { county: 'Lumpkin', state: 'GA', minArv: 245000, maxArv: 425000, avgArv: 293025, comps: 11, lastUpdated: 'Apr 2026' },
  { county: 'Macon', state: 'GA', minArv: 3850000, maxArv: 3850000, avgArv: 3850000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Madison', state: 'GA', minArv: 165000, maxArv: 285000, avgArv: 231962, comps: 21, lastUpdated: 'Apr 2026' },
  { county: 'McIntosh', state: 'GA', minArv: 179000, maxArv: 300000, avgArv: 218435, comps: 10, lastUpdated: 'Apr 2026' },
  { county: 'Meriwether', state: 'GA', minArv: 255000, maxArv: 255000, avgArv: 255000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Monroe', state: 'GA', minArv: 270000, maxArv: 270000, avgArv: 270000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Morgan', state: 'GA', minArv: 351000, maxArv: 351000, avgArv: 351000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Murray', state: 'GA', minArv: 139000, maxArv: 254000, avgArv: 207446, comps: 15, lastUpdated: 'Apr 2026' },
  { county: 'Newton', state: 'GA', minArv: 291000, maxArv: 291000, avgArv: 291000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Oconee', state: 'GA', minArv: 251000, maxArv: 299800, avgArv: 275400, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Oglethorpe', state: 'GA', minArv: 227500, maxArv: 390000, avgArv: 302257, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Paulding', state: 'GA', minArv: 245140, maxArv: 270000, avgArv: 258098, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Pickens', state: 'GA', minArv: 225000, maxArv: 428000, avgArv: 285757, comps: 38, lastUpdated: 'Apr 2026' },
  { county: 'Pierce', state: 'GA', minArv: 165000, maxArv: 165000, avgArv: 165000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Pike', state: 'GA', minArv: 299900, maxArv: 299900, avgArv: 299900, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Polk', state: 'GA', minArv: 226000, maxArv: 290000, avgArv: 256250, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Richmond', state: 'GA', minArv: 140000, maxArv: 299900, avgArv: 217864, comps: 11, lastUpdated: 'Apr 2026' },
  { county: 'Screven', state: 'GA', minArv: 229000, maxArv: 335000, avgArv: 287750, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Stephens', state: 'GA', minArv: 148000, maxArv: 290000, avgArv: 214159, comps: 29, lastUpdated: 'Apr 2026' },
  { county: 'Sumter', state: 'GA', minArv: 185000, maxArv: 187000, avgArv: 186000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Talbot', state: 'GA', minArv: 16900, maxArv: 16900, avgArv: 16900, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Tattnall', state: 'GA', minArv: 154900, maxArv: 199900, avgArv: 178378, comps: 9, lastUpdated: 'Apr 2026' },
  { county: 'Taylor', state: 'GA', minArv: 14000, maxArv: 14000, avgArv: 14000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Telfair', state: 'GA', minArv: 124000, maxArv: 186500, avgArv: 155250, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Thomas', state: 'GA', minArv: 290000, maxArv: 290000, avgArv: 290000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Upson', state: 'GA', minArv: 305000, maxArv: 320000, avgArv: 312500, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Walker', state: 'GA', minArv: 152000, maxArv: 245000, avgArv: 217818, comps: 11, lastUpdated: 'Apr 2026' },
  { county: 'Walton', state: 'GA', minArv: 285000, maxArv: 285000, avgArv: 285000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Ware', state: 'GA', minArv: 135000, maxArv: 214400, avgArv: 182550, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Washington', state: 'GA', minArv: 230000, maxArv: 230000, avgArv: 230000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Wayne', state: 'GA', minArv: 175000, maxArv: 275000, avgArv: 212186, comps: 14, lastUpdated: 'Apr 2026' },
  { county: 'Webster', state: 'GA', minArv: 143500, maxArv: 143500, avgArv: 143500, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Wilkes', state: 'GA', minArv: 215000, maxArv: 215000, avgArv: 215000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Wilkinson', state: 'GA', minArv: 145000, maxArv: 145000, avgArv: 145000, comps: 1, lastUpdated: 'Apr 2026' },
  // Virginia
  { county: 'Accomack', state: 'VA', minArv: 299900, maxArv: 340000, avgArv: 319950, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Amelia', state: 'VA', minArv: 255000, maxArv: 295000, avgArv: 275000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Appomattox', state: 'VA', minArv: 198800, maxArv: 267500, avgArv: 229110, comps: 10, lastUpdated: 'Apr 2026' },
  { county: 'Arlington', state: 'VA', minArv: 225000, maxArv: 225000, avgArv: 225000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Bedford', state: 'VA', minArv: 200000, maxArv: 337000, avgArv: 266704, comps: 25, lastUpdated: 'Apr 2026' },
  { county: 'Bland', state: 'VA', minArv: 12000, maxArv: 13000, avgArv: 12500, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Botetourt', state: 'VA', minArv: 124950, maxArv: 124950, avgArv: 124950, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Bristol City', state: 'VA', minArv: 210000, maxArv: 275000, avgArv: 236500, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Buchanan', state: 'VA', minArv: 73173, maxArv: 141000, avgArv: 107087, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Buckingham', state: 'VA', minArv: 250000, maxArv: 250000, avgArv: 250000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Campbell', state: 'VA', minArv: 220000, maxArv: 310000, avgArv: 269857, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Caroline', state: 'VA', minArv: 359999, maxArv: 359999, avgArv: 359999, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Carroll', state: 'VA', minArv: 165000, maxArv: 249000, avgArv: 206756, comps: 8, lastUpdated: 'Apr 2026' },
  { county: 'Charlotte', state: 'VA', minArv: 156000, maxArv: 224900, avgArv: 190450, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Chesapeake City', state: 'VA', minArv: 240000, maxArv: 240000, avgArv: 240000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Chesterfield', state: 'VA', minArv: 1068000, maxArv: 1068000, avgArv: 1068000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Culpeper', state: 'VA', minArv: 290000, maxArv: 450000, avgArv: 370000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Danville City', state: 'VA', minArv: 198000, maxArv: 200000, avgArv: 199000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Fairfax', state: 'VA', minArv: 680000, maxArv: 1400000, avgArv: 1005739, comps: 9, lastUpdated: 'Apr 2026' },
  { county: 'Floyd', state: 'VA', minArv: 270000, maxArv: 360000, avgArv: 302833, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Fluvanna', state: 'VA', minArv: 299900, maxArv: 340000, avgArv: 313978, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Franklin', state: 'VA', minArv: 209000, maxArv: 280000, avgArv: 244250, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Franklin City', state: 'VA', minArv: 228000, maxArv: 228000, avgArv: 228000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Frederick', state: 'VA', minArv: 405000, maxArv: 555000, avgArv: 480000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Galax City', state: 'VA', minArv: 230575, maxArv: 241000, avgArv: 235788, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Giles', state: 'VA', minArv: 212500, maxArv: 212500, avgArv: 212500, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Gloucester', state: 'VA', minArv: 295000, maxArv: 402250, avgArv: 348625, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Goochland', state: 'VA', minArv: 440000, maxArv: 440000, avgArv: 440000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Greene', state: 'VA', minArv: 675000, maxArv: 675000, avgArv: 675000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Hampton City', state: 'VA', minArv: 260000, maxArv: 260000, avgArv: 260000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Hanover', state: 'VA', minArv: 449900, maxArv: 840000, avgArv: 644950, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Henrico', state: 'VA', minArv: 268000, maxArv: 268000, avgArv: 268000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Henry', state: 'VA', minArv: 187000, maxArv: 260000, avgArv: 223875, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Isle of Wight', state: 'VA', minArv: 425000, maxArv: 425000, avgArv: 425000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'James City', state: 'VA', minArv: 365000, maxArv: 365000, avgArv: 365000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'King and Queen', state: 'VA', minArv: 264900, maxArv: 264900, avgArv: 264900, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'King George', state: 'VA', minArv: 346136, maxArv: 429321, avgArv: 374075, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Lee', state: 'VA', minArv: 155000, maxArv: 155000, avgArv: 155000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Louisa', state: 'VA', minArv: 260000, maxArv: 345000, avgArv: 314738, comps: 21, lastUpdated: 'Apr 2026' },
  { county: 'Madison', state: 'VA', minArv: 239167, maxArv: 239167, avgArv: 239167, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Manassas Park City', state: 'VA', minArv: 530000, maxArv: 530000, avgArv: 530000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Middlesex', state: 'VA', minArv: 226500, maxArv: 325000, avgArv: 275750, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Norfolk City', state: 'VA', minArv: 116000, maxArv: 116000, avgArv: 116000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Nottoway', state: 'VA', minArv: 340000, maxArv: 340000, avgArv: 340000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Orange', state: 'VA', minArv: 300000, maxArv: 400000, avgArv: 338650, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Page', state: 'VA', minArv: 245000, maxArv: 321750, avgArv: 284188, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Petersburg City', state: 'VA', minArv: 240000, maxArv: 275000, avgArv: 257500, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Pittsylvania', state: 'VA', minArv: 199900, maxArv: 213000, avgArv: 206450, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Prince Edward', state: 'VA', minArv: 254800, maxArv: 294000, avgArv: 271450, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Pulaski', state: 'VA', minArv: 150000, maxArv: 250000, avgArv: 200000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Radford City', state: 'VA', minArv: 140000, maxArv: 140000, avgArv: 140000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Richmond City', state: 'VA', minArv: 307000, maxArv: 307000, avgArv: 307000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Roanoke', state: 'VA', minArv: 299950, maxArv: 299950, avgArv: 299950, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Russell', state: 'VA', minArv: 120000, maxArv: 120000, avgArv: 120000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Salem City', state: 'VA', minArv: 386000, maxArv: 386000, avgArv: 386000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Scott', state: 'VA', minArv: 151000, maxArv: 247000, avgArv: 199000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Shenandoah', state: 'VA', minArv: 185000, maxArv: 185000, avgArv: 185000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Smyth', state: 'VA', minArv: 200000, maxArv: 225000, avgArv: 215000, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Southampton', state: 'VA', minArv: 398000, maxArv: 398000, avgArv: 398000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Spotsylvania', state: 'VA', minArv: 143900, maxArv: 181900, avgArv: 156089, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Suffolk City', state: 'VA', minArv: 348000, maxArv: 483000, avgArv: 395667, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Surry', state: 'VA', minArv: 235000, maxArv: 250000, avgArv: 242500, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Tazewell', state: 'VA', minArv: 55000, maxArv: 55000, avgArv: 55000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Washington', state: 'VA', minArv: 235000, maxArv: 335000, avgArv: 298922, comps: 9, lastUpdated: 'Apr 2026' },
  { county: 'Westmoreland', state: 'VA', minArv: 267000, maxArv: 267000, avgArv: 267000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Wise', state: 'VA', minArv: 35000, maxArv: 35000, avgArv: 35000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Wythe', state: 'VA', minArv: 299000, maxArv: 388000, avgArv: 336767, comps: 3, lastUpdated: 'Apr 2026' },
  // Tennessee
  { county: 'Anderson', state: 'TN', minArv: 253000, maxArv: 313000, avgArv: 291750, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Bedford', state: 'TN', minArv: 285000, maxArv: 375000, avgArv: 331667, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Benton', state: 'TN', minArv: 223700, maxArv: 248000, avgArv: 235533, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Bledsoe', state: 'TN', minArv: 179900, maxArv: 179900, avgArv: 179900, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Blount', state: 'TN', minArv: 230000, maxArv: 343350, avgArv: 310858, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Bradley', state: 'TN', minArv: 215000, maxArv: 270000, avgArv: 239667, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Cannon', state: 'TN', minArv: 349900, maxArv: 349900, avgArv: 349900, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Carroll', state: 'TN', minArv: 125000, maxArv: 235000, avgArv: 180000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Carter', state: 'TN', minArv: 160000, maxArv: 219900, avgArv: 184300, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Cheatham', state: 'TN', minArv: 232000, maxArv: 460000, avgArv: 346000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Claiborne', state: 'TN', minArv: 125000, maxArv: 200000, avgArv: 163333, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Clay', state: 'TN', minArv: 194400, maxArv: 194400, avgArv: 194400, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Cocke', state: 'TN', minArv: 171715, maxArv: 290000, avgArv: 238328, comps: 20, lastUpdated: 'Apr 2026' },
  { county: 'Coffee', state: 'TN', minArv: 183800, maxArv: 279900, avgArv: 207071, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Cumberland', state: 'TN', minArv: 190000, maxArv: 330000, avgArv: 251563, comps: 8, lastUpdated: 'Apr 2026' },
  { county: 'DeKalb', state: 'TN', minArv: 210000, maxArv: 244900, avgArv: 231633, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Dickson', state: 'TN', minArv: 335000, maxArv: 390000, avgArv: 362500, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Dyer', state: 'TN', minArv: 199000, maxArv: 210000, avgArv: 204500, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Fayette', state: 'TN', minArv: 35000, maxArv: 35000, avgArv: 35000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Franklin', state: 'TN', minArv: 95000, maxArv: 142500, avgArv: 118750, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Grainger', state: 'TN', minArv: 199500, maxArv: 429900, avgArv: 277061, comps: 23, lastUpdated: 'Apr 2026' },
  { county: 'Greene', state: 'TN', minArv: 163800, maxArv: 328000, avgArv: 245378, comps: 61, lastUpdated: 'Apr 2026' },
  { county: 'Hamblen', state: 'TN', minArv: 190000, maxArv: 325000, avgArv: 249526, comps: 33, lastUpdated: 'Apr 2026' },
  { county: 'Hamilton', state: 'TN', minArv: 220000, maxArv: 294000, avgArv: 261167, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Hancock', state: 'TN', minArv: 100000, maxArv: 100000, avgArv: 100000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Hardeman', state: 'TN', minArv: 135000, maxArv: 135000, avgArv: 135000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Hardin', state: 'TN', minArv: 130000, maxArv: 135900, avgArv: 132950, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Hawkins', state: 'TN', minArv: 164000, maxArv: 320000, avgArv: 255449, comps: 30, lastUpdated: 'Apr 2026' },
  { county: 'Haywood', state: 'TN', minArv: 275000, maxArv: 275000, avgArv: 275000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Henderson', state: 'TN', minArv: 173796, maxArv: 246500, avgArv: 193074, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Henry', state: 'TN', minArv: 158000, maxArv: 219900, avgArv: 192996, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Hickman', state: 'TN', minArv: 249900, maxArv: 249900, avgArv: 249900, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Humphreys', state: 'TN', minArv: 255000, maxArv: 295000, avgArv: 273804, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Jackson', state: 'TN', minArv: 130000, maxArv: 234900, avgArv: 177300, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Jefferson', state: 'TN', minArv: 188000, maxArv: 343500, avgArv: 278056, comps: 32, lastUpdated: 'Apr 2026' },
  { county: 'Johnson', state: 'TN', minArv: 275000, maxArv: 275000, avgArv: 275000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Knox', state: 'TN', minArv: 215000, maxArv: 375000, avgArv: 278773, comps: 35, lastUpdated: 'Apr 2026' },
  { county: 'Lake', state: 'TN', minArv: 130000, maxArv: 130000, avgArv: 130000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Lauderdale', state: 'TN', minArv: 155000, maxArv: 190000, avgArv: 172500, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Lawrence', state: 'TN', minArv: 142000, maxArv: 243000, avgArv: 193333, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Lewis', state: 'TN', minArv: 260000, maxArv: 375000, avgArv: 317500, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Lincoln', state: 'TN', minArv: 165000, maxArv: 243500, avgArv: 201167, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Loudon', state: 'TN', minArv: 183500, maxArv: 362000, avgArv: 267156, comps: 21, lastUpdated: 'Apr 2026' },
  { county: 'Macon', state: 'TN', minArv: 185000, maxArv: 329900, avgArv: 248898, comps: 26, lastUpdated: 'Apr 2026' },
  { county: 'Marion', state: 'TN', minArv: 178000, maxArv: 231694, avgArv: 210739, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Marshall', state: 'TN', minArv: 471500, maxArv: 471500, avgArv: 471500, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Maury', state: 'TN', minArv: 219000, maxArv: 365000, avgArv: 277967, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'McMinn', state: 'TN', minArv: 192656, maxArv: 399900, avgArv: 243091, comps: 15, lastUpdated: 'Apr 2026' },
  { county: 'McNairy', state: 'TN', minArv: 125700, maxArv: 145000, avgArv: 136367, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Meigs', state: 'TN', minArv: 224585, maxArv: 234000, avgArv: 229495, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Monroe', state: 'TN', minArv: 190000, maxArv: 339000, avgArv: 252595, comps: 19, lastUpdated: 'Apr 2026' },
  { county: 'Montgomery', state: 'TN', minArv: 299999, maxArv: 379900, avgArv: 339950, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Moore', state: 'TN', minArv: 273000, maxArv: 273000, avgArv: 273000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Morgan', state: 'TN', minArv: 185000, maxArv: 265000, avgArv: 220623, comps: 8, lastUpdated: 'Apr 2026' },
  { county: 'Obion', state: 'TN', minArv: 159400, maxArv: 275000, avgArv: 217200, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Overton', state: 'TN', minArv: 158000, maxArv: 240000, avgArv: 203700, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Perry', state: 'TN', minArv: 190000, maxArv: 230000, avgArv: 210000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Putnam', state: 'TN', minArv: 227000, maxArv: 334500, avgArv: 290199, comps: 14, lastUpdated: 'Apr 2026' },
  { county: 'Rhea', state: 'TN', minArv: 190000, maxArv: 264900, avgArv: 231965, comps: 10, lastUpdated: 'Apr 2026' },
  { county: 'Roane', state: 'TN', minArv: 191000, maxArv: 370000, avgArv: 259480, comps: 33, lastUpdated: 'Apr 2026' },
  { county: 'Robertson', state: 'TN', minArv: 275000, maxArv: 329000, avgArv: 295667, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Rutherford', state: 'TN', minArv: 1075000, maxArv: 1900000, avgArv: 1318271, comps: 10, lastUpdated: 'Apr 2026' },
  { county: 'Sequatchie', state: 'TN', minArv: 230000, maxArv: 395000, avgArv: 288112, comps: 12, lastUpdated: 'Apr 2026' },
  { county: 'Sevier', state: 'TN', minArv: 224900, maxArv: 380000, avgArv: 297700, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Shelby', state: 'TN', minArv: 14990, maxArv: 14990, avgArv: 14990, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Smith', state: 'TN', minArv: 210000, maxArv: 294000, avgArv: 246380, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Stewart', state: 'TN', minArv: 205395, maxArv: 223079, avgArv: 212763, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Sullivan', state: 'TN', minArv: 189000, maxArv: 350000, avgArv: 255780, comps: 26, lastUpdated: 'Apr 2026' },
  { county: 'Sumner', state: 'TN', minArv: 192000, maxArv: 380000, avgArv: 278608, comps: 26, lastUpdated: 'Apr 2026' },
  { county: 'Tipton', state: 'TN', minArv: 40000, maxArv: 40000, avgArv: 40000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Trousdale', state: 'TN', minArv: 229000, maxArv: 349900, avgArv: 284900, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Unicoi', state: 'TN', minArv: 200000, maxArv: 205000, avgArv: 202167, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Union', state: 'TN', minArv: 172400, maxArv: 173000, avgArv: 172700, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Van Buren', state: 'TN', minArv: 200000, maxArv: 379000, avgArv: 265333, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Warren', state: 'TN', minArv: 180900, maxArv: 339900, avgArv: 249058, comps: 12, lastUpdated: 'Apr 2026' },
  { county: 'Washington', state: 'TN', minArv: 185000, maxArv: 319000, avgArv: 259338, comps: 24, lastUpdated: 'Apr 2026' },
  { county: 'Weakley', state: 'TN', minArv: 138000, maxArv: 179000, avgArv: 158500, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'White', state: 'TN', minArv: 225000, maxArv: 384999, avgArv: 273487, comps: 8, lastUpdated: 'Apr 2026' },
  { county: 'Wilson', state: 'TN', minArv: 172000, maxArv: 299900, avgArv: 253967, comps: 3, lastUpdated: 'Apr 2026' },
];

// Join ARV data with heat map county stats
const COUNTY_LOOKUP = Object.fromEntries(COUNTY_DATA.map(c => [`${c.name}|${c.state}`, c]));
const MERGED_DATA = ARV_DATA.map(row => {
  const s = COUNTY_LOOKUP[`${row.county}|${row.state}`] || {};
  return {
    ...row,
    medianDOM: s.medianDOM ?? null,
    absorptionRate: s.absorptionRate ?? null,
    monthsSupply: s.monthsSupply ?? null,
    sellThrough: s.sellThrough ?? null,
    oppScore: s.oppScore ?? null,
    demandScore: s.demandScore ?? null,
    popGrowth: s.popGrowth ?? null,
    mhFriendly: s.mhFriendly ?? null,
    medianSalePrice: s.medianSalePrice ?? null,
    medianIncome: s.medianIncome ?? null,
    unemployment: s.unemployment ?? null,
  };
});

const AVG_ARV_RANGES = [
  { label: 'All', min: 0, max: Infinity },
  { label: 'Under $100k', min: 0, max: 100000 },
  { label: '$100k – $150k', min: 100000, max: 150000 },
  { label: '$150k – $200k', min: 150000, max: 200000 },
  { label: '$200k – $250k', min: 200000, max: 250000 },
  { label: '$250k+', min: 250000, max: Infinity },
];

const STATE_OPTIONS = ['All', ...Array.from(new Set(MERGED_DATA.map(d => d.state))).sort()];

function scoreBadge(score) {
  if (score == null) return <span className="text-gray-300">—</span>;
  const cls = score >= 75 ? 'bg-green-100 text-green-700'
    : score >= 60 ? 'bg-blue-100 text-blue-700'
    : score >= 45 ? 'bg-yellow-100 text-yellow-700'
    : 'bg-red-100 text-red-700';
  return <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${cls}`}>{score}</span>;
}

function domColor(dom) {
  if (dom == null) return 'text-gray-400';
  return dom < 65 ? 'text-green-600' : dom < 130 ? 'text-yellow-600' : 'text-red-500';
}

function absColor(abs) {
  if (abs == null) return 'text-gray-400';
  return abs >= 65 ? 'text-green-600' : abs >= 50 ? 'text-yellow-600' : 'text-red-500';
}

function msColor(ms) {
  if (ms == null) return 'text-gray-400';
  return ms < 6 ? 'text-green-600' : ms < 12 ? 'text-yellow-600' : 'text-red-500';
}

function pgColor(pg) {
  if (pg == null) return 'text-gray-400';
  return pg >= 2 ? 'text-green-600' : pg >= 0 ? 'text-yellow-600' : 'text-red-500';
}

function InfoTooltip({ tip, size = 12 }) {
  const [pos, setPos] = useState(null);
  return (
    <>
      <button
        onMouseEnter={e => {
          const r = e.currentTarget.getBoundingClientRect();
          setPos({ x: r.left, y: r.bottom + 6 });
        }}
        onMouseLeave={() => setPos(null)}
        onClick={e => e.stopPropagation()}
        className="text-gray-400 hover:text-gray-600 transition-colors leading-none"
      >
        <Info size={size} />
      </button>
      {pos && (
        <div
          style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999 }}
          className="bg-gray-900 text-white text-xs rounded-xl px-3.5 py-2.5 w-60 shadow-2xl leading-relaxed pointer-events-none font-normal normal-case tracking-normal"
        >
          {tip}
        </div>
      )}
    </>
  );
}
function FilterInfo({ tip }) {
  return <InfoTooltip tip={tip} size={12} />;
}

export default function ArvDatabase() {
  const [stateFilter, setStateFilter] = useState('All');
  const [arvRange, setArvRange] = useState('All');
  const [minComps, setMinComps] = useState('5');
  const [countySearch, setCountySearch] = useState('');
  const [mhFilter, setMhFilter] = useState('All');
  const [oppScoreFilter, setOppScoreFilter] = useState('All');
  const [domFilter, setDomFilter] = useState('All');
  const [sortKey, setSortKey] = useState('county');
  const [sortDir, setSortDir] = useState('asc');

  const filtered = useMemo(() => {
    const range = AVG_ARV_RANGES.find(r => r.label === arvRange) || AVG_ARV_RANGES[0];
    const minCompsNum = minComps === 'All' ? 0 : parseInt(minComps);

    return [...MERGED_DATA]
      .filter(d => {
        if (stateFilter !== 'All' && d.state !== stateFilter) return false;
        if (d.avgArv < range.min || d.avgArv >= range.max) return false;
        if (d.comps < minCompsNum) return false;
        if (!d.county.toLowerCase().includes(countySearch.toLowerCase())) return false;
        if (mhFilter === 'Yes' && !d.mhFriendly) return false;
        if (mhFilter === 'No' && d.mhFriendly !== false) return false;
        if (oppScoreFilter !== 'All' && d.oppScore != null) {
          if (oppScoreFilter === 'Under 40' && d.oppScore >= 40) return false;
          if (oppScoreFilter === '40–59' && (d.oppScore < 40 || d.oppScore >= 60)) return false;
          if (oppScoreFilter === '60–79' && (d.oppScore < 60 || d.oppScore >= 80)) return false;
          if (oppScoreFilter === '80+' && d.oppScore < 80) return false;
        }
        if (domFilter !== 'All' && d.medianDOM != null) {
          if (domFilter === '<65d' && d.medianDOM >= 65) return false;
          if (domFilter === '65–130d' && (d.medianDOM < 65 || d.medianDOM >= 130)) return false;
          if (domFilter === '130d+' && d.medianDOM < 130) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let av = a[sortKey], bv = b[sortKey];
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === 'string') av = av.toLowerCase();
        if (typeof bv === 'string') bv = bv.toLowerCase();
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [stateFilter, arvRange, minComps, countySearch, mhFilter, oppScoreFilter, domFilter, sortKey, sortDir]);

  const totalComps = filtered.reduce((s, d) => s + d.comps, 0);
  const avgOfAvgs = filtered.length ? Math.round(filtered.reduce((s, d) => s + d.avgArv, 0) / filtered.length) : 0;

  const anyFilter = stateFilter !== 'All' || arvRange !== 'All' || minComps !== 'All' || countySearch ||
    mhFilter !== 'All' || oppScoreFilter !== 'All' || domFilter !== 'All';

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortArrow = ({ col }) => (
    <span className="ml-0.5 opacity-40 text-[10px]">
      {sortKey === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );

  const Th = ({ col, label, right, info }) => (
    <th
      onClick={() => toggleSort(col)}
      className={`py-3 px-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}
    >
      <div className={`flex items-center gap-1 ${right ? 'justify-end' : ''}`}>
        <span>{label}</span>
        <SortArrow col={col} />
        {info && <InfoTooltip tip={info} size={11} />}
      </div>
    </th>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-accent rounded-lg">
          <MapPin size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-sidebar">Market Stats</h1>
        </div>
      </div>


      {/* Filters */}
      <div className="bg-card rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* County search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search county..."
              value={countySearch}
              onChange={e => setCountySearch(e.target.value)}
              className="pl-7 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-accent w-36"
            />
          </div>

          {/* State */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 font-medium">State</label>
            <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-accent bg-white">
              {STATE_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Avg ARV range */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 font-medium">Avg ARV</label>
            <FilterInfo tip="Average After-Repair Value of MH homes sold in the county. Filter to target specific price tiers." />
            <select value={arvRange} onChange={e => setArvRange(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-accent bg-white">
              {AVG_ARV_RANGES.map(r => <option key={r.label}>{r.label}</option>)}
            </select>
          </div>

          {/* Min comps */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 font-medium">Min Comps</label>
            <select value={minComps} onChange={e => setMinComps(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-accent bg-white">
              {['All', '2', '3', '5', '10'].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>

          {/* MH Friendly */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 font-medium">MH Friendly</label>
            <select value={mhFilter} onChange={e => setMhFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-accent bg-white">
              {['All', 'Yes', 'No'].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>

          {/* Opp Score */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 font-medium">Opp Score</label>
            <FilterInfo tip="Opportunity Score (0–100) — combines absorption rate, months of supply, and population growth. Filter to focus on high-opportunity markets." />
            <select value={oppScoreFilter} onChange={e => setOppScoreFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-accent bg-white">
              {['All', 'Under 40', '40–59', '60–79', '80+'].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>

          {/* Days on Market */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 font-medium">Days on Market</label>
            <FilterInfo tip="Median days a parcel sits on the market before going under contract. Lower = faster-moving market. Filter to find active markets." />
            <select value={domFilter} onChange={e => setDomFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-accent bg-white">
              {['All', '<65d', '65–130d', '130d+'].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>

          {anyFilter && (
            <button
              onClick={() => { setStateFilter('All'); setArvRange('All'); setMinComps('All'); setCountySearch(''); setMhFilter('All'); setOppScoreFilter('All'); setDomFilter('All'); }}
              className="text-xs text-accent hover:underline ml-auto"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[1100px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <Th col="county" label="County" />
              <Th col="state" label="State" />
              <Th col="minArv" label="Min ARV" right />
              <Th col="avgArv" label="Avg ARV" right info="Average After-Repair Value of manufactured homes sold in this county. Based on recent comp data." />
              <Th col="maxArv" label="Max ARV" right />
              <Th col="comps" label="Comps" right />
              <Th col="oppScore" label="Opp" right info="Opportunity Score (0–100) — combines absorption rate, months of supply, and population growth. Higher = better market opportunity." />
              <Th col="demandScore" label="Demand" right info="Demand Score (0–100) — combines sell-through rate, days on market, and absorption rate. Higher = stronger buyer demand." />
              <Th col="medianDOM" label="DOM" right info="Days on Market — median days a parcel sits on the market before going under contract. Lower is better." />
              <Th col="absorptionRate" label="Abs %" right info="Absorption Rate — percentage of available inventory that sold in the period. Higher means a faster-moving market." />
              <Th col="monthsSupply" label="Mo. Supply" right info="Months of Supply — how long current inventory would last at the current sales pace. Under 6 months = seller's market." />
              <Th col="sellThrough" label="Sell Thru" right info="Sell-Through Rate — percentage of listed properties that actually sold. Higher means stronger buyer demand." />
              <Th col="medianSalePrice" label="Med. Sale" right info="Median sale price of parcels closed in the selected period." />
              <Th col="medianIncome" label="Med. Income" right info="Median household income for the county. Higher income areas typically support stronger land and home values." />
              <Th col="unemployment" label="Unemp." right info="Unemployment rate for the county. Lower unemployment generally correlates with stronger housing demand." />
              <Th col="popGrowth" label="Pop Grwth" right info="Annual population growth rate (%). Positive growth drives land demand; negative signals a shrinking market." />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={16} className="py-10 text-center text-sm text-gray-400">No counties match the current filters.</td>
              </tr>
            ) : filtered.map((row) => (
              <tr key={`${row.county}-${row.state}`} className="border-b border-gray-100 hover:bg-white/50 transition-colors">
                <td className="py-2.5 px-3 text-sm font-medium text-sidebar whitespace-nowrap">{row.county}</td>
                <td className="py-2.5 px-3 text-sm text-gray-600">{row.state}</td>
                <td className="py-2.5 px-3 text-sm text-right text-gray-500">${row.minArv.toLocaleString()}</td>
                <td className={`py-2.5 px-3 text-sm text-right font-semibold ${row.avgArv >= 220000 ? 'text-green-600' : 'text-accent'}`}>${row.avgArv.toLocaleString()}</td>
                <td className="py-2.5 px-3 text-sm text-right text-gray-500">${row.maxArv.toLocaleString()}</td>
                <td className="py-2.5 px-3 text-sm text-right text-gray-600">{row.comps}</td>
                <td className="py-2.5 px-3 text-right">{scoreBadge(row.oppScore)}</td>
                <td className="py-2.5 px-3 text-right">{scoreBadge(row.demandScore)}</td>
                <td className={`py-2.5 px-3 text-sm text-right font-medium ${domColor(row.medianDOM)}`}>
                  {row.medianDOM != null ? `${row.medianDOM}d` : '—'}
                </td>
                <td className={`py-2.5 px-3 text-sm text-right font-medium ${absColor(row.absorptionRate)}`}>
                  {row.absorptionRate != null ? `${row.absorptionRate}%` : '—'}
                </td>
                <td className={`py-2.5 px-3 text-sm text-right font-medium ${msColor(row.monthsSupply)}`}>
                  {row.monthsSupply != null ? row.monthsSupply.toFixed(1) : '—'}
                </td>
                <td className="py-2.5 px-3 text-sm text-right text-gray-600">
                  {row.sellThrough != null ? `${row.sellThrough.toFixed(1)}%` : '—'}
                </td>
                <td className="py-2.5 px-3 text-sm text-right text-gray-600">
                  {row.medianSalePrice != null ? `$${row.medianSalePrice.toLocaleString()}` : '—'}
                </td>
                <td className="py-2.5 px-3 text-sm text-right text-gray-600">
                  {row.medianIncome != null ? `$${row.medianIncome.toLocaleString()}` : '—'}
                </td>
                <td className="py-2.5 px-3 text-sm text-right text-gray-600">
                  {row.unemployment != null ? `${row.unemployment}%` : '—'}
                </td>
                <td className={`py-2.5 px-3 text-sm text-right font-medium ${pgColor(row.popGrowth)}`}>
                  {row.popGrowth != null ? `${row.popGrowth > 0 ? '+' : ''}${row.popGrowth}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-100">
          ARV source: Zillow sold listings · NC, SC, GA, VA &amp; TN manufactured homes built 2022–2026 · Updated April 2026 &nbsp;|&nbsp; Market stats: heat map county data
        </div>
      </div>
    </div>
  );
}
