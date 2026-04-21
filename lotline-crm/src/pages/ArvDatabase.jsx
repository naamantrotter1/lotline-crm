import { useState, useMemo } from 'react';
import { MapPin, Search, Info } from 'lucide-react';
import { MARKET_COUNTY_DATA as COUNTY_DATA } from '../data/counties.js';

const ARV_DATA = [
  // Florida (33 counties)
  { county: 'Baker', state: 'FL', minArv: 139500, maxArv: 383000, avgArv: 268146, comps: 12, lastUpdated: 'Apr 2026' },
  { county: 'Bay', state: 'FL', minArv: 115000, maxArv: 333333, avgArv: 203003, comps: 51, lastUpdated: 'Apr 2026' },
  { county: 'Bradford', state: 'FL', minArv: 185400, maxArv: 320000, avgArv: 253545, comps: 20, lastUpdated: 'Apr 2026' },
  { county: 'Brevard', state: 'FL', minArv: 115000, maxArv: 312000, avgArv: 222560, comps: 30, lastUpdated: 'Apr 2026' },
  { county: 'Calhoun', state: 'FL', minArv: 100000, maxArv: 259000, avgArv: 187667, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Citrus', state: 'FL', minArv: 130000, maxArv: 335000, avgArv: 226817, comps: 72, lastUpdated: 'Apr 2026' },
  { county: 'Clay', state: 'FL', minArv: 190000, maxArv: 355000, avgArv: 262062, comps: 73, lastUpdated: 'Apr 2026' },
  { county: 'Collier', state: 'FL', minArv: 180000, maxArv: 415000, avgArv: 280857, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Columbia', state: 'FL', minArv: 110000, maxArv: 350000, avgArv: 228978, comps: 44, lastUpdated: 'Apr 2026' },
  { county: 'Escambia', state: 'FL', minArv: 150000, maxArv: 220900, avgArv: 175800, comps: 10, lastUpdated: 'Apr 2026' },
  { county: 'Gilchrist', state: 'FL', minArv: 179000, maxArv: 280000, avgArv: 210336, comps: 9, lastUpdated: 'Apr 2026' },
  { county: 'Hendry', state: 'FL', minArv: 155000, maxArv: 345000, avgArv: 239747, comps: 17, lastUpdated: 'Apr 2026' },
  { county: 'Hernando', state: 'FL', minArv: 115000, maxArv: 390000, avgArv: 241900, comps: 10, lastUpdated: 'Apr 2026' },
  { county: 'Highlands', state: 'FL', minArv: 110000, maxArv: 260000, avgArv: 183270, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Holmes', state: 'FL', minArv: 127500, maxArv: 499900, avgArv: 249240, comps: 10, lastUpdated: 'Apr 2026' },
  { county: 'Jackson', state: 'FL', minArv: 116000, maxArv: 247900, avgArv: 186531, comps: 26, lastUpdated: 'Apr 2026' },
  { county: 'Lee', state: 'FL', minArv: 100000, maxArv: 460000, avgArv: 303090, comps: 22, lastUpdated: 'Apr 2026' },
  { county: 'Leon', state: 'FL', minArv: 129000, maxArv: 325000, avgArv: 212850, comps: 16, lastUpdated: 'Apr 2026' },
  { county: 'Levy', state: 'FL', minArv: 157000, maxArv: 291000, avgArv: 222316, comps: 18, lastUpdated: 'Apr 2026' },
  { county: 'Marion', state: 'FL', minArv: 180000, maxArv: 289999, avgArv: 227425, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Martin', state: 'FL', minArv: 85000, maxArv: 360000, avgArv: 254900, comps: 8, lastUpdated: 'Apr 2026' },
  { county: 'Nassau', state: 'FL', minArv: 202000, maxArv: 350000, avgArv: 286505, comps: 39, lastUpdated: 'Apr 2026' },
  { county: 'Okaloosa', state: 'FL', minArv: 130000, maxArv: 407000, avgArv: 228508, comps: 24, lastUpdated: 'Apr 2026' },
  { county: 'Okeechobee', state: 'FL', minArv: 208000, maxArv: 309000, avgArv: 252050, comps: 23, lastUpdated: 'Apr 2026' },
  { county: 'Palm Beach', state: 'FL', minArv: 108500, maxArv: 325000, avgArv: 222929, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Putnam', state: 'FL', minArv: 144900, maxArv: 280000, avgArv: 203827, comps: 75, lastUpdated: 'Apr 2026' },
  { county: 'Santa Rosa', state: 'FL', minArv: 154000, maxArv: 270000, avgArv: 210167, comps: 27, lastUpdated: 'Apr 2026' },
  { county: 'St. Johns', state: 'FL', minArv: 179000, maxArv: 343500, avgArv: 249315, comps: 50, lastUpdated: 'Apr 2026' },
  { county: 'St. Lucie', state: 'FL', minArv: 128000, maxArv: 284995, avgArv: 230575, comps: 13, lastUpdated: 'Apr 2026' },
  { county: 'Suwannee', state: 'FL', minArv: 150000, maxArv: 330000, avgArv: 244537, comps: 61, lastUpdated: 'Apr 2026' },
  { county: 'Taylor', state: 'FL', minArv: 118000, maxArv: 259000, avgArv: 192889, comps: 9, lastUpdated: 'Apr 2026' },
  { county: 'Walton', state: 'FL', minArv: 119900, maxArv: 259900, avgArv: 183571, comps: 83, lastUpdated: 'Apr 2026' },
  { county: 'Washington', state: 'FL', minArv: 122000, maxArv: 359900, avgArv: 200172, comps: 11, lastUpdated: 'Apr 2026' },
  // North Carolina (50 counties)
  { county: 'Alamance', state: 'NC', minArv: 220900, maxArv: 265000, avgArv: 239320, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Alexander', state: 'NC', minArv: 205000, maxArv: 226000, avgArv: 218162, comps: 8, lastUpdated: 'Apr 2026' },
  { county: 'Beaufort', state: 'NC', minArv: 170000, maxArv: 250000, avgArv: 203633, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Bladen', state: 'NC', minArv: 169000, maxArv: 195597, avgArv: 178199, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Brunswick', state: 'NC', minArv: 150000, maxArv: 300000, avgArv: 217475, comps: 92, lastUpdated: 'Apr 2026' },
  { county: 'Carteret', state: 'NC', minArv: 179900, maxArv: 333000, avgArv: 246862, comps: 16, lastUpdated: 'Apr 2026' },
  { county: 'Caswell', state: 'NC', minArv: 195000, maxArv: 265000, avgArv: 224636, comps: 14, lastUpdated: 'Apr 2026' },
  { county: 'Cherokee', state: 'NC', minArv: 156000, maxArv: 215063, avgArv: 192688, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Chowan', state: 'NC', minArv: 210000, maxArv: 260000, avgArv: 236667, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Clay', state: 'NC', minArv: 214900, maxArv: 229900, avgArv: 222417, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Columbus', state: 'NC', minArv: 170000, maxArv: 231000, avgArv: 208700, comps: 10, lastUpdated: 'Apr 2026' },
  { county: 'Cumberland', state: 'NC', minArv: 161500, maxArv: 209900, avgArv: 181395, comps: 21, lastUpdated: 'Apr 2026' },
  { county: 'Davidson', state: 'NC', minArv: 195000, maxArv: 273145, avgArv: 230297, comps: 16, lastUpdated: 'Apr 2026' },
  { county: 'Duplin', state: 'NC', minArv: 192500, maxArv: 260000, avgArv: 223730, comps: 20, lastUpdated: 'Apr 2026' },
  { county: 'Edgecombe', state: 'NC', minArv: 139900, maxArv: 234000, avgArv: 198056, comps: 9, lastUpdated: 'Apr 2026' },
  { county: 'Franklin', state: 'NC', minArv: 205000, maxArv: 302747, avgArv: 257672, comps: 18, lastUpdated: 'Apr 2026' },
  { county: 'Granville', state: 'NC', minArv: 219000, maxArv: 306000, avgArv: 252166, comps: 15, lastUpdated: 'Apr 2026' },
  { county: 'Guilford', state: 'NC', minArv: 145000, maxArv: 322000, avgArv: 237333, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Halifax', state: 'NC', minArv: 135000, maxArv: 233580, avgArv: 182860, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Harnett', state: 'NC', minArv: 182500, maxArv: 308300, avgArv: 248542, comps: 31, lastUpdated: 'Apr 2026' },
  { county: 'Haywood', state: 'NC', minArv: 440000, maxArv: 465000, avgArv: 448333, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Hertford', state: 'NC', minArv: 184900, maxArv: 236500, avgArv: 213080, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Hoke', state: 'NC', minArv: 209900, maxArv: 275000, avgArv: 234967, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Johnston', state: 'NC', minArv: 215000, maxArv: 296000, avgArv: 255428, comps: 25, lastUpdated: 'Apr 2026' },
  { county: 'Lee', state: 'NC', minArv: 215000, maxArv: 300000, avgArv: 263975, comps: 8, lastUpdated: 'Apr 2026' },
  { county: 'Macon', state: 'NC', minArv: 158000, maxArv: 250000, avgArv: 204346, comps: 13, lastUpdated: 'Apr 2026' },
  { county: 'Martin', state: 'NC', minArv: 139000, maxArv: 197000, avgArv: 175300, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Moore', state: 'NC', minArv: 245000, maxArv: 275000, avgArv: 257333, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Nash', state: 'NC', minArv: 219900, maxArv: 321000, avgArv: 250710, comps: 26, lastUpdated: 'Apr 2026' },
  { county: 'New Hanover', state: 'NC', minArv: 278500, maxArv: 349900, avgArv: 302075, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Northampton', state: 'NC', minArv: 100000, maxArv: 355000, avgArv: 185333, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Onslow', state: 'NC', minArv: 153000, maxArv: 324000, avgArv: 235907, comps: 30, lastUpdated: 'Apr 2026' },
  { county: 'Pasquotank', state: 'NC', minArv: 200000, maxArv: 273500, avgArv: 243125, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Pender', state: 'NC', minArv: 220000, maxArv: 330000, avgArv: 269358, comps: 24, lastUpdated: 'Apr 2026' },
  { county: 'Perquimans', state: 'NC', minArv: 245000, maxArv: 250000, avgArv: 248300, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Person', state: 'NC', minArv: 199900, maxArv: 385000, avgArv: 264475, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Randolph', state: 'NC', minArv: 197000, maxArv: 253000, avgArv: 227000, comps: 35, lastUpdated: 'Apr 2026' },
  { county: 'Richmond', state: 'NC', minArv: 118000, maxArv: 208000, avgArv: 161429, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Robeson', state: 'NC', minArv: 144900, maxArv: 240000, avgArv: 193125, comps: 43, lastUpdated: 'Apr 2026' },
  { county: 'Rockingham', state: 'NC', minArv: 125000, maxArv: 310000, avgArv: 236556, comps: 9, lastUpdated: 'Apr 2026' },
  { county: 'Sampson', state: 'NC', minArv: 180000, maxArv: 225000, avgArv: 202136, comps: 18, lastUpdated: 'Apr 2026' },
  { county: 'Scotland', state: 'NC', minArv: 122000, maxArv: 255000, avgArv: 169750, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Stokes', state: 'NC', minArv: 104900, maxArv: 229999, avgArv: 164022, comps: 9, lastUpdated: 'Apr 2026' },
  { county: 'Surry', state: 'NC', minArv: 179900, maxArv: 244900, avgArv: 210780, comps: 10, lastUpdated: 'Apr 2026' },
  { county: 'Vance', state: 'NC', minArv: 207000, maxArv: 308425, avgArv: 255134, comps: 8, lastUpdated: 'Apr 2026' },
  { county: 'Warren', state: 'NC', minArv: 181000, maxArv: 310000, avgArv: 230988, comps: 8, lastUpdated: 'Apr 2026' },
  { county: 'Wayne', state: 'NC', minArv: 194900, maxArv: 290000, avgArv: 225817, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Wilkes', state: 'NC', minArv: 215500, maxArv: 227000, avgArv: 223960, comps: 15, lastUpdated: 'Apr 2026' },
  { county: 'Wilson', state: 'NC', minArv: 225000, maxArv: 239900, avgArv: 233267, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Yadkin', state: 'NC', minArv: 201000, maxArv: 285000, avgArv: 239000, comps: 7, lastUpdated: 'Apr 2026' },
  // South Carolina (30 counties)
  { county: 'Abbeville', state: 'SC', minArv: 170000, maxArv: 361000, avgArv: 261580, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Aiken', state: 'SC', minArv: 99000, maxArv: 395000, avgArv: 222280, comps: 40, lastUpdated: 'Apr 2026' },
  { county: 'Anderson', state: 'SC', minArv: 167500, maxArv: 259000, avgArv: 210862, comps: 28, lastUpdated: 'Apr 2026' },
  { county: 'Barnwell', state: 'SC', minArv: 152500, maxArv: 389900, avgArv: 233340, comps: 10, lastUpdated: 'Apr 2026' },
  { county: 'Beaufort', state: 'SC', minArv: 203000, maxArv: 399000, avgArv: 296913, comps: 19, lastUpdated: 'Apr 2026' },
  { county: 'Berkeley', state: 'SC', minArv: 185000, maxArv: 369000, avgArv: 275781, comps: 169, lastUpdated: 'Apr 2026' },
  { county: 'Calhoun', state: 'SC', minArv: 180000, maxArv: 292000, avgArv: 250733, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Charleston', state: 'SC', minArv: 240000, maxArv: 345000, avgArv: 295000, comps: 8, lastUpdated: 'Apr 2026' },
  { county: 'Cherokee', state: 'SC', minArv: 130000, maxArv: 299900, avgArv: 219400, comps: 9, lastUpdated: 'Apr 2026' },
  { county: 'Clarendon', state: 'SC', minArv: 95000, maxArv: 310000, avgArv: 228889, comps: 9, lastUpdated: 'Apr 2026' },
  { county: 'Colleton', state: 'SC', minArv: 155000, maxArv: 352000, avgArv: 259571, comps: 45, lastUpdated: 'Apr 2026' },
  { county: 'Darlington', state: 'SC', minArv: 135000, maxArv: 295000, avgArv: 197450, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Dillon', state: 'SC', minArv: 127500, maxArv: 226900, avgArv: 184230, comps: 10, lastUpdated: 'Apr 2026' },
  { county: 'Dorchester', state: 'SC', minArv: 170000, maxArv: 357000, avgArv: 272001, comps: 54, lastUpdated: 'Apr 2026' },
  { county: 'Florence', state: 'SC', minArv: 195000, maxArv: 259900, avgArv: 229257, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Georgetown', state: 'SC', minArv: 87500, maxArv: 293500, avgArv: 165921, comps: 14, lastUpdated: 'Apr 2026' },
  { county: 'Greenville', state: 'SC', minArv: 80000, maxArv: 239900, avgArv: 182050, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Greenwood', state: 'SC', minArv: 180000, maxArv: 305000, avgArv: 217564, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Hampton', state: 'SC', minArv: 175000, maxArv: 255000, avgArv: 208112, comps: 8, lastUpdated: 'Apr 2026' },
  { county: 'Horry', state: 'SC', minArv: 79000, maxArv: 395000, avgArv: 200300, comps: 265, lastUpdated: 'Apr 2026' },
  { county: 'Jasper', state: 'SC', minArv: 185000, maxArv: 350000, avgArv: 282917, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Laurens', state: 'SC', minArv: 137900, maxArv: 251000, avgArv: 208180, comps: 10, lastUpdated: 'Apr 2026' },
  { county: 'Lexington', state: 'SC', minArv: 140000, maxArv: 282900, avgArv: 223725, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Marion', state: 'SC', minArv: 190000, maxArv: 265000, avgArv: 232960, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Oconee', state: 'SC', minArv: 177000, maxArv: 309000, avgArv: 232267, comps: 15, lastUpdated: 'Apr 2026' },
  { county: 'Orangeburg', state: 'SC', minArv: 150000, maxArv: 311550, avgArv: 235918, comps: 46, lastUpdated: 'Apr 2026' },
  { county: 'Pickens', state: 'SC', minArv: 179900, maxArv: 241070, avgArv: 214011, comps: 20, lastUpdated: 'Apr 2026' },
  { county: 'Spartanburg', state: 'SC', minArv: 195500, maxArv: 308000, avgArv: 234960, comps: 25, lastUpdated: 'Apr 2026' },
  { county: 'Sumter', state: 'SC', minArv: 153500, maxArv: 174000, avgArv: 165914, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Williamsburg', state: 'SC', minArv: 185000, maxArv: 333275, avgArv: 255092, comps: 3, lastUpdated: 'Apr 2026' },
  // Georgia (24 counties)
  { county: 'Berrien', state: 'GA', minArv: 112800, maxArv: 245000, avgArv: 190300, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Brantley', state: 'GA', minArv: 174000, maxArv: 280000, avgArv: 214200, comps: 13, lastUpdated: 'Apr 2026' },
  { county: 'Bryan', state: 'GA', minArv: 209993, maxArv: 340000, avgArv: 272099, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Burke', state: 'GA', minArv: 175000, maxArv: 302000, avgArv: 255380, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Camden', state: 'GA', minArv: 190000, maxArv: 243500, avgArv: 213833, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Decatur', state: 'GA', minArv: 178500, maxArv: 212000, avgArv: 188875, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Effingham', state: 'GA', minArv: 219500, maxArv: 343000, avgArv: 272399, comps: 16, lastUpdated: 'Apr 2026' },
  { county: 'Evans', state: 'GA', minArv: 199900, maxArv: 240000, avgArv: 218633, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Franklin', state: 'GA', minArv: 225000, maxArv: 248000, avgArv: 239667, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Habersham', state: 'GA', minArv: 269500, maxArv: 300000, avgArv: 282375, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Lanier', state: 'GA', minArv: 159000, maxArv: 191000, avgArv: 167475, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Liberty', state: 'GA', minArv: 161000, maxArv: 290000, avgArv: 237276, comps: 77, lastUpdated: 'Apr 2026' },
  { county: 'Long', state: 'GA', minArv: 199000, maxArv: 300000, avgArv: 243074, comps: 57, lastUpdated: 'Apr 2026' },
  { county: 'Lowndes', state: 'GA', minArv: 165000, maxArv: 205900, avgArv: 189680, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Madison', state: 'GA', minArv: 215000, maxArv: 358000, avgArv: 283200, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'McIntosh', state: 'GA', minArv: 185000, maxArv: 229000, avgArv: 205044, comps: 8, lastUpdated: 'Apr 2026' },
  { county: 'Murray', state: 'GA', minArv: 192000, maxArv: 254000, avgArv: 216360, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Oglethorpe', state: 'GA', minArv: 251000, maxArv: 269900, avgArv: 260233, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Pierce', state: 'GA', minArv: 185000, maxArv: 235000, avgArv: 203788, comps: 8, lastUpdated: 'Apr 2026' },
  { county: 'Richmond', state: 'GA', minArv: 140000, maxArv: 249900, avgArv: 215191, comps: 11, lastUpdated: 'Apr 2026' },
  { county: 'Screven', state: 'GA', minArv: 225000, maxArv: 315000, avgArv: 263000, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Tattnall', state: 'GA', minArv: 154900, maxArv: 201000, avgArv: 177100, comps: 8, lastUpdated: 'Apr 2026' },
  { county: 'Ware', state: 'GA', minArv: 115000, maxArv: 238000, avgArv: 174414, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Wayne', state: 'GA', minArv: 149900, maxArv: 249900, avgArv: 199647, comps: 41, lastUpdated: 'Apr 2026' },
  // Virginia (8 counties)
  { county: 'Bedford', state: 'VA', minArv: 200000, maxArv: 337000, avgArv: 265609, comps: 22, lastUpdated: 'Apr 2026' },
  { county: 'Carroll', state: 'VA', minArv: 125000, maxArv: 249000, avgArv: 209508, comps: 9, lastUpdated: 'Apr 2026' },
  { county: 'Franklin', state: 'VA', minArv: 200000, maxArv: 329900, avgArv: 256300, comps: 8, lastUpdated: 'Apr 2026' },
  { county: 'Mecklenburg', state: 'VA', minArv: 229000, maxArv: 325000, avgArv: 276738, comps: 8, lastUpdated: 'Apr 2026' },
  { county: 'Pulaski', state: 'VA', minArv: 140000, maxArv: 250000, avgArv: 180000, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Smyth', state: 'VA', minArv: 200000, maxArv: 225000, avgArv: 215000, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Washington', state: 'VA', minArv: 180000, maxArv: 280000, avgArv: 242800, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Wythe', state: 'VA', minArv: 299000, maxArv: 388000, avgArv: 336767, comps: 3, lastUpdated: 'Apr 2026' },
  // Tennessee (34 counties)
  { county: 'Anderson', state: 'TN', minArv: 165000, maxArv: 300000, avgArv: 241244, comps: 12, lastUpdated: 'Apr 2026' },
  { county: 'Blount', state: 'TN', minArv: 200000, maxArv: 312000, avgArv: 259250, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Campbell', state: 'TN', minArv: 195000, maxArv: 254900, avgArv: 224275, comps: 12, lastUpdated: 'Apr 2026' },
  { county: 'Claiborne', state: 'TN', minArv: 165000, maxArv: 294000, avgArv: 234173, comps: 15, lastUpdated: 'Apr 2026' },
  { county: 'Cocke', state: 'TN', minArv: 185000, maxArv: 290000, avgArv: 244347, comps: 17, lastUpdated: 'Apr 2026' },
  { county: 'Cumberland', state: 'TN', minArv: 169000, maxArv: 260000, avgArv: 207417, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Gibson', state: 'TN', minArv: 215000, maxArv: 337000, avgArv: 250375, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Grainger', state: 'TN', minArv: 199500, maxArv: 405400, avgArv: 271930, comps: 23, lastUpdated: 'Apr 2026' },
  { county: 'Greene', state: 'TN', minArv: 239900, maxArv: 281500, avgArv: 260567, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Hamblen', state: 'TN', minArv: 189900, maxArv: 342500, avgArv: 247131, comps: 30, lastUpdated: 'Apr 2026' },
  { county: 'Hamilton', state: 'TN', minArv: 220000, maxArv: 397500, avgArv: 338333, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Hawkins', state: 'TN', minArv: 150000, maxArv: 345000, avgArv: 249200, comps: 15, lastUpdated: 'Apr 2026' },
  { county: 'Henderson', state: 'TN', minArv: 173796, maxArv: 219900, avgArv: 189565, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Henry', state: 'TN', minArv: 158000, maxArv: 300000, avgArv: 216000, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Jefferson', state: 'TN', minArv: 200000, maxArv: 349900, avgArv: 282440, comps: 49, lastUpdated: 'Apr 2026' },
  { county: 'Knox', state: 'TN', minArv: 210000, maxArv: 310000, avgArv: 264459, comps: 23, lastUpdated: 'Apr 2026' },
  { county: 'Loudon', state: 'TN', minArv: 183500, maxArv: 329000, avgArv: 255652, comps: 19, lastUpdated: 'Apr 2026' },
  { county: 'McMinn', state: 'TN', minArv: 196000, maxArv: 297500, avgArv: 238146, comps: 45, lastUpdated: 'Apr 2026' },
  { county: 'McNairy', state: 'TN', minArv: 119900, maxArv: 350000, avgArv: 191483, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Meigs', state: 'TN', minArv: 254990, maxArv: 258500, avgArv: 256497, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Monroe', state: 'TN', minArv: 212500, maxArv: 309900, avgArv: 262175, comps: 50, lastUpdated: 'Apr 2026' },
  { county: 'Morgan', state: 'TN', minArv: 195000, maxArv: 342500, avgArv: 257067, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Overton', state: 'TN', minArv: 138000, maxArv: 300000, avgArv: 209571, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Polk', state: 'TN', minArv: 218000, maxArv: 295000, avgArv: 264333, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Rhea', state: 'TN', minArv: 205000, maxArv: 255000, avgArv: 226667, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Roane', state: 'TN', minArv: 169900, maxArv: 309900, avgArv: 239126, comps: 35, lastUpdated: 'Apr 2026' },
  { county: 'Sevier', state: 'TN', minArv: 245000, maxArv: 344900, avgArv: 296792, comps: 12, lastUpdated: 'Apr 2026' },
  { county: 'Shelby', state: 'TN', minArv: 134900, maxArv: 200000, avgArv: 153626, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Stewart', state: 'TN', minArv: 205395, maxArv: 223079, avgArv: 210307, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Tipton', state: 'TN', minArv: 230000, maxArv: 260000, avgArv: 242667, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Union', state: 'TN', minArv: 193000, maxArv: 199500, avgArv: 195833, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Van Buren', state: 'TN', minArv: 135500, maxArv: 469000, avgArv: 268167, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Weakley', state: 'TN', minArv: 138000, maxArv: 325000, avgArv: 210967, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'White', state: 'TN', minArv: 151000, maxArv: 349900, avgArv: 254612, comps: 8, lastUpdated: 'Apr 2026' },
  // Alabama (30 counties)
  { county: 'Baldwin', state: 'AL', minArv: 150000, maxArv: 330000, avgArv: 231204, comps: 25, lastUpdated: 'Apr 2026' },
  { county: 'Bibb', state: 'AL', minArv: 284900, maxArv: 304900, avgArv: 296267, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Blount', state: 'AL', minArv: 142400, maxArv: 235000, avgArv: 191162, comps: 8, lastUpdated: 'Apr 2026' },
  { county: 'Calhoun', state: 'AL', minArv: 121000, maxArv: 299900, avgArv: 190349, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Cherokee', state: 'AL', minArv: 126404, maxArv: 462500, avgArv: 262635, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Chilton', state: 'AL', minArv: 80000, maxArv: 349000, avgArv: 218711, comps: 9, lastUpdated: 'Apr 2026' },
  { county: 'Cleburne', state: 'AL', minArv: 115000, maxArv: 341000, avgArv: 248111, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Coffee', state: 'AL', minArv: 97000, maxArv: 225000, avgArv: 151125, comps: 8, lastUpdated: 'Apr 2026' },
  { county: 'Colbert', state: 'AL', minArv: 105000, maxArv: 250000, avgArv: 200000, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Covington', state: 'AL', minArv: 112000, maxArv: 175000, avgArv: 141100, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Cullman', state: 'AL', minArv: 110000, maxArv: 196000, avgArv: 142100, comps: 8, lastUpdated: 'Apr 2026' },
  { county: 'DeKalb', state: 'AL', minArv: 159900, maxArv: 219900, avgArv: 179435, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Elmore', state: 'AL', minArv: 99381, maxArv: 235000, avgArv: 181897, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Etowah', state: 'AL', minArv: 109900, maxArv: 239500, avgArv: 160300, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Geneva', state: 'AL', minArv: 75000, maxArv: 154000, avgArv: 122225, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Houston', state: 'AL', minArv: 138000, maxArv: 167500, avgArv: 156167, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Jackson', state: 'AL', minArv: 166000, maxArv: 392500, avgArv: 268500, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Jefferson', state: 'AL', minArv: 188000, maxArv: 300000, avgArv: 262633, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Lauderdale', state: 'AL', minArv: 149000, maxArv: 269000, avgArv: 221046, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Lee', state: 'AL', minArv: 154000, maxArv: 273000, avgArv: 229055, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Limestone', state: 'AL', minArv: 169000, maxArv: 240000, avgArv: 192667, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Mobile', state: 'AL', minArv: 139000, maxArv: 184900, avgArv: 164180, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Morgan', state: 'AL', minArv: 225000, maxArv: 255000, avgArv: 236667, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Shelby', state: 'AL', minArv: 153000, maxArv: 220000, avgArv: 184192, comps: 12, lastUpdated: 'Apr 2026' },
  { county: 'St. Clair', state: 'AL', minArv: 199000, maxArv: 245000, avgArv: 219878, comps: 9, lastUpdated: 'Apr 2026' },
  { county: 'Talladega', state: 'AL', minArv: 181000, maxArv: 200000, avgArv: 192333, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Tallapoosa', state: 'AL', minArv: 80000, maxArv: 375000, avgArv: 195829, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Tuscaloosa', state: 'AL', minArv: 127500, maxArv: 232500, avgArv: 158154, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Walker', state: 'AL', minArv: 126000, maxArv: 210000, avgArv: 160925, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Winston', state: 'AL', minArv: 165000, maxArv: 359900, avgArv: 259225, comps: 4, lastUpdated: 'Apr 2026' },
  // Kentucky (11 counties)
  { county: 'Adair', state: 'KY', minArv: 170000, maxArv: 345000, avgArv: 229667, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Barren', state: 'KY', minArv: 177000, maxArv: 249900, avgArv: 205475, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Breckinridge', state: 'KY', minArv: 119900, maxArv: 234750, avgArv: 180912, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Calloway', state: 'KY', minArv: 86000, maxArv: 250000, avgArv: 190333, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Daviess', state: 'KY', minArv: 220000, maxArv: 230000, avgArv: 226633, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Edmonson', state: 'KY', minArv: 155000, maxArv: 230000, avgArv: 200225, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Hardin', state: 'KY', minArv: 175000, maxArv: 251500, avgArv: 205479, comps: 14, lastUpdated: 'Apr 2026' },
  { county: 'Meade', state: 'KY', minArv: 195000, maxArv: 239990, avgArv: 206584, comps: 13, lastUpdated: 'Apr 2026' },
  { county: 'Taylor', state: 'KY', minArv: 129000, maxArv: 215000, avgArv: 176365, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Warren', state: 'KY', minArv: 239000, maxArv: 449900, avgArv: 329200, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Webster', state: 'KY', minArv: 103000, maxArv: 240000, avgArv: 170667, comps: 3, lastUpdated: 'Apr 2026' },
];

// Join ARV data with heat map county stats
const COUNTY_LOOKUP = Object.fromEntries(COUNTY_DATA.map(c => [`${c.name}|${c.state}`, c]));
const flArvCounties = new Set(ARV_DATA.filter(r => r.state === 'FL').map(r => r.county));
const MERGED_DATA = [
  ...ARV_DATA.map(row => {
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
  }),
  // FL counties not covered by ARV comps — heat map stats only
  ...COUNTY_DATA.filter(c => c.state === 'FL' && !flArvCounties.has(c.name)).map(c => ({
    county: c.name,
    state: c.state,
    minArv: null,
    maxArv: null,
    avgArv: null,
    comps: 0,
    lastUpdated: 'Apr 2026',
    medianDOM: c.medianDOM,
    absorptionRate: c.absorptionRate,
    monthsSupply: c.monthsSupply,
    sellThrough: c.sellThrough,
    oppScore: c.oppScore,
    demandScore: c.demandScore,
    popGrowth: c.popGrowth,
    mhFriendly: c.mhFriendly,
    medianSalePrice: c.medianSalePrice,
    medianIncome: c.medianIncome,
    unemployment: c.unemployment,
  })),
];

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
          className="bg-gray-900 text-white text-xs rounded-xl px-3.5 py-2.5 w-60 shadow-2xl leading-relaxed pointer-events-none font-normal normal-case tracking-normal whitespace-normal"
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
  const [minArvInput, setMinArvInput] = useState('');
  const [maxArvInput, setMaxArvInput] = useState('');

  const formatMoneyInput = (raw) => {
    const digits = raw.replace(/[^0-9]/g, '');
    if (!digits) return '';
    return '$' + Number(digits).toLocaleString();
  };
  const [minComps, setMinComps] = useState('All');
  const [countySearch, setCountySearch] = useState('');
  const [mhFilter, setMhFilter] = useState('All');
  const [oppScoreFilter, setOppScoreFilter] = useState('All');
  const [domFilter, setDomFilter] = useState('All');
  const [sortKey, setSortKey] = useState('county');
  const [sortDir, setSortDir] = useState('asc');

  const filtered = useMemo(() => {
    const minArvNum = minArvInput ? parseFloat(minArvInput.replace(/[^0-9.]/g, '')) : null;
    const maxArvNum = maxArvInput ? parseFloat(maxArvInput.replace(/[^0-9.]/g, '')) : null;
    const minCompsNum = minComps === 'All' ? 0 : parseInt(minComps);

    return [...MERGED_DATA]
      .filter(d => {
        if (stateFilter !== 'All' && d.state !== stateFilter) return false;
        if (minArvNum != null && d.avgArv != null && d.avgArv < minArvNum) return false;
        if (maxArvNum != null && d.avgArv != null && d.avgArv > maxArvNum) return false;
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
  }, [stateFilter, minArvInput, maxArvInput, minComps, countySearch, mhFilter, oppScoreFilter, domFilter, sortKey, sortDir]);

  const totalComps = filtered.reduce((s, d) => s + d.comps, 0);
  const rowsWithArv = filtered.filter(d => d.avgArv != null);
  const avgOfAvgs = rowsWithArv.length ? Math.round(rowsWithArv.reduce((s, d) => s + d.avgArv, 0) / rowsWithArv.length) : 0;

  const anyFilter = stateFilter !== 'All' || minArvInput || maxArvInput || minComps !== 'All' || countySearch ||
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
            <input
              value={minArvInput}
              onChange={e => setMinArvInput(formatMoneyInput(e.target.value))}
              placeholder="$0"
              className="w-28 text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-accent bg-white"
            />
            <span className="text-xs text-gray-400">–</span>
            <input
              value={maxArvInput}
              onChange={e => setMaxArvInput(formatMoneyInput(e.target.value))}
              placeholder="$999,999"
              className="w-28 text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-accent bg-white"
            />
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
              onClick={() => { setStateFilter('All'); setMinArvInput(''); setMaxArvInput(''); setMinComps('All'); setCountySearch(''); setMhFilter('All'); setOppScoreFilter('All'); setDomFilter('All'); }}
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
                <td className="py-2.5 px-3 text-sm text-right text-gray-500">{row.minArv != null ? `$${row.minArv.toLocaleString()}` : '—'}</td>
                <td className={`py-2.5 px-3 text-sm text-right font-semibold ${row.avgArv == null ? 'text-gray-300' : row.avgArv >= 220000 ? 'text-green-600' : 'text-accent'}`}>{row.avgArv != null ? `$${row.avgArv.toLocaleString()}` : '—'}</td>
                <td className="py-2.5 px-3 text-sm text-right text-gray-500">{row.maxArv != null ? `$${row.maxArv.toLocaleString()}` : '—'}</td>
                <td className="py-2.5 px-3 text-sm text-right text-gray-600">{row.comps > 0 ? row.comps : '—'}</td>
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
          ARV source: Zillow sold listings · NC &amp; SC manufactured homes built 2022–2026 · Updated April 2026 &nbsp;|&nbsp; FL market stats: FL DOR / Census ACS / BLS 2024 (ARV comps pending) &nbsp;|&nbsp; Market stats: heat map county data
        </div>
      </div>
    </div>
  );
}
