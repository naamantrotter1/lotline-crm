import { useState, useMemo } from 'react';
import { MapPin, Search } from 'lucide-react';
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

  const Th = ({ col, label, right }) => (
    <th
      onClick={() => toggleSort(col)}
      className={`py-3 px-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}
    >
      {label}<SortArrow col={col} />
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
          <h1 className="text-2xl font-bold text-sidebar">ARV Database</h1>
          <p className="text-sm text-gray-500">NC, SC &amp; GA manufactured home sold comps — Zillow (built 2022–2026)</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Counties Shown', value: filtered.length },
          { label: 'Total Comps', value: totalComps.toLocaleString() },
          { label: 'Avg ARV (Filtered)', value: `$${avgOfAvgs.toLocaleString()}` },
          { label: 'States', value: Array.from(new Set(filtered.map(d => d.state))).join(', ') || '—' },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-sidebar">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
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
            <select value={oppScoreFilter} onChange={e => setOppScoreFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-accent bg-white">
              {['All', 'Under 40', '40–59', '60–79', '80+'].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>

          {/* Days on Market */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 font-medium">Days on Market</label>
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
              <Th col="avgArv" label="Avg ARV" right />
              <Th col="maxArv" label="Max ARV" right />
              <Th col="comps" label="Comps" right />
              <Th col="oppScore" label="Opp" right />
              <Th col="demandScore" label="Demand" right />
              <Th col="medianDOM" label="DOM" right />
              <Th col="absorptionRate" label="Abs %" right />
              <Th col="monthsSupply" label="Mo. Supply" right />
              <Th col="popGrowth" label="Pop Grwth" right />
              <Th col="mhFriendly" label="MH ✓" right />
              <Th col="lastUpdated" label="Updated" right />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={14} className="py-10 text-center text-sm text-gray-400">No counties match the current filters.</td>
              </tr>
            ) : filtered.map((row) => (
              <tr key={`${row.county}-${row.state}`} className="border-b border-gray-100 hover:bg-white/50 transition-colors">
                <td className="py-2.5 px-3 text-sm font-medium text-sidebar whitespace-nowrap">{row.county}</td>
                <td className="py-2.5 px-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${row.state === 'NC' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                    {row.state}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-sm text-right text-gray-500">${row.minArv.toLocaleString()}</td>
                <td className="py-2.5 px-3 text-sm text-right font-semibold text-accent">${row.avgArv.toLocaleString()}</td>
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
                <td className={`py-2.5 px-3 text-sm text-right font-medium ${pgColor(row.popGrowth)}`}>
                  {row.popGrowth != null ? `${row.popGrowth > 0 ? '+' : ''}${row.popGrowth}%` : '—'}
                </td>
                <td className="py-2.5 px-3 text-sm text-right">
                  {row.mhFriendly === true ? <span className="text-green-600 font-bold">✓</span>
                    : row.mhFriendly === false ? <span className="text-red-400">✗</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="py-2.5 px-3 text-sm text-right text-gray-400 whitespace-nowrap">{row.lastUpdated}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-100">
          ARV source: Zillow sold listings · NC, SC &amp; GA manufactured homes built 2022–2026 · Updated April 2026 &nbsp;|&nbsp; Market stats: heat map county data
        </div>
      </div>
    </div>
  );
}
