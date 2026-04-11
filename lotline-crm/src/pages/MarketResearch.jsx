import { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Cell,
} from 'recharts';
import {
  Calculator, TrendingUp, Search, ExternalLink, Map,
  ArrowUpRight, ArrowDownRight, Minus, X, ChevronDown, Info,
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt    = (n) => n == null ? '–' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtK   = (n) => n == null ? '–' : '$' + Math.round(n / 1000) + 'k';
const fmtPct = (n) => n == null ? '–' : Number(n).toFixed(1) + '%';
const num    = (s)  => Number(String(s).replace(/[^0-9.]/g, '')) || 0;

// ── County market data (all NC + SC counties) ────────────────────────────────
function _score(c) {
  const opp = Math.round(Math.min(100, Math.max(0,
    Math.min(1, c.absorptionRate / 80) * 40 +
    Math.max(0, (24 - c.monthsSupply) / 24) * 35 +
    Math.max(0, Math.min(1, (c.popGrowth + 3) / 10)) * 25
  )));
  const dem = Math.round(Math.min(100, Math.max(0,
    Math.min(1, c.sellThrough / 300) * 40 +
    Math.max(0, (280 - c.medianDOM) / 240) * 35 +
    Math.min(1, c.absorptionRate / 80) * 25
  )));
  return { ...c, oppScore: opp, demandScore: dem };
}

const COUNTY_DATA = [
  // ── NC Counties ──
  { fips:'37001', name:'Alamance',     state:'NC', medianSalePrice:72250,  medianDOM:70,  monthsSupply:5.0,  absorptionRate:70.9, sellThrough:243.2, popGrowth:1.8,  medianIncome:52000, unemployment:4.2,  mhFriendly:true,  priority:false, medianPpa:56552   },
  { fips:'37003', name:'Alexander',    state:'NC', medianSalePrice:47500,  medianDOM:202, monthsSupply:5.1,  absorptionRate:70.4, sellThrough:237.7, popGrowth:0.6,  medianIncome:46000, unemployment:3.8,  mhFriendly:true,  priority:false, medianPpa:14477   },
  { fips:'37005', name:'Alleghany',    state:'NC', medianSalePrice:30000,  medianDOM:121, monthsSupply:22.7, absorptionRate:34.9, sellThrough:53.5,  popGrowth:-0.4, medianIncome:39000, unemployment:4.5,  mhFriendly:true,  priority:false, medianPpa:15200   },
  { fips:'37007', name:'Anson',        state:'NC', medianSalePrice:38500,  medianDOM:157, monthsSupply:15.8, absorptionRate:43.4, sellThrough:76.8,  popGrowth:-1.2, medianIncome:34000, unemployment:7.1,  mhFriendly:true,  priority:false, medianPpa:13274   },
  { fips:'37009', name:'Ashe',         state:'NC', medianSalePrice:64500,  medianDOM:98,  monthsSupply:16.2, absorptionRate:42.9, sellThrough:75.0,  popGrowth:0.8,  medianIncome:41000, unemployment:4.0,  mhFriendly:true,  priority:false, medianPpa:21094   },
  { fips:'37011', name:'Avery',        state:'NC', medianSalePrice:80000,  medianDOM:124, monthsSupply:30.0, absorptionRate:28.9, sellThrough:40.5,  popGrowth:0.3,  medianIncome:44000, unemployment:3.5,  mhFriendly:false, priority:false, medianPpa:59353   },
  { fips:'37013', name:'Beaufort',     state:'NC', medianSalePrice:48000,  medianDOM:129, monthsSupply:16.5, absorptionRate:42.4, sellThrough:73.8,  popGrowth:0.4,  medianIncome:46000, unemployment:5.2,  mhFriendly:true,  priority:false, medianPpa:34246   },
  { fips:'37015', name:'Bertie',       state:'NC', medianSalePrice:59900,  medianDOM:80,  monthsSupply:18.4, absorptionRate:39.8, sellThrough:66.0,  popGrowth:-1.5, medianIncome:33000, unemployment:7.8,  mhFriendly:true,  priority:false, medianPpa:30770   },
  { fips:'37017', name:'Bladen',       state:'NC', medianSalePrice:32500,  medianDOM:123, monthsSupply:5.9,  absorptionRate:67.4, sellThrough:207.1, popGrowth:-0.8, medianIncome:35000, unemployment:6.5,  mhFriendly:true,  priority:false, medianPpa:10775   },
  { fips:'37019', name:'Brunswick',    state:'NC', medianSalePrice:65000,  medianDOM:97,  monthsSupply:7.8,  absorptionRate:61.0, sellThrough:156.7, popGrowth:5.2,  medianIncome:63000, unemployment:4.0,  mhFriendly:false, priority:false, medianPpa:158044  },
  { fips:'37021', name:'Buncombe',     state:'NC', medianSalePrice:118500, medianDOM:130, monthsSupply:10.7, absorptionRate:53.2, sellThrough:113.6, popGrowth:2.4,  medianIncome:57000, unemployment:3.2,  mhFriendly:false, priority:false, medianPpa:101874  },
  { fips:'37023', name:'Burke',        state:'NC', medianSalePrice:48250,  medianDOM:115, monthsSupply:7.8,  absorptionRate:61.0, sellThrough:156.6, popGrowth:0.5,  medianIncome:44000, unemployment:4.8,  mhFriendly:true,  priority:false, medianPpa:22892   },
  { fips:'37025', name:'Cabarrus',     state:'NC', medianSalePrice:130000, medianDOM:75,  monthsSupply:12.3, absorptionRate:49.8, sellThrough:99.2,  popGrowth:3.4,  medianIncome:72000, unemployment:3.2,  mhFriendly:false, priority:false, medianPpa:66667   },
  { fips:'37027', name:'Caldwell',     state:'NC', medianSalePrice:63000,  medianDOM:135, monthsSupply:11.2, absorptionRate:52.0, sellThrough:108.5, popGrowth:0.3,  medianIncome:43000, unemployment:4.5,  mhFriendly:true,  priority:false, medianPpa:36764   },
  { fips:'37029', name:'Camden',       state:'NC', medianSalePrice:143000, medianDOM:52,  monthsSupply:9.6,  absorptionRate:55.9, sellThrough:126.7, popGrowth:2.1,  medianIncome:74000, unemployment:3.0,  mhFriendly:true,  priority:false, medianPpa:14061   },
  { fips:'37031', name:'Carteret',     state:'NC', medianSalePrice:125000, medianDOM:117, monthsSupply:9.7,  absorptionRate:55.6, sellThrough:125.3, popGrowth:1.8,  medianIncome:55000, unemployment:4.2,  mhFriendly:false, priority:false, medianPpa:232609  },
  { fips:'37033', name:'Caswell',      state:'NC', medianSalePrice:95000,  medianDOM:128, monthsSupply:6.7,  absorptionRate:64.3, sellThrough:180.3, popGrowth:-0.3, medianIncome:38000, unemployment:5.5,  mhFriendly:true,  priority:false, medianPpa:8064    },
  { fips:'37035', name:'Catawba',      state:'NC', medianSalePrice:66500,  medianDOM:94,  monthsSupply:12.4, absorptionRate:49.5, sellThrough:97.9,  popGrowth:1.2,  medianIncome:54000, unemployment:3.8,  mhFriendly:true,  priority:false, medianPpa:52632   },
  { fips:'37037', name:'Chatham',      state:'NC', medianSalePrice:215000, medianDOM:98,  monthsSupply:19.7, absorptionRate:38.1, sellThrough:61.7,  popGrowth:3.5,  medianIncome:72000, unemployment:3.0,  mhFriendly:false, priority:false, medianPpa:49412   },
  { fips:'37039', name:'Cherokee',     state:'NC', medianSalePrice:35000,  medianDOM:113, monthsSupply:17.8, absorptionRate:40.6, sellThrough:68.2,  popGrowth:1.0,  medianIncome:42000, unemployment:4.2,  mhFriendly:true,  priority:false, medianPpa:15000   },
  { fips:'37041', name:'Chowan',       state:'NC', medianSalePrice:29750,  medianDOM:149, monthsSupply:11.4, absorptionRate:51.7, sellThrough:107.0, popGrowth:-0.5, medianIncome:41000, unemployment:5.5,  mhFriendly:true,  priority:false, medianPpa:45938   },
  { fips:'37043', name:'Clay',         state:'NC', medianSalePrice:59500,  medianDOM:239, monthsSupply:24.1, absorptionRate:33.6, sellThrough:50.5,  popGrowth:1.2,  medianIncome:45000, unemployment:3.8,  mhFriendly:true,  priority:false, medianPpa:20734   },
  { fips:'37045', name:'Cleveland',    state:'NC', medianSalePrice:59000,  medianDOM:99,  monthsSupply:13.9, absorptionRate:46.7, sellThrough:87.6,  popGrowth:0.2,  medianIncome:44000, unemployment:5.2,  mhFriendly:true,  priority:false, medianPpa:25000   },
  { fips:'37047', name:'Columbus',     state:'NC', medianSalePrice:45750,  medianDOM:94,  monthsSupply:8.9,  absorptionRate:57.8, sellThrough:137.0, popGrowth:-0.5, medianIncome:34000, unemployment:6.8,  mhFriendly:true,  priority:true,  medianPpa:13857   },
  { fips:'37049', name:'Craven',       state:'NC', medianSalePrice:60000,  medianDOM:97,  monthsSupply:8.2,  absorptionRate:59.8, sellThrough:149.0, popGrowth:0.8,  medianIncome:51000, unemployment:4.8,  mhFriendly:true,  priority:false, medianPpa:78577   },
  { fips:'37051', name:'Cumberland',   state:'NC', medianSalePrice:63375,  medianDOM:85,  monthsSupply:7.7,  absorptionRate:61.2, sellThrough:157.5, popGrowth:0.3,  medianIncome:48000, unemployment:5.5,  mhFriendly:true,  priority:false, medianPpa:34483   },
  { fips:'37053', name:'Currituck',    state:'NC', medianSalePrice:140000, medianDOM:105, monthsSupply:7.0,  absorptionRate:63.6, sellThrough:174.8, popGrowth:3.0,  medianIncome:76000, unemployment:3.2,  mhFriendly:false, priority:false, medianPpa:226875  },
  { fips:'37055', name:'Dare',         state:'NC', medianSalePrice:212500, medianDOM:94,  monthsSupply:7.3,  absorptionRate:62.4, sellThrough:165.9, popGrowth:2.2,  medianIncome:64000, unemployment:5.0,  mhFriendly:false, priority:false, medianPpa:580800  },
  { fips:'37057', name:'Davidson',     state:'NC', medianSalePrice:60000,  medianDOM:111, monthsSupply:9.3,  absorptionRate:56.7, sellThrough:130.8, popGrowth:1.5,  medianIncome:54000, unemployment:3.8,  mhFriendly:true,  priority:false, medianPpa:25692   },
  { fips:'37059', name:'Davie',        state:'NC', medianSalePrice:125000, medianDOM:60,  monthsSupply:5.2,  absorptionRate:70.0, sellThrough:233.3, popGrowth:1.4,  medianIncome:58000, unemployment:3.5,  mhFriendly:true,  priority:false, medianPpa:53399   },
  { fips:'37061', name:'Duplin',       state:'NC', medianSalePrice:47500,  medianDOM:131, monthsSupply:5.9,  absorptionRate:67.5, sellThrough:207.5, popGrowth:0.5,  medianIncome:38000, unemployment:5.8,  mhFriendly:true,  priority:true,  medianPpa:20847   },
  { fips:'37063', name:'Durham',       state:'NC', medianSalePrice:110000, medianDOM:91,  monthsSupply:11.0, absorptionRate:52.4, sellThrough:110.2, popGrowth:2.8,  medianIncome:68000, unemployment:3.2,  mhFriendly:false, priority:false, medianPpa:135435  },
  { fips:'37065', name:'Edgecombe',    state:'NC', medianSalePrice:33500,  medianDOM:106, monthsSupply:25.6, absorptionRate:32.3, sellThrough:47.6,  popGrowth:-1.0, medianIncome:36000, unemployment:7.2,  mhFriendly:true,  priority:false, medianPpa:33091   },
  { fips:'37067', name:'Forsyth',      state:'NC', medianSalePrice:52750,  medianDOM:121, monthsSupply:6.3,  absorptionRate:65.8, sellThrough:192.7, popGrowth:1.5,  medianIncome:55000, unemployment:3.8,  mhFriendly:false, priority:false, medianPpa:47507   },
  { fips:'37069', name:'Franklin',     state:'NC', medianSalePrice:60000,  medianDOM:101, monthsSupply:7.2,  absorptionRate:62.8, sellThrough:168.7, popGrowth:2.5,  medianIncome:56000, unemployment:3.5,  mhFriendly:true,  priority:false, medianPpa:49537   },
  { fips:'37071', name:'Gaston',       state:'NC', medianSalePrice:80000,  medianDOM:85,  monthsSupply:8.2,  absorptionRate:59.6, sellThrough:147.8, popGrowth:1.8,  medianIncome:53000, unemployment:4.0,  mhFriendly:true,  priority:false, medianPpa:81349   },
  { fips:'37073', name:'Gates',        state:'NC', medianSalePrice:84000,  medianDOM:79,  monthsSupply:13.3, absorptionRate:47.7, sellThrough:91.3,  popGrowth:-0.5, medianIncome:48000, unemployment:4.8,  mhFriendly:true,  priority:false, medianPpa:9500    },
  { fips:'37075', name:'Graham',       state:'NC', medianSalePrice:95000,  medianDOM:218, monthsSupply:18.7, absorptionRate:39.4, sellThrough:65.1,  popGrowth:-0.2, medianIncome:38000, unemployment:5.0,  mhFriendly:true,  priority:false, medianPpa:12842   },
  { fips:'37077', name:'Granville',    state:'NC', medianSalePrice:75000,  medianDOM:87,  monthsSupply:8.4,  absorptionRate:59.1, sellThrough:144.2, popGrowth:1.8,  medianIncome:50000, unemployment:4.2,  mhFriendly:true,  priority:false, medianPpa:20747   },
  { fips:'37079', name:'Greene',       state:'NC', medianSalePrice:30000,  medianDOM:134, monthsSupply:3.0,  absorptionRate:80.3, sellThrough:408.3, popGrowth:-0.3, medianIncome:37000, unemployment:6.0,  mhFriendly:true,  priority:false, medianPpa:38044   },
  { fips:'37081', name:'Guilford',     state:'NC', medianSalePrice:80000,  medianDOM:85,  monthsSupply:13.0, absorptionRate:48.3, sellThrough:93.3,  popGrowth:1.5,  medianIncome:57000, unemployment:3.8,  mhFriendly:false, priority:false, medianPpa:63887   },
  { fips:'37083', name:'Halifax',      state:'NC', medianSalePrice:25000,  medianDOM:225, monthsSupply:9.1,  absorptionRate:57.3, sellThrough:134.1, popGrowth:-1.2, medianIncome:34000, unemployment:8.0,  mhFriendly:true,  priority:false, medianPpa:16667   },
  { fips:'37085', name:'Harnett',      state:'NC', medianSalePrice:85000,  medianDOM:71,  monthsSupply:7.1,  absorptionRate:63.0, sellThrough:170.3, popGrowth:3.0,  medianIncome:52000, unemployment:4.2,  mhFriendly:true,  priority:false, medianPpa:59280   },
  { fips:'37087', name:'Haywood',      state:'NC', medianSalePrice:62500,  medianDOM:152, monthsSupply:22.5, absorptionRate:35.1, sellThrough:54.0,  popGrowth:1.2,  medianIncome:48000, unemployment:3.8,  mhFriendly:true,  priority:false, medianPpa:38684   },
  { fips:'37089', name:'Henderson',    state:'NC', medianSalePrice:85000,  medianDOM:93,  monthsSupply:14.2, absorptionRate:46.1, sellThrough:85.5,  popGrowth:2.5,  medianIncome:55000, unemployment:3.2,  mhFriendly:false, priority:false, medianPpa:62913   },
  { fips:'37091', name:'Hertford',     state:'NC', medianSalePrice:18950,  medianDOM:158, monthsSupply:17.6, absorptionRate:40.9, sellThrough:69.2,  popGrowth:-1.5, medianIncome:35000, unemployment:8.5,  mhFriendly:true,  priority:false, medianPpa:14837   },
  { fips:'37093', name:'Hoke',         state:'NC', medianSalePrice:70000,  medianDOM:98,  monthsSupply:10.9, absorptionRate:52.7, sellThrough:111.5, popGrowth:3.2,  medianIncome:48000, unemployment:5.0,  mhFriendly:true,  priority:false, medianPpa:14721   },
  { fips:'37095', name:'Hyde',         state:'NC', medianSalePrice:117500, medianDOM:56,  monthsSupply:13.0, absorptionRate:48.3, sellThrough:93.3,  popGrowth:-2.0, medianIncome:38000, unemployment:7.0,  mhFriendly:true,  priority:false, medianPpa:9805    },
  { fips:'37097', name:'Iredell',      state:'NC', medianSalePrice:100000, medianDOM:117, monthsSupply:12.0, absorptionRate:50.3, sellThrough:101.1, popGrowth:3.0,  medianIncome:68000, unemployment:3.2,  mhFriendly:true,  priority:false, medianPpa:56339   },
  { fips:'37099', name:'Jackson',      state:'NC', medianSalePrice:82000,  medianDOM:156, monthsSupply:15.7, absorptionRate:43.6, sellThrough:77.3,  popGrowth:1.5,  medianIncome:45000, unemployment:4.0,  mhFriendly:true,  priority:false, medianPpa:33750   },
  { fips:'37101', name:'Johnston',     state:'NC', medianSalePrice:180000, medianDOM:93,  monthsSupply:6.0,  absorptionRate:66.8, sellThrough:201.6, popGrowth:4.2,  medianIncome:62000, unemployment:3.5,  mhFriendly:true,  priority:false, medianPpa:64378   },
  { fips:'37103', name:'Jones',        state:'NC', medianSalePrice:87500,  medianDOM:74,  monthsSupply:16.4, absorptionRate:42.6, sellThrough:74.1,  popGrowth:-0.8, medianIncome:38000, unemployment:6.5,  mhFriendly:true,  priority:false, medianPpa:10315   },
  { fips:'37105', name:'Lee',          state:'NC', medianSalePrice:32000,  medianDOM:86,  monthsSupply:10.2, absorptionRate:54.4, sellThrough:119.4, popGrowth:1.5,  medianIncome:48000, unemployment:4.5,  mhFriendly:true,  priority:false, medianPpa:42858   },
  { fips:'37107', name:'Lenoir',       state:'NC', medianSalePrice:26000,  medianDOM:123, monthsSupply:7.0,  absorptionRate:63.3, sellThrough:172.7, popGrowth:-0.8, medianIncome:38000, unemployment:6.5,  mhFriendly:true,  priority:false, medianPpa:23576   },
  { fips:'37109', name:'Lincoln',      state:'NC', medianSalePrice:100000, medianDOM:81,  monthsSupply:8.6,  absorptionRate:58.6, sellThrough:141.4, popGrowth:2.8,  medianIncome:60000, unemployment:3.5,  mhFriendly:true,  priority:false, medianPpa:42218   },
  { fips:'37111', name:'McDowell',     state:'NC', medianSalePrice:82750,  medianDOM:122, monthsSupply:9.9,  absorptionRate:55.2, sellThrough:123.2, popGrowth:0.8,  medianIncome:42000, unemployment:4.5,  mhFriendly:true,  priority:false, medianPpa:29803   },
  { fips:'37113', name:'Macon',        state:'NC', medianSalePrice:50000,  medianDOM:114, monthsSupply:11.3, absorptionRate:51.9, sellThrough:108.1, popGrowth:2.0,  medianIncome:47000, unemployment:3.8,  mhFriendly:true,  priority:false, medianPpa:22000   },
  { fips:'37115', name:'Madison',      state:'NC', medianSalePrice:65000,  medianDOM:168, monthsSupply:12.2, absorptionRate:50.0, sellThrough:100.0, popGrowth:1.0,  medianIncome:42000, unemployment:4.0,  mhFriendly:true,  priority:false, medianPpa:12901   },
  { fips:'37117', name:'Martin',       state:'NC', medianSalePrice:50000,  medianDOM:143, monthsSupply:12.8, absorptionRate:48.8, sellThrough:95.2,  popGrowth:-1.5, medianIncome:36000, unemployment:8.0,  mhFriendly:true,  priority:false, medianPpa:6388    },
  { fips:'37119', name:'Mecklenburg',  state:'NC', medianSalePrice:184750, medianDOM:88,  monthsSupply:17.4, absorptionRate:41.2, sellThrough:70.1,  popGrowth:2.5,  medianIncome:75000, unemployment:3.5,  mhFriendly:false, priority:false, medianPpa:257689  },
  { fips:'37121', name:'Mitchell',     state:'NC', medianSalePrice:50000,  medianDOM:182, monthsSupply:14.5, absorptionRate:45.7, sellThrough:84.1,  popGrowth:0.2,  medianIncome:40000, unemployment:4.2,  mhFriendly:true,  priority:false, medianPpa:11267   },
  { fips:'37123', name:'Montgomery',   state:'NC', medianSalePrice:40000,  medianDOM:152, monthsSupply:12.1, absorptionRate:50.2, sellThrough:100.7, popGrowth:0.4,  medianIncome:40000, unemployment:5.8,  mhFriendly:true,  priority:false, medianPpa:23485   },
  { fips:'37125', name:'Moore',        state:'NC', medianSalePrice:85000,  medianDOM:95,  monthsSupply:6.3,  absorptionRate:66.0, sellThrough:193.8, popGrowth:3.2,  medianIncome:60000, unemployment:3.5,  mhFriendly:false, priority:false, medianPpa:51097   },
  { fips:'37127', name:'Nash',         state:'NC', medianSalePrice:60000,  medianDOM:104, monthsSupply:11.6, absorptionRate:51.2, sellThrough:104.8, popGrowth:0.5,  medianIncome:48000, unemployment:5.2,  mhFriendly:true,  priority:false, medianPpa:31139   },
  { fips:'37129', name:'New Hanover',  state:'NC', medianSalePrice:274450, medianDOM:98,  monthsSupply:6.5,  absorptionRate:65.0, sellThrough:186.0, popGrowth:2.5,  medianIncome:64000, unemployment:3.8,  mhFriendly:false, priority:false, medianPpa:640172  },
  { fips:'37131', name:'Northampton',  state:'NC', medianSalePrice:22000,  medianDOM:77,  monthsSupply:26.6, absorptionRate:31.4, sellThrough:45.7,  popGrowth:-1.8, medianIncome:33000, unemployment:8.5,  mhFriendly:true,  priority:false, medianPpa:19869   },
  { fips:'37133', name:'Onslow',       state:'NC', medianSalePrice:80000,  medianDOM:98,  monthsSupply:8.9,  absorptionRate:57.9, sellThrough:137.4, popGrowth:0.5,  medianIncome:52000, unemployment:5.5,  mhFriendly:true,  priority:false, medianPpa:90000   },
  { fips:'37135', name:'Orange',       state:'NC', medianSalePrice:250000, medianDOM:58,  monthsSupply:8.7,  absorptionRate:58.3, sellThrough:140.0, popGrowth:1.5,  medianIncome:65000, unemployment:3.0,  mhFriendly:false, priority:false, medianPpa:52827   },
  { fips:'37137', name:'Pamlico',      state:'NC', medianSalePrice:55000,  medianDOM:200, monthsSupply:17.8, absorptionRate:40.6, sellThrough:68.3,  popGrowth:0.2,  medianIncome:48000, unemployment:5.0,  mhFriendly:true,  priority:false, medianPpa:45663   },
  { fips:'37139', name:'Pasquotank',   state:'NC', medianSalePrice:85000,  medianDOM:274, monthsSupply:6.9,  absorptionRate:63.8, sellThrough:176.0, popGrowth:0.5,  medianIncome:46000, unemployment:5.2,  mhFriendly:true,  priority:false, medianPpa:22964   },
  { fips:'37141', name:'Pender',       state:'NC', medianSalePrice:133000, medianDOM:96,  monthsSupply:11.0, absorptionRate:52.6, sellThrough:110.9, popGrowth:4.5,  medianIncome:56000, unemployment:4.0,  mhFriendly:true,  priority:false, medianPpa:53619   },
  { fips:'37143', name:'Perquimans',   state:'NC', medianSalePrice:41500,  medianDOM:178, monthsSupply:19.9, absorptionRate:38.0, sellThrough:61.2,  popGrowth:1.0,  medianIncome:49000, unemployment:4.5,  mhFriendly:true,  priority:false, medianPpa:28787   },
  { fips:'37145', name:'Person',       state:'NC', medianSalePrice:71250,  medianDOM:92,  monthsSupply:6.9,  absorptionRate:64.0, sellThrough:177.6, popGrowth:0.8,  medianIncome:49000, unemployment:4.5,  mhFriendly:true,  priority:false, medianPpa:15385   },
  { fips:'37147', name:'Pitt',         state:'NC', medianSalePrice:76250,  medianDOM:116, monthsSupply:8.9,  absorptionRate:57.8, sellThrough:137.1, popGrowth:1.2,  medianIncome:46000, unemployment:5.0,  mhFriendly:true,  priority:false, medianPpa:17413   },
  { fips:'37149', name:'Polk',         state:'NC', medianSalePrice:90000,  medianDOM:149, monthsSupply:22.6, absorptionRate:35.0, sellThrough:53.9,  popGrowth:1.5,  medianIncome:48000, unemployment:3.8,  mhFriendly:true,  priority:false, medianPpa:26418   },
  { fips:'37151', name:'Randolph',     state:'NC', medianSalePrice:50000,  medianDOM:75,  monthsSupply:3.9,  absorptionRate:75.9, sellThrough:314.9, popGrowth:1.2,  medianIncome:48000, unemployment:4.2,  mhFriendly:true,  priority:false, medianPpa:24272   },
  { fips:'37153', name:'Richmond',     state:'NC', medianSalePrice:40000,  medianDOM:87,  monthsSupply:19.3, absorptionRate:38.7, sellThrough:63.1,  popGrowth:-0.5, medianIncome:37000, unemployment:7.0,  mhFriendly:true,  priority:false, medianPpa:10204   },
  { fips:'37155', name:'Robeson',      state:'NC', medianSalePrice:34999,  medianDOM:156, monthsSupply:6.2,  absorptionRate:66.4, sellThrough:197.4, popGrowth:-0.5, medianIncome:32000, unemployment:8.2,  mhFriendly:true,  priority:true,  medianPpa:9804    },
  { fips:'37157', name:'Rockingham',   state:'NC', medianSalePrice:45000,  medianDOM:97,  monthsSupply:5.0,  absorptionRate:70.9, sellThrough:243.6, popGrowth:0.2,  medianIncome:46000, unemployment:5.5,  mhFriendly:true,  priority:false, medianPpa:19288   },
  { fips:'37159', name:'Rowan',        state:'NC', medianSalePrice:75000,  medianDOM:91,  monthsSupply:13.7, absorptionRate:47.0, sellThrough:88.6,  popGrowth:1.0,  medianIncome:51000, unemployment:4.2,  mhFriendly:true,  priority:false, medianPpa:47619   },
  { fips:'37161', name:'Rutherford',   state:'NC', medianSalePrice:38000,  medianDOM:120, monthsSupply:24.7, absorptionRate:33.0, sellThrough:49.3,  popGrowth:0.5,  medianIncome:42000, unemployment:5.5,  mhFriendly:true,  priority:false, medianPpa:13195   },
  { fips:'37163', name:'Sampson',      state:'NC', medianSalePrice:48000,  medianDOM:74,  monthsSupply:10.2, absorptionRate:54.4, sellThrough:119.4, popGrowth:0.3,  medianIncome:38000, unemployment:5.8,  mhFriendly:true,  priority:true,  medianPpa:14631   },
  { fips:'37165', name:'Scotland',     state:'NC', medianSalePrice:25000,  medianDOM:82,  monthsSupply:12.9, absorptionRate:48.5, sellThrough:94.3,  popGrowth:-0.8, medianIncome:36000, unemployment:7.5,  mhFriendly:true,  priority:false, medianPpa:22636   },
  { fips:'37167', name:'Stanly',       state:'NC', medianSalePrice:114500, medianDOM:96,  monthsSupply:4.7,  absorptionRate:72.1, sellThrough:258.0, popGrowth:0.8,  medianIncome:50000, unemployment:4.2,  mhFriendly:true,  priority:false, medianPpa:25333   },
  { fips:'37169', name:'Stokes',       state:'NC', medianSalePrice:69750,  medianDOM:98,  monthsSupply:6.8,  absorptionRate:64.3, sellThrough:179.8, popGrowth:0.5,  medianIncome:48000, unemployment:4.0,  mhFriendly:true,  priority:false, medianPpa:10128   },
  { fips:'37171', name:'Surry',        state:'NC', medianSalePrice:84500,  medianDOM:123, monthsSupply:9.5,  absorptionRate:56.3, sellThrough:128.7, popGrowth:0.3,  medianIncome:44000, unemployment:5.0,  mhFriendly:true,  priority:false, medianPpa:11222   },
  { fips:'37173', name:'Swain',        state:'NC', medianSalePrice:68000,  medianDOM:265, monthsSupply:27.5, absorptionRate:30.7, sellThrough:44.3,  popGrowth:1.0,  medianIncome:39000, unemployment:5.5,  mhFriendly:true,  priority:false, medianPpa:19986   },
  { fips:'37175', name:'Transylvania', state:'NC', medianSalePrice:82500,  medianDOM:192, monthsSupply:11.6, absorptionRate:51.1, sellThrough:104.6, popGrowth:1.8,  medianIncome:50000, unemployment:3.5,  mhFriendly:false, priority:false, medianPpa:45645   },
  { fips:'37177', name:'Tyrrell',      state:'NC', medianSalePrice:40000,  medianDOM:87,  monthsSupply:10.8, absorptionRate:53.1, sellThrough:113.0, popGrowth:-2.0, medianIncome:35000, unemployment:8.0,  mhFriendly:true,  priority:false, medianPpa:32323   },
  { fips:'37179', name:'Union',        state:'NC', medianSalePrice:220000, medianDOM:99,  monthsSupply:11.5, absorptionRate:51.4, sellThrough:106.0, popGrowth:4.8,  medianIncome:85000, unemployment:3.0,  mhFriendly:false, priority:false, medianPpa:48673   },
  { fips:'37181', name:'Vance',        state:'NC', medianSalePrice:49500,  medianDOM:85,  monthsSupply:7.6,  absorptionRate:61.5, sellThrough:159.7, popGrowth:-0.5, medianIncome:36000, unemployment:7.8,  mhFriendly:true,  priority:false, medianPpa:14805   },
  { fips:'37183', name:'Wake',         state:'NC', medianSalePrice:342500, medianDOM:97,  monthsSupply:7.8,  absorptionRate:60.9, sellThrough:155.7, popGrowth:3.2,  medianIncome:89000, unemployment:2.8,  mhFriendly:false, priority:false, medianPpa:491273  },
  { fips:'37185', name:'Warren',       state:'NC', medianSalePrice:48000,  medianDOM:130, monthsSupply:9.6,  absorptionRate:56.0, sellThrough:127.2, popGrowth:-0.8, medianIncome:37000, unemployment:6.8,  mhFriendly:true,  priority:false, medianPpa:15000   },
  { fips:'37187', name:'Washington',   state:'NC', medianSalePrice:45000,  medianDOM:57,  monthsSupply:8.8,  absorptionRate:58.0, sellThrough:138.1, popGrowth:-2.0, medianIncome:34000, unemployment:8.5,  mhFriendly:true,  priority:false, medianPpa:22357   },
  { fips:'37189', name:'Watauga',      state:'NC', medianSalePrice:70000,  medianDOM:94,  monthsSupply:14.7, absorptionRate:45.3, sellThrough:82.9,  popGrowth:1.8,  medianIncome:48000, unemployment:3.5,  mhFriendly:false, priority:false, medianPpa:60607   },
  { fips:'37191', name:'Wayne',        state:'NC', medianSalePrice:39950,  medianDOM:76,  monthsSupply:13.3, absorptionRate:47.8, sellThrough:91.7,  popGrowth:0.8,  medianIncome:44000, unemployment:5.5,  mhFriendly:true,  priority:true,  medianPpa:29325   },
  { fips:'37193', name:'Wilkes',       state:'NC', medianSalePrice:50000,  medianDOM:123, monthsSupply:9.0,  absorptionRate:57.4, sellThrough:134.9, popGrowth:0.2,  medianIncome:42000, unemployment:5.0,  mhFriendly:true,  priority:false, medianPpa:10938   },
  { fips:'37195', name:'Wilson',       state:'NC', medianSalePrice:100000, medianDOM:65,  monthsSupply:7.4,  absorptionRate:62.0, sellThrough:163.4, popGrowth:0.5,  medianIncome:44000, unemployment:5.8,  mhFriendly:true,  priority:false, medianPpa:44900   },
  { fips:'37197', name:'Yadkin',       state:'NC', medianSalePrice:57950,  medianDOM:64,  monthsSupply:5.9,  absorptionRate:67.5, sellThrough:207.7, popGrowth:0.5,  medianIncome:48000, unemployment:4.2,  mhFriendly:true,  priority:false, medianPpa:17945   },
  { fips:'37199', name:'Yancey',       state:'NC', medianSalePrice:52750,  medianDOM:152, monthsSupply:14.8, absorptionRate:45.2, sellThrough:82.4,  popGrowth:1.0,  medianIncome:42000, unemployment:4.5,  mhFriendly:true,  priority:false, medianPpa:17992   },
  // ── SC Counties ──
  { fips:'45001', name:'Abbeville',    state:'SC', medianSalePrice:80000,  medianDOM:71,  monthsSupply:10.7, absorptionRate:53.2, sellThrough:113.8, popGrowth:-0.8, medianIncome:38000, unemployment:6.0,  mhFriendly:true,  priority:false, medianPpa:11841   },
  { fips:'45003', name:'Aiken',        state:'SC', medianSalePrice:80000,  medianDOM:105, monthsSupply:12.7, absorptionRate:49.0, sellThrough:96.1,  popGrowth:2.0,  medianIncome:52000, unemployment:4.2,  mhFriendly:true,  priority:false, medianPpa:15700   },
  { fips:'45005', name:'Allendale',    state:'SC', medianSalePrice:15000,  medianDOM:236, monthsSupply:9.5,  absorptionRate:56.3, sellThrough:128.6, popGrowth:-3.0, medianIncome:28000, unemployment:11.5, mhFriendly:true,  priority:false, medianPpa:5451    },
  { fips:'45007', name:'Anderson',     state:'SC', medianSalePrice:75000,  medianDOM:69,  monthsSupply:7.2,  absorptionRate:62.9, sellThrough:169.3, popGrowth:2.5,  medianIncome:52000, unemployment:4.0,  mhFriendly:true,  priority:false, medianPpa:45917   },
  { fips:'45009', name:'Bamberg',      state:'SC', medianSalePrice:27850,  medianDOM:157, monthsSupply:27.8, absorptionRate:30.4, sellThrough:43.8,  popGrowth:-1.5, medianIncome:33000, unemployment:8.5,  mhFriendly:true,  priority:false, medianPpa:6667    },
  { fips:'45011', name:'Barnwell',     state:'SC', medianSalePrice:49275,  medianDOM:67,  monthsSupply:13.1, absorptionRate:48.1, sellThrough:92.7,  popGrowth:-1.0, medianIncome:35000, unemployment:7.5,  mhFriendly:true,  priority:false, medianPpa:9354    },
  { fips:'45013', name:'Beaufort',     state:'SC', medianSalePrice:191000, medianDOM:124, monthsSupply:9.5,  absorptionRate:56.3, sellThrough:128.7, popGrowth:4.0,  medianIncome:73000, unemployment:3.5,  mhFriendly:false, priority:false, medianPpa:414068  },
  { fips:'45015', name:'Berkeley',     state:'SC', medianSalePrice:135000, medianDOM:112, monthsSupply:9.6,  absorptionRate:56.0, sellThrough:127.0, popGrowth:5.5,  medianIncome:68000, unemployment:3.8,  mhFriendly:true,  priority:false, medianPpa:65000   },
  { fips:'45017', name:'Calhoun',      state:'SC', medianSalePrice:35000,  medianDOM:147, monthsSupply:42.6, absorptionRate:22.2, sellThrough:28.6,  popGrowth:0.5,  medianIncome:42000, unemployment:5.5,  mhFriendly:true,  priority:false, medianPpa:31509   },
  { fips:'45019', name:'Charleston',   state:'SC', medianSalePrice:313250, medianDOM:115, monthsSupply:9.9,  absorptionRate:55.2, sellThrough:123.2, popGrowth:3.0,  medianIncome:72000, unemployment:3.5,  mhFriendly:false, priority:false, medianPpa:299668  },
  { fips:'45021', name:'Cherokee',     state:'SC', medianSalePrice:70000,  medianDOM:102, monthsSupply:9.1,  absorptionRate:57.3, sellThrough:134.0, popGrowth:1.5,  medianIncome:42000, unemployment:5.5,  mhFriendly:true,  priority:true,  medianPpa:20329   },
  { fips:'45023', name:'Chester',      state:'SC', medianSalePrice:87000,  medianDOM:57,  monthsSupply:17.1, absorptionRate:41.5, sellThrough:71.0,  popGrowth:-0.3, medianIncome:39000, unemployment:6.5,  mhFriendly:true,  priority:false, medianPpa:12646   },
  { fips:'45025', name:'Chesterfield', state:'SC', medianSalePrice:47788,  medianDOM:98,  monthsSupply:15.9, absorptionRate:43.4, sellThrough:76.7,  popGrowth:0.3,  medianIncome:38000, unemployment:6.8,  mhFriendly:true,  priority:false, medianPpa:11863   },
  { fips:'45027', name:'Clarendon',    state:'SC', medianSalePrice:45000,  medianDOM:106, monthsSupply:15.5, absorptionRate:44.0, sellThrough:78.6,  popGrowth:-0.5, medianIncome:35000, unemployment:7.5,  mhFriendly:true,  priority:false, medianPpa:14286   },
  { fips:'45029', name:'Colleton',     state:'SC', medianSalePrice:52500,  medianDOM:118, monthsSupply:11.5, absorptionRate:51.5, sellThrough:106.1, popGrowth:0.5,  medianIncome:42000, unemployment:6.0,  mhFriendly:true,  priority:false, medianPpa:30000   },
  { fips:'45031', name:'Darlington',   state:'SC', medianSalePrice:40000,  medianDOM:118, monthsSupply:11.4, absorptionRate:51.7, sellThrough:107.0, popGrowth:-0.3, medianIncome:40000, unemployment:6.5,  mhFriendly:true,  priority:false, medianPpa:11364   },
  { fips:'45033', name:'Dillon',       state:'SC', medianSalePrice:25000,  medianDOM:145, monthsSupply:24.8, absorptionRate:32.9, sellThrough:49.1,  popGrowth:-1.0, medianIncome:34000, unemployment:8.5,  mhFriendly:true,  priority:false, medianPpa:19102   },
  { fips:'45035', name:'Dorchester',   state:'SC', medianSalePrice:123500, medianDOM:99,  monthsSupply:9.9,  absorptionRate:55.0, sellThrough:122.3, popGrowth:5.8,  medianIncome:68000, unemployment:3.5,  mhFriendly:true,  priority:true,  medianPpa:64873   },
  { fips:'45037', name:'Edgefield',    state:'SC', medianSalePrice:78500,  medianDOM:77,  monthsSupply:32.0, absorptionRate:27.6, sellThrough:38.0,  popGrowth:1.5,  medianIncome:48000, unemployment:5.0,  mhFriendly:true,  priority:false, medianPpa:14067   },
  { fips:'45039', name:'Fairfield',    state:'SC', medianSalePrice:117250, medianDOM:177, monthsSupply:39.0, absorptionRate:23.8, sellThrough:31.2,  popGrowth:-1.0, medianIncome:36000, unemployment:7.5,  mhFriendly:true,  priority:false, medianPpa:14038   },
  { fips:'45041', name:'Florence',     state:'SC', medianSalePrice:32000,  medianDOM:110, monthsSupply:10.1, absorptionRate:54.7, sellThrough:120.8, popGrowth:0.5,  medianIncome:46000, unemployment:6.0,  mhFriendly:true,  priority:false, medianPpa:25000   },
  { fips:'45043', name:'Georgetown',   state:'SC', medianSalePrice:92000,  medianDOM:114, monthsSupply:6.6,  absorptionRate:64.7, sellThrough:183.3, popGrowth:1.8,  medianIncome:52000, unemployment:5.0,  mhFriendly:true,  priority:false, medianPpa:114940  },
  { fips:'45045', name:'Greenville',   state:'SC', medianSalePrice:100000, medianDOM:115, monthsSupply:7.6,  absorptionRate:61.6, sellThrough:160.4, popGrowth:3.5,  medianIncome:63000, unemployment:3.2,  mhFriendly:false, priority:false, medianPpa:100000  },
  { fips:'45047', name:'Greenwood',    state:'SC', medianSalePrice:49450,  medianDOM:125, monthsSupply:8.6,  absorptionRate:58.5, sellThrough:140.7, popGrowth:0.8,  medianIncome:46000, unemployment:5.5,  mhFriendly:true,  priority:false, medianPpa:16617   },
  { fips:'45049', name:'Hampton',      state:'SC', medianSalePrice:35000,  medianDOM:188, monthsSupply:27.4, absorptionRate:30.8, sellThrough:44.4,  popGrowth:-1.0, medianIncome:35000, unemployment:8.0,  mhFriendly:true,  priority:false, medianPpa:21250   },
  { fips:'45051', name:'Horry',        state:'SC', medianSalePrice:120000, medianDOM:118, monthsSupply:9.1,  absorptionRate:57.2, sellThrough:133.5, popGrowth:6.5,  medianIncome:54000, unemployment:4.0,  mhFriendly:true,  priority:true,  medianPpa:99479   },
  { fips:'45053', name:'Jasper',       state:'SC', medianSalePrice:410000, medianDOM:128, monthsSupply:5.4,  absorptionRate:69.2, sellThrough:224.3, popGrowth:3.5,  medianIncome:45000, unemployment:5.5,  mhFriendly:true,  priority:false, medianPpa:3344310 },
  { fips:'45055', name:'Kershaw',      state:'SC', medianSalePrice:38950,  medianDOM:178, monthsSupply:51.7, absorptionRate:19.0, sellThrough:23.5,  popGrowth:2.0,  medianIncome:52000, unemployment:4.8,  mhFriendly:true,  priority:false, medianPpa:9832    },
  { fips:'45057', name:'Lancaster',    state:'SC', medianSalePrice:115000, medianDOM:102, monthsSupply:9.4,  absorptionRate:56.5, sellThrough:129.9, popGrowth:5.2,  medianIncome:55000, unemployment:4.0,  mhFriendly:true,  priority:true,  medianPpa:35168   },
  { fips:'45059', name:'Laurens',      state:'SC', medianSalePrice:121900, medianDOM:82,  monthsSupply:9.4,  absorptionRate:56.5, sellThrough:129.6, popGrowth:0.8,  medianIncome:44000, unemployment:5.5,  mhFriendly:true,  priority:false, medianPpa:31728   },
  { fips:'45061', name:'Lee',          state:'SC', medianSalePrice:51950,  medianDOM:70,  monthsSupply:24.3, absorptionRate:33.3, sellThrough:50.0,  popGrowth:-2.0, medianIncome:30000, unemployment:10.0, mhFriendly:true,  priority:false, medianPpa:9393    },
  { fips:'45063', name:'Lexington',    state:'SC', medianSalePrice:105000, medianDOM:137, monthsSupply:17.2, absorptionRate:41.4, sellThrough:70.7,  popGrowth:3.5,  medianIncome:68000, unemployment:3.2,  mhFriendly:true,  priority:false, medianPpa:74627   },
  { fips:'45065', name:'McCormick',    state:'SC', medianSalePrice:52500,  medianDOM:115, monthsSupply:28.0, absorptionRate:30.3, sellThrough:43.4,  popGrowth:0.5,  medianIncome:38000, unemployment:6.5,  mhFriendly:true,  priority:false, medianPpa:36688   },
  { fips:'45067', name:'Marion',       state:'SC', medianSalePrice:34000,  medianDOM:108, monthsSupply:24.7, absorptionRate:33.0, sellThrough:49.3,  popGrowth:-1.5, medianIncome:33000, unemployment:9.0,  mhFriendly:true,  priority:false, medianPpa:7500    },
  { fips:'45069', name:'Marlboro',     state:'SC', medianSalePrice:42200,  medianDOM:83,  monthsSupply:12.8, absorptionRate:48.6, sellThrough:94.7,  popGrowth:-2.0, medianIncome:31000, unemployment:10.5, mhFriendly:true,  priority:false, medianPpa:6892    },
  { fips:'45071', name:'Newberry',     state:'SC', medianSalePrice:80000,  medianDOM:212, monthsSupply:30.7, absorptionRate:28.4, sellThrough:39.6,  popGrowth:0.8,  medianIncome:45000, unemployment:5.5,  mhFriendly:true,  priority:false, medianPpa:32000   },
  { fips:'45073', name:'Oconee',       state:'SC', medianSalePrice:47400,  medianDOM:77,  monthsSupply:7.5,  absorptionRate:62.0, sellThrough:163.3, popGrowth:2.2,  medianIncome:50000, unemployment:4.0,  mhFriendly:true,  priority:false, medianPpa:42860   },
  { fips:'45075', name:'Orangeburg',   state:'SC', medianSalePrice:35000,  medianDOM:121, monthsSupply:16.9, absorptionRate:41.9, sellThrough:72.1,  popGrowth:-0.5, medianIncome:37000, unemployment:7.5,  mhFriendly:true,  priority:false, medianPpa:18606   },
  { fips:'45077', name:'Pickens',      state:'SC', medianSalePrice:75500,  medianDOM:107, monthsSupply:9.1,  absorptionRate:57.1, sellThrough:133.3, popGrowth:2.0,  medianIncome:52000, unemployment:3.8,  mhFriendly:true,  priority:false, medianPpa:47081   },
  { fips:'45079', name:'Richland',     state:'SC', medianSalePrice:34500,  medianDOM:43,  monthsSupply:12.8, absorptionRate:48.7, sellThrough:95.0,  popGrowth:2.0,  medianIncome:60000, unemployment:4.0,  mhFriendly:false, priority:false, medianPpa:65625   },
  { fips:'45081', name:'Saluda',       state:'SC', medianSalePrice:45516,  medianDOM:21,  monthsSupply:43.1, absorptionRate:22.0, sellThrough:28.2,  popGrowth:1.0,  medianIncome:44000, unemployment:5.5,  mhFriendly:true,  priority:false, medianPpa:7648    },
  { fips:'45083', name:'Spartanburg',  state:'SC', medianSalePrice:78500,  medianDOM:70,  monthsSupply:4.2,  absorptionRate:74.2, sellThrough:287.5, popGrowth:2.5,  medianIncome:52000, unemployment:4.0,  mhFriendly:true,  priority:false, medianPpa:84533   },
  { fips:'45085', name:'Sumter',       state:'SC', medianSalePrice:30000,  medianDOM:145, monthsSupply:20.6, absorptionRate:37.1, sellThrough:59.0,  popGrowth:0.5,  medianIncome:42000, unemployment:6.5,  mhFriendly:true,  priority:false, medianPpa:26500   },
  { fips:'45087', name:'Union',        state:'SC', medianSalePrice:80500,  medianDOM:137, monthsSupply:11.6, absorptionRate:51.2, sellThrough:104.9, popGrowth:-1.0, medianIncome:38000, unemployment:7.0,  mhFriendly:true,  priority:false, medianPpa:8800    },
  { fips:'45089', name:'Williamsburg', state:'SC', medianSalePrice:97500,  medianDOM:77,  monthsSupply:13.4, absorptionRate:47.6, sellThrough:90.7,  popGrowth:-1.5, medianIncome:30000, unemployment:10.0, mhFriendly:true,  priority:false, medianPpa:6431    },
  { fips:'45091', name:'York',         state:'SC', medianSalePrice:173450, medianDOM:85,  monthsSupply:6.1,  absorptionRate:66.8, sellThrough:201.0, popGrowth:5.0,  medianIncome:70000, unemployment:3.2,  mhFriendly:true,  priority:false, medianPpa:125000  },
].map(_score);

const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-colors';
const inpDark = 'w-full bg-sidebar/5 border border-gray-200 rounded-lg px-3 py-2 text-sm text-sidebar focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-colors';

// ── Shared components ─────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = 'text-sidebar' }) {
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ScoreBadge({ score }) {
  if (score == null) return <span className="text-gray-300">–</span>;
  const color = score >= 70 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-500';
  return <span className={`font-bold tabular-nums ${color}`}>{score}</span>;
}

function TrendIcon({ val }) {
  if (val == null) return null;
  if (val > 0) return <ArrowUpRight size={12} className="text-green-500 inline" />;
  if (val < 0) return <ArrowDownRight size={12} className="text-red-500 inline" />;
  return <Minus size={12} className="text-gray-400 inline" />;
}

// ── TAB 1: Deal Analyzer ──────────────────────────────────────────────────────
const DEAL_DEFAULTS = {
  countyFips: '37019',
  acquisition: 32000,
  homeCost: 94500,
  install: 8500,
  closing: 4200,
  carrying: 2800,
  targetSale: 249000,
};

function DealAnalyzer() {
  const [inputs, setInputs] = useState(DEAL_DEFAULTS);
  const setI = (k, v) => setInputs(p => ({ ...p, [k]: v }));

  const county = COUNTY_DATA.find(c => c.fips === inputs.countyFips) || null;

  const allIn      = num(inputs.acquisition) + num(inputs.homeCost) + num(inputs.install) + num(inputs.closing) + num(inputs.carrying);
  const targetSale = num(inputs.targetSale);
  const profit     = targetSale - allIn;
  const roi        = allIn > 0 ? (profit / allIn) * 100 : 0;
  const margin     = targetSale > 0 ? (profit / targetSale) * 100 : 0;

  const estDOM = county
    ? Math.round(county.medianDOM * (roi > 25 ? 0.85 : roi > 15 ? 1.0 : 1.15))
    : null;

  const waterfall = [
    { name: 'Land',     value: num(inputs.acquisition), color: '#60a5fa' },
    { name: 'Home',     value: num(inputs.homeCost),    color: '#818cf8' },
    { name: 'Install',  value: num(inputs.install),     color: '#a78bfa' },
    { name: 'Closing',  value: num(inputs.closing),     color: '#c4b5fd' },
    { name: 'Carrying', value: num(inputs.carrying),    color: '#ddd6fe' },
    { name: 'Profit',   value: Math.max(profit, 0),     color: profit >= 0 ? '#22c55e' : '#ef4444' },
  ];

  return (
    <div className="flex gap-5 h-full">
      {/* Left — inputs */}
      <div className="w-72 flex-shrink-0 space-y-4">
        <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <p className="text-xs font-bold text-accent uppercase tracking-widest">Target County</p>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Select County</label>
            <select value={inputs.countyFips} onChange={e => setI('countyFips', e.target.value)} className={inp}>
              {COUNTY_DATA.map(c => (
                <option key={c.fips} value={c.fips}>{c.name} County, {c.state}</option>
              ))}
            </select>
            {county && (
              <p className="text-xs text-accent mt-1 font-medium">
                Median sale: {fmtK(county.medianSalePrice)} · DOM: {county.medianDOM}d · Opp Score: {county.oppScore}/100
              </p>
            )}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
          <p className="text-xs font-bold text-accent uppercase tracking-widest">Cost Inputs</p>
          {[
            { label: 'Land Acquisition',    key: 'acquisition', hint: 'Parcel purchase price' },
            { label: 'Manufactured Home',   key: 'homeCost',    hint: 'Invoice from manufacturer' },
            { label: 'Install & Setup',     key: 'install',     hint: 'Foundation, delivery, hookups' },
            { label: 'Closing Costs',       key: 'closing',     hint: 'Title, recording, legal' },
            { label: 'Carrying Costs',      key: 'carrying',    hint: 'Taxes, insurance during hold' },
          ].map(({ label, key, hint }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" value={inputs[key]} onChange={e => setI(key, e.target.value)}
                  className={inp + ' pl-7'} />
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{hint}</p>
            </div>
          ))}
        </div>

        <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5 space-y-2">
          <p className="text-xs font-bold text-accent uppercase tracking-widest">Target Sale Price</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input type="number" value={inputs.targetSale} onChange={e => setI('targetSale', e.target.value)}
              className={inp + ' pl-7 font-semibold text-sidebar'} />
          </div>
          {county && (
            <p className="text-xs text-gray-400">
              County median: {fmtK(county.medianSalePrice)}{' '}
              <span className={targetSale <= county.medianSalePrice * 1.1 ? 'text-green-600' : 'text-yellow-600'}>
                ({targetSale > county.medianSalePrice ? '+' : ''}{((targetSale - county.medianSalePrice) / county.medianSalePrice * 100).toFixed(0)}% vs median)
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Right — results */}
      <div className="flex-1 space-y-4 overflow-auto">
        {/* P&L summary */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Total All-In Cost" value={fmt(allIn)} sub="all costs combined" />
          <StatCard label="Projected Profit" value={fmt(profit)} sub="sale − all-in"
            color={profit >= 0 ? 'text-green-600' : 'text-red-500'} />
          <StatCard label="ROI" value={fmtPct(roi)} sub="profit ÷ all-in"
            color={roi >= 20 ? 'text-green-600' : roi >= 10 ? 'text-yellow-600' : 'text-red-500'} />
          <StatCard label="Net Margin" value={fmtPct(margin)} sub="profit ÷ sale price"
            color={margin >= 15 ? 'text-green-600' : 'text-yellow-600'} />
        </div>

        {/* Break-even + DOM */}
        <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-bold text-sidebar mb-4">Break-Even Analysis</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">Break-Even Price</p>
              <p className="text-2xl font-bold text-sidebar tabular-nums">{fmt(allIn)}</p>
              <p className="text-xs text-gray-400 mt-1">Minimum to recover costs</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Safety Margin</p>
              <p className={`text-2xl font-bold tabular-nums ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt(Math.abs(profit))}</p>
              <p className="text-xs text-gray-400 mt-1">{profit >= 0 ? 'Above break-even' : 'Current loss'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Est. Days to Sell</p>
              <p className="text-2xl font-bold text-sidebar tabular-nums">{estDOM ?? '–'}{estDOM ? 'd' : ''}</p>
              <p className="text-xs text-gray-400 mt-1">Based on county median DOM</p>
            </div>
          </div>
        </div>

        {/* Waterfall chart */}
        <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-bold text-sidebar mb-4">Cost Stack vs Sale Price</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={waterfall} margin={{ top: 4, right: 16, left: 50, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => '$' + (v / 1000).toFixed(0) + 'k'} tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v) => [fmt(v)]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                cursor={{ fill: 'rgba(249,115,22,0.06)' }}
              />
              <ReferenceLine y={targetSale} stroke="#f97316" strokeDasharray="4 4"
                label={{ value: 'Target Sale', fill: '#f97316', fontSize: 11, position: 'right' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {waterfall.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* County context */}
        {county && (
          <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-sm font-bold text-sidebar mb-4">Market Context — {county.name} County, {county.state}</p>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Median Sale Price', value: fmtK(county.medianSalePrice),
                  sub: targetSale <= county.medianSalePrice * 1.1 ? 'In range' : 'Above median',
                  color: targetSale <= county.medianSalePrice * 1.1 ? 'text-green-600' : 'text-yellow-600' },
                { label: 'Months of Supply', value: county.monthsSupply.toFixed(1),
                  sub: county.monthsSupply < 4 ? 'Seller market' : county.monthsSupply < 7 ? 'Balanced' : 'Buyer market',
                  color: county.monthsSupply < 4 ? 'text-green-600' : county.monthsSupply < 7 ? 'text-yellow-600' : 'text-red-500' },
                { label: 'Absorption Rate', value: fmtPct(county.absorptionRate), sub: '90-day period', color: 'text-sidebar' },
                { label: 'Opportunity Score', value: county.oppScore + '/100', sub: 'LotLine score',
                  color: county.oppScore >= 70 ? 'text-green-600' : 'text-yellow-600' },
              ].map(({ label, value, sub, color }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">{label}</p>
                  <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── TAB 2: Market Stats ───────────────────────────────────────────────────────
const SORT_COLS = [
  { key: 'name',            label: 'County' },
  { key: 'oppScore',        label: 'Opp Score' },
  { key: 'demandScore',     label: 'Demand' },
  { key: 'monthsSupply',    label: 'Mo. Supply' },
  { key: 'absorptionRate',  label: 'Abs. Rate' },
  { key: 'medianSalePrice', label: 'Med. Sale' },
  { key: 'medianDOM',       label: 'DOM' },
  { key: 'listToSale',      label: 'L/S Ratio' },
  { key: 'sellThrough',     label: 'Sell Thru' },
  { key: 'activeListing',   label: 'Active' },
  { key: 'soldCount',       label: 'Sold' },
  { key: 'popGrowth',       label: 'Pop Growth' },
  { key: 'medianIncome',    label: 'Med. Income' },
  { key: 'unemployment',    label: 'Unemp.' },
];

function MarketStats() {
  const [stateFilter, setStateFilter] = useState('Both');
  const [sort, setSort] = useState({ col: 'oppScore', dir: -1 });
  const [search, setSearch] = useState('');

  const handleSort = (col) => setSort(p => p.col === col ? { col, dir: -p.dir } : { col, dir: -1 });

  const filtered = COUNTY_DATA
    .filter(r => stateFilter === 'Both' || r.state === stateFilter)
    .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const va = a[sort.col], vb = b[sort.col];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return sort.dir * (va < vb ? -1 : va > vb ? 1 : 0);
    });

  const exportCsv = () => {
    const cols = SORT_COLS.map(c => c.key);
    const rows = [SORT_COLS.map(c => c.label), ...filtered.map(r => cols.map(c => r[c] ?? ''))];
    const csv  = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `lotline-market-stats.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-card rounded-xl border border-gray-100 shadow-sm px-5 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {['Both', 'NC', 'SC'].map(s => (
            <button key={s} onClick={() => setStateFilter(s)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${stateFilter === s ? 'bg-white text-sidebar shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {s}
            </button>
          ))}
        </div>
        <div className="relative ml-2">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filter county..." className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 w-40" />
        </div>
        <span className="text-xs text-gray-400 ml-2">{filtered.length} counties</span>
        <button onClick={exportCsv} className="ml-auto text-xs text-gray-500 hover:text-accent transition-colors font-medium">Export CSV</button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
              <tr>
                {SORT_COLS.map(({ key, label }) => (
                  <th key={key} onClick={() => handleSort(key)}
                    className={`text-left py-3 px-3 font-semibold uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-accent transition-colors ${sort.col === key ? 'text-accent' : 'text-gray-500'}`}>
                    {label} {sort.col === key ? (sort.dir === 1 ? '↑' : '↓') : ''}
                  </th>
                ))}
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">MH Zone</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Priority</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.fips} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                  <td className="py-3 px-3 font-semibold text-sidebar whitespace-nowrap">{r.name}, {r.state}</td>
                  <td className="py-3 px-3"><ScoreBadge score={r.oppScore} /></td>
                  <td className="py-3 px-3"><ScoreBadge score={r.demandScore} /></td>
                  <td className="py-3 px-3 tabular-nums text-gray-600">{r.monthsSupply.toFixed(1)}</td>
                  <td className="py-3 px-3 tabular-nums text-gray-600">{fmtPct(r.absorptionRate)}</td>
                  <td className="py-3 px-3 tabular-nums font-semibold text-sidebar">{fmtK(r.medianSalePrice)}</td>
                  <td className="py-3 px-3 tabular-nums text-gray-600">{r.medianDOM}d</td>
                  <td className="py-3 px-3 tabular-nums">
                    <span className={r.listToSale >= 98 ? 'text-green-600' : 'text-gray-600'}>{fmtPct(r.listToSale)}</span>
                  </td>
                  <td className="py-3 px-3 tabular-nums text-gray-600">{fmtPct(r.sellThrough)}</td>
                  <td className="py-3 px-3 tabular-nums text-gray-600">{r.activeListing}</td>
                  <td className="py-3 px-3 tabular-nums text-gray-600">{r.soldCount}</td>
                  <td className="py-3 px-3 tabular-nums">
                    <span className={r.popGrowth >= 0 ? 'text-green-600' : 'text-red-500'}>
                      <TrendIcon val={r.popGrowth} /> {fmtPct(r.popGrowth)}
                    </span>
                  </td>
                  <td className="py-3 px-3 tabular-nums text-gray-600">{fmtK(r.medianIncome)}</td>
                  <td className="py-3 px-3 tabular-nums text-gray-600">{fmtPct(r.unemployment)}</td>
                  <td className="py-3 px-3">
                    {r.mhFriendly
                      ? <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Yes</span>
                      : <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">No</span>}
                  </td>
                  <td className="py-3 px-3">
                    {r.priority && <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent">★ Priority</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400 bg-gray-50">
          {filtered.length} of {COUNTY_DATA.length} counties · Manufactured home market data
        </div>
      </div>
    </div>
  );
}

// ── TAB 3: Comp Finder ────────────────────────────────────────────────────────
const COMP_LINKS = [
  { name: 'Zillow', url: 'https://www.zillow.com/homes/for_sale/', desc: 'Largest listing database, filter by sold homes', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { name: 'Realtor.com', url: 'https://www.realtor.com/realestateandhomes-search/', desc: 'MLS-connected data, strong comp history', color: 'bg-red-50 border-red-200 text-red-700' },
  { name: 'Redfin', url: 'https://www.redfin.com/', desc: 'Best for sold price accuracy and DOM data', color: 'bg-teal-50 border-teal-200 text-teal-700' },
  { name: 'LandWatch', url: 'https://www.landwatch.com/', desc: 'Land and rural property comps', color: 'bg-green-50 border-green-200 text-green-700' },
  { name: 'Land.com', url: 'https://www.land.com/', desc: 'Largest land-only listing network', color: 'bg-amber-50 border-amber-200 text-amber-700' },
  { name: 'MHVillage', url: 'https://www.mhvillage.com/', desc: 'Manufactured home specific comps and sales', color: 'bg-purple-50 border-purple-200 text-purple-700' },
];

const COUNTY_PORTALS = [
  { name: 'Brunswick County GIS', url: 'https://data-brunsco.opendata.arcgis.com/', desc: 'Permit data, parcel maps, sales data' },
  { name: 'Guilford County GIS', url: 'https://www.guilfordcountync.gov/our-county/gis', desc: 'Property records and parcel search' },
  { name: 'Horry County GIS', url: 'https://www.horrycounty.org/departments/geographic-information-systems', desc: 'Active permits database and parcel lookup' },
  { name: 'NC Property Tax Search', url: 'https://www.ncdor.gov/taxes-forms/property-tax', desc: 'Statewide property valuation data' },
  { name: 'SC Property Tax Search', url: 'https://www.scdor.gov/property-taxes', desc: 'Statewide property valuation data' },
];

function CompFinder() {
  const [state, setState] = useState('NC');
  const [county, setCounty] = useState('');
  const [zip, setZip] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minAcres, setMinAcres] = useState('');
  const [maxAcres, setMaxAcres] = useState('');

  const buildZillowUrl = () => {
    const base = `https://www.zillow.com/homes/recently_sold/`;
    const params = [];
    if (zip) return `https://www.zillow.com/homes/recently_sold/${zip}_rb/`;
    if (county && state) return `https://www.zillow.com/homes/recently_sold/${county}-county-${state.toLowerCase()}_rb/`;
    return base;
  };

  const buildRealtorUrl = () => {
    if (zip) return `https://www.realtor.com/realestateandhomes-search/${zip}`;
    if (county && state) return `https://www.realtor.com/realestateandhomes-search/${county.replace(/\s+/g, '-')}-County_${state}`;
    return 'https://www.realtor.com/realestateandhomes-search/';
  };

  const buildMHVillageUrl = () => {
    if (state) return `https://www.mhvillage.com/homes/?state=${state.toLowerCase()}`;
    return 'https://www.mhvillage.com/homes/';
  };

  return (
    <div className="space-y-5">
      {/* Quick search builder */}
      <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5">
        <p className="text-sm font-bold text-sidebar mb-4">Quick Search Builder</p>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">State</label>
            <select value={state} onChange={e => setState(e.target.value)} className={inp}>
              <option>NC</option><option>SC</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">County</label>
            <input value={county} onChange={e => setCounty(e.target.value)} placeholder="e.g. Brunswick" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">ZIP Code</label>
            <input value={zip} onChange={e => setZip(e.target.value)} placeholder="e.g. 28462" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Min Price</label>
            <input value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="$100,000" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Max Price</label>
            <input value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="$400,000" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Acreage Range</label>
            <div className="flex gap-2">
              <input value={minAcres} onChange={e => setMinAcres(e.target.value)} placeholder="Min" className={inp} />
              <input value={maxAcres} onChange={e => setMaxAcres(e.target.value)} placeholder="Max" className={inp} />
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <a href={buildZillowUrl()} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            Search Zillow <ExternalLink size={13} />
          </a>
          <a href={buildRealtorUrl()} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors">
            Search Realtor.com <ExternalLink size={13} />
          </a>
          <a href={buildMHVillageUrl()} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors">
            Search MHVillage <ExternalLink size={13} />
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Comp sources */}
        <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-bold text-sidebar mb-4">Comp Data Sources</p>
          <div className="space-y-2">
            {COMP_LINKS.map(({ name, url, desc, color }) => (
              <a key={name} href={url} target="_blank" rel="noopener noreferrer"
                className={`flex items-center justify-between p-3 rounded-lg border transition-all hover:shadow-sm ${color}`}>
                <div>
                  <p className="text-sm font-semibold">{name}</p>
                  <p className="text-xs opacity-80 mt-0.5">{desc}</p>
                </div>
                <ExternalLink size={14} className="flex-shrink-0 ml-3 opacity-60" />
              </a>
            ))}
          </div>
        </div>

        {/* County data portals */}
        <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-bold text-sidebar mb-4">County Data Portals</p>
          <div className="space-y-2">
            {COUNTY_PORTALS.map(({ name, url, desc }) => (
              <a key={name} href={url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50 hover:border-accent/40 hover:bg-accent/5 transition-all group">
                <div>
                  <p className="text-sm font-semibold text-sidebar group-hover:text-accent transition-colors">{name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
                <ExternalLink size={14} className="flex-shrink-0 ml-3 text-gray-400 group-hover:text-accent transition-colors" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TAB 4: Heat Map ───────────────────────────────────────────────────────────
const METRIC_CONFIG = {
  oppScore:        { label: 'Opportunity Score',  higherIsBetter: true,  fmt: v => v.toFixed(0) + '/100' },
  demandScore:     { label: 'Demand Score',       higherIsBetter: true,  fmt: v => v.toFixed(0) + '/100' },
  medianSalePrice: { label: 'Median Sale Price',  higherIsBetter: null,  fmt: v => '$' + Math.round(v/1000) + 'k' },
  medianDOM:       { label: 'Days on Market',     higherIsBetter: false, fmt: v => v.toFixed(0) + 'd' },
  monthsSupply:    { label: 'Months of Supply',   higherIsBetter: false, fmt: v => v.toFixed(1) },
  absorptionRate:  { label: 'Absorption Rate',    higherIsBetter: true,  fmt: v => v.toFixed(1) + '%' },
  sellThrough:     { label: 'Sell-Through Rate',  higherIsBetter: true,  fmt: v => v.toFixed(1) + '%' },
  popGrowth:       { label: 'Pop. Growth',        higherIsBetter: true,  fmt: v => v.toFixed(1) + '%' },
  medianIncome:    { label: 'Median Income',      higherIsBetter: true,  fmt: v => '$' + Math.round(v/1000) + 'k' },
  medianPpa:       { label: '$ / Acre',           higherIsBetter: null,  fmt: v => '$' + Math.round(v).toLocaleString() },
};

// ── Filter config ─────────────────────────────────────────────────────────────
const TIME_FACTOR = {
  '7 days': 7/365, '14 days': 14/365, '30 days': 30/365,
  '90 days': 90/365, '6 months': 0.5, '1 year': 1.0,
  '2 years': 2.0, '3 years': 3.0, '5 years': 5.0,
};

const ACREAGE_FILTER = {
  'All':          () => true,
  '0-1 acre':     c => c.medianPpa > 200000,
  '1-2 acres':    c => c.medianPpa > 80000  && c.medianPpa <= 200000,
  '2-5 acres':    c => c.medianPpa > 35000  && c.medianPpa <= 80000,
  '5-10 acres':   c => c.medianPpa > 18000  && c.medianPpa <= 35000,
  '10-20 acres':  c => c.medianPpa > 10000  && c.medianPpa <= 18000,
  '20-50 acres':  c => c.medianPpa > 5000   && c.medianPpa <= 10000,
  '50-70 acres':  c => c.medianPpa > 3500   && c.medianPpa <= 5000,
  '70-100 acres': c => c.medianPpa > 2500   && c.medianPpa <= 3500,
  '100-150 acres':c => c.medianPpa > 1500   && c.medianPpa <= 2500,
  '150+ acres':   c => c.medianPpa <= 1500,
};

function getActiveMetric(statistic, status) {
  if (statistic === 'Counts')                  return status === 'For Sale' ? 'monthsSupply' : 'absorptionRate';
  if (statistic === 'Median Price')            return 'medianSalePrice';
  if (statistic === 'Median Price/Acre')       return 'medianPpa';
  if (statistic === 'Sell Through Rate (STR)') return 'sellThrough';
  if (statistic === 'Days on Market')          return 'medianDOM';
  return 'absorptionRate';
}

// ── Per-type data adjustments ─────────────────────────────────────────────────
// Each property type uses income + land metrics to derive realistic type-specific
// prices, DOM, absorption, and supply figures. "Land" = raw data unchanged.
const DATA_TYPE_FILTERS = {
  All:         () => true,
  Land:        () => true,
  House:       () => true,
  Townhouse:   c => c.medianIncome > 42000,
  Condo:       c => c.medianIncome > 50000,
  MultiFamily: c => c.medianIncome > 38000,
};

function applyDataType(counties, dataType) {
  if (dataType === 'All') return counties;
  if (dataType === 'Land') return counties;
  return counties.map(c => {
    const inc = c.medianIncome;
    switch (dataType) {
      case 'House':
        return { ...c,
          medianSalePrice: Math.round(inc * 4.0),
          medianDOM:       Math.round(c.medianDOM * 0.72),
          absorptionRate:  Math.min(90, +(c.absorptionRate * 1.18).toFixed(1)),
          monthsSupply:    +(c.monthsSupply * 0.72).toFixed(1),
          sellThrough:     Math.min(380, +(c.sellThrough * 1.14).toFixed(1)),
        };
      case 'Townhouse':
        return { ...c,
          medianSalePrice: Math.round(inc * 3.2),
          medianDOM:       Math.round(c.medianDOM * 0.68),
          absorptionRate:  Math.min(90, +(c.absorptionRate * 1.14).toFixed(1)),
          monthsSupply:    +(c.monthsSupply * 0.65).toFixed(1),
          sellThrough:     Math.min(380, +(c.sellThrough * 1.12).toFixed(1)),
        };
      case 'Condo':
        return { ...c,
          medianSalePrice: Math.round(inc * 2.6),
          medianDOM:       Math.round(c.medianDOM * 0.55),
          absorptionRate:  Math.min(90, +(c.absorptionRate * 1.22).toFixed(1)),
          monthsSupply:    +(c.monthsSupply * 0.55).toFixed(1),
          sellThrough:     Math.min(380, +(c.sellThrough * 1.20).toFixed(1)),
        };
      case 'MultiFamily':
        return { ...c,
          medianSalePrice: Math.round(inc * 5.5),
          medianDOM:       Math.round(c.medianDOM * 1.08),
          absorptionRate:  +(c.absorptionRate * 0.88).toFixed(1),
          monthsSupply:    +(c.monthsSupply * 1.12).toFixed(1),
          sellThrough:     +(c.sellThrough * 0.90).toFixed(1),
        };
      default:
        return c;
    }
  });
}

// ── LandPortal-style filter dropdown ─────────────────────────────────────────
function FilterDropdown({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 pl-3 pr-2.5 py-1.5 rounded-lg border text-sm transition-all whitespace-nowrap select-none
          ${open
            ? 'border-gray-400 bg-white shadow-sm ring-1 ring-gray-200'
            : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50/60'
          }`}
      >
        <span className="text-gray-500 font-normal">{label}:</span>
        <span className="font-semibold text-gray-800 ml-0.5">{value}</span>
        <ChevronDown size={13} className={`ml-1 text-gray-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-2xl z-[2000] min-w-[160px] py-1.5 overflow-hidden">
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between gap-4
                ${value === opt ? 'bg-green-50 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <span>{opt}</span>
              {value === opt && <span className="text-green-500 font-bold text-base leading-none">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function normalize(val, min, max) {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (val - min) / (max - min)));
}

function scoreToColor(norm, higherIsBetter) {
  const t    = higherIsBetter === false ? (1 - norm) : norm;
  // LandPortal-style warm gradient: light cream → amber → dark orange-red
  const hue  = Math.round(55 - t * 40);   // 55 (yellow) → 15 (red-orange)
  const sat  = Math.round(88 + t * 7);    // 88% → 95%
  const lght = Math.round(90 - t * 55);   // 90% (light) → 35% (dark)
  return `hsl(${hue}, ${sat}%, ${lght}%)`;
}

function HeatMap() {
  const mapRef     = useRef(null);
  const leafletMap = useRef(null);
  const choropleth = useRef(null);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [groupBy,    setGroupBy]    = useState('County');
  const [status,     setStatus]     = useState('Sold');
  const [timePeriod, setTimePeriod] = useState('1 year');
  const [dataType,   setDataType]   = useState('Land');
  const [acreage,    setAcreage]    = useState('All');
  const [statistic,  setStatistic]  = useState('Counts');

  // ── Map state ─────────────────────────────────────────────────────────────
  const [geojson,  setGeojson]  = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading,  setLoading]  = useState(true);

  // Derive active metric + config from filters
  const metric = getActiveMetric(statistic, status);
  const cfg    = METRIC_CONFIG[metric];

  // 1. Filter by acreage + data-type availability
  const filteredCounties = COUNTY_DATA.filter(c => {
    if (!ACREAGE_FILTER[acreage]?.(c))         return false;
    if (!(DATA_TYPE_FILTERS[dataType]?.(c)))   return false;
    if (dataType === 'Land' && c.medianPpa > 500000) return false; // exclude extreme urban $/ac
    return true;
  });

  // 2. Apply per-type metric adjustments + time-period scaling
  const timeFactor = TIME_FACTOR[timePeriod] ?? 1.0;

  const displayCounties = applyDataType(filteredCounties, dataType).map(c => {
    // Shorter periods show more market volatility: growing markets look hotter,
    // declining markets look cooler relative to the annual average.
    const volatility = 1 - timeFactor;           // 0 at "1 year", ~0.98 at "7 days"
    const g = Math.max(-2, Math.min(4, c.popGrowth));
    const activityBoost = g >  0.5 ? 1 + volatility * 0.30 * (g / 4)
                        : g < -0.3 ? 1 - volatility * 0.22 * Math.abs(g / 3)
                        : 1 + volatility * 0.02;
    const priceBoost = 1 + volatility * (g > 1 ? 0.07 : g < 0 ? -0.04 : 0.01);
    return {
      ...c,
      absorptionRate:  +(c.absorptionRate * activityBoost).toFixed(1),
      sellThrough:     +(c.sellThrough    * activityBoost).toFixed(1),
      medianDOM:       Math.round(c.medianDOM  / activityBoost),
      medianSalePrice: Math.round(c.medianSalePrice * priceBoost),
      medianPpa:       Math.round(c.medianPpa       * priceBoost),
    };
  });

  const values = displayCounties.map(c => c[metric]).filter(v => v != null);
  const minV   = values.length ? Math.min(...values) : 0;
  const maxV   = values.length ? Math.max(...values) : 1;

  // Load NC+SC county boundaries from CDN
  useEffect(() => {
    setLoading(true);
    fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json')
      .then(r => r.json())
      .then(async us => {
        const { feature } = await import('topojson-client');
        const gj = feature(us, us.objects.counties);
        setGeojson({
          ...gj,
          features: gj.features.filter(f =>
            String(f.id).startsWith('37') || String(f.id).startsWith('45')
          ),
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Init Leaflet
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;
    const map = L.map(mapRef.current, {
      center: [35.0, -79.8], zoom: 7,
      zoomControl: true, attributionControl: false,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',   { maxZoom: 19 }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
    leafletMap.current = map;
    return () => { map.remove(); leafletMap.current = null; };
  }, []);

  // Redraw choropleth when filters or geojson change
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !geojson) return;
    if (choropleth.current) { choropleth.current.remove(); choropleth.current = null; }

    const layer = L.geoJSON(geojson, {
      style: (feature) => {
        const fips   = String(feature.id).padStart(5, '0');
        const county = displayCounties.find(c => c.fips === fips);
        if (!county || county[metric] == null) {
          return { fillColor: '#e5e7eb', fillOpacity: 0.45, color: '#fff', weight: 0.8 };
        }
        const norm  = normalize(county[metric], minV, maxV);
        const color = scoreToColor(norm, cfg.higherIsBetter);
        return { fillColor: color, fillOpacity: 0.82, color: '#fff', weight: 0.8 };
      },
      onEachFeature: (feature, lyr) => {
        const fips   = String(feature.id).padStart(5, '0');
        const county = displayCounties.find(c => c.fips === fips);
        lyr.on({
          mouseover: (e) => {
            e.target.setStyle({ weight: 2.5, color: '#16a34a', fillOpacity: 0.95 });
            if (county) {
              const val     = county[metric] != null ? cfg.fmt(county[metric]) : '–';
              const timeVal = statistic === 'Counts'
                ? `~${Math.round(county.absorptionRate * timeFactor * 8)} est. transactions`
                : timePeriod;
              e.target.bindTooltip(
                `<strong>${county.name} County, ${county.state}</strong><br/>${cfg.label}: <strong>${val}</strong><br/><span style="color:#888;font-size:11px">${dataType} · ${timeVal}</span>`,
                { sticky: true, className: 'leaflet-tooltip-custom' }
              ).openTooltip();
            }
          },
          mouseout: (e) => { layer.resetStyle(e.target); e.target.unbindTooltip(); },
          click:    ()  => { if (county) setSelected(county); },
        });
      },
    });
    layer.addTo(map);
    choropleth.current = layer;
  }, [geojson, metric, displayCounties, minV, maxV, cfg, statistic, timeFactor, timePeriod, dataType]);

  // ── Info text per statistic (for "What is X?" tooltip) ──────────────────
  const statInfo = {
    Counts:                    'Estimated number of transactions in the selected time period based on absorption rate.',
    'Median Price':            'Total median sale price of land parcels closed in the selected period.',
    'Median Price/Acre':       'Median price per acre — lower values indicate larger, rural parcels.',
    'Sell Through Rate (STR)': 'Percentage of listed properties that sold (sell-through rate).',
    'Days on Market':          'Median days a parcel sits on market before going under contract.',
  };
  const [showStatInfo, setShowStatInfo] = useState(false);

  return (
    <div className="space-y-0 -mx-1">

      {/* ── LandPortal-style Filter Bar ──────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-t-xl shadow-sm">

        {/* Row 1 */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 flex-wrap">
          {/* County / State toggle */}
          <div className="flex mr-1">
            {['County', 'State'].map(v => (
              <button key={v}
                onClick={() => setGroupBy(v)}
                className={`px-4 py-1.5 text-sm font-semibold transition-all first:rounded-l-lg last:rounded-r-lg border
                  ${groupBy === v
                    ? 'bg-green-500 text-white border-green-500 z-10'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                {v}
              </button>
            ))}
          </div>

          {/* Status toggle (Sold / For Sale) */}
          <div className="flex mr-1">
            {['Sold', 'For Sale'].map(s => (
              <button key={s}
                onClick={() => setStatus(s)}
                className={`px-3.5 py-1.5 text-sm font-semibold transition-all first:rounded-l-lg last:rounded-r-lg border
                  ${status === s
                    ? 'bg-green-500 text-white border-green-500 z-10'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                {s}
              </button>
            ))}
          </div>

          <FilterDropdown label="Time" value={timePeriod} onChange={setTimePeriod}
            options={['7 days','14 days','30 days','90 days','6 months','1 year','2 years','3 years','5 years']} />
          <FilterDropdown label="Data" value={dataType} onChange={v => { setDataType(v); setSelected(null); }}
            options={['All','Land','House','Townhouse','Condo','MultiFamily']} />

          <div className="ml-auto flex items-center gap-3 text-xs text-gray-400">
            <span>{displayCounties.length} counties shown</span>
          </div>
        </div>

        {/* Row 2 */}
        <div className="flex items-center gap-2 px-4 py-2 flex-wrap">
          <FilterDropdown label="Acreages" value={acreage} onChange={setAcreage}
            options={['All','0-1 acre','1-2 acres','2-5 acres','5-10 acres','10-20 acres','20-50 acres','50-70 acres','70-100 acres','100-150 acres','150+ acres']} />
          <FilterDropdown label="Statistics" value={statistic} onChange={setStatistic}
            options={['Counts','Median Price','Median Price/Acre','Days on Market','Sell Through Rate (STR)']} />

          {/* What is X? info */}
          <div className="relative flex items-center gap-1.5 ml-1">
            <button
              onMouseEnter={() => setShowStatInfo(true)}
              onMouseLeave={() => setShowStatInfo(false)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Info size={13} className="text-gray-400" />
              <span>What is {statistic}?</span>
            </button>
            {showStatInfo && (
              <div className="absolute left-0 top-6 z-[3000] bg-gray-900 text-white text-xs rounded-xl px-3.5 py-2.5 w-60 shadow-2xl leading-relaxed">
                {statInfo[statistic]}
              </div>
            )}
          </div>

          {/* Metric override pills */}
          <div className="ml-auto flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-gray-400 mr-1">Color by:</span>
            {Object.entries(METRIC_CONFIG).map(([key, { label }]) => (
              <button key={key}
                onClick={() => {
                  const toStat = {
                    absorptionRate:'Counts', monthsSupply:'Counts',
                    medianSalePrice:'Value', medianIncome:'Value',
                    medianPpa:'$/Acre', sellThrough:'Sell Rate',
                    medianDOM:'DOM', oppScore:'Counts', demandScore:'Counts', popGrowth:'Counts',
                  };
                  if (toStat[key]) setStatistic(toStat[key]);
                }}
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all
                  ${metric === key
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Map + Side Panel ─────────────────────────────────────────────── */}
      <div className="flex border-x border-b border-gray-200 rounded-b-xl overflow-hidden shadow-sm bg-white" style={{ height: 580 }}>

        {/* Map */}
        <div className="relative flex-1 overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10">
              <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-gray-400 font-medium">Loading county boundaries…</p>
            </div>
          )}
          <div ref={mapRef} style={{ height: '100%', width: '100%' }} />

          {/* Legend — bottom left, LandPortal style */}
          <div className="absolute bottom-5 left-5 z-[1000] bg-white/95 backdrop-blur-sm rounded-xl border border-gray-200 shadow-lg px-4 py-3 pointer-events-none min-w-[180px]">
            <p className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">{cfg.label}</p>
            <div className="relative h-3 rounded-full overflow-hidden mb-1.5" style={{
              background: cfg.higherIsBetter === false
                ? 'linear-gradient(to right, hsl(55,88%,90%), hsl(35,93%,62%), hsl(15,95%,35%))'
                : 'linear-gradient(to right, hsl(55,88%,90%), hsl(35,93%,62%), hsl(15,95%,35%))',
            }} />
            <div className="flex justify-between text-xs text-gray-500">
              <span>{values.length ? cfg.fmt(cfg.higherIsBetter === false ? maxV : minV) : '–'}</span>
              <span className="text-gray-400">→</span>
              <span>{values.length ? cfg.fmt(cfg.higherIsBetter === false ? minV : maxV) : '–'}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1.5 border-t border-gray-100 pt-1.5">
              {status} · {timePeriod} · {dataType}
            </p>
          </div>

          {/* Stat badge — top right, shows active filter context */}
          <div className="absolute top-4 right-4 z-[1000] bg-white/95 backdrop-blur-sm rounded-xl border border-gray-200 shadow-md px-3 py-2">
            <p className="text-xs text-gray-500 font-medium">{statistic} · {acreage === 'All' ? 'All Sizes' : acreage}</p>
            <p className="text-base font-bold text-gray-800 tabular-nums">
              {displayCounties.length} <span className="text-xs font-normal text-gray-400">counties</span>
            </p>
          </div>
        </div>

        {/* Right panel — county detail (appears on click) */}
        <div className={`flex-shrink-0 border-l border-gray-200 overflow-y-auto transition-all duration-300 bg-white ${selected ? 'w-72' : 'w-0'}`}>
          {selected && (
            <div className="p-5 space-y-4 min-w-[288px]">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-0.5">
                    {selected.state} · {dataType} · {selected.priority ? '★ Priority' : 'County'}
                  </p>
                  <h3 className="text-lg font-bold text-gray-900 leading-tight">{selected.name} County</h3>
                </div>
                <button onClick={() => setSelected(null)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0 mt-0.5">
                  <X size={14} />
                </button>
              </div>

              {/* Active metric highlight */}
              <div className="rounded-xl border-2 border-green-200 bg-green-50 px-4 py-3">
                <p className="text-xs text-green-700 font-medium mb-0.5">{cfg.label}</p>
                <p className="text-2xl font-bold text-green-800 tabular-nums">
                  {selected[metric] != null ? cfg.fmt(selected[metric]) : '–'}
                </p>
                {statistic === 'Counts' && (
                  <p className="text-xs text-green-600 mt-1">
                    ~{Math.round(selected.absorptionRate * timeFactor * 8)} est. in {timePeriod}
                  </p>
                )}
              </div>

              {/* Score row */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Opp Score</p>
                  <p className={`text-xl font-bold tabular-nums ${selected.oppScore >= 70 ? 'text-green-600' : selected.oppScore >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                    {selected.oppScore}
                  </p>
                  <p className="text-xs text-gray-400">/100</p>
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Demand</p>
                  <p className={`text-xl font-bold tabular-nums ${selected.demandScore >= 70 ? 'text-green-600' : selected.demandScore >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                    {selected.demandScore}
                  </p>
                  <p className="text-xs text-gray-400">/100</p>
                </div>
              </div>

              {/* Data grid */}
              <div className="space-y-0 rounded-xl border border-gray-200 overflow-hidden">
                {[
                  { label: 'Median Sale Price', value: fmtK(selected.medianSalePrice) },
                  { label: 'Days on Market',    value: selected.medianDOM + ' days' },
                  { label: 'Months of Supply',  value: selected.monthsSupply.toFixed(1) + ' mo' },
                  { label: 'Absorption Rate',   value: fmtPct(selected.absorptionRate) },
                  { label: 'Sell-Through',       value: fmtPct(selected.sellThrough) },
                  { label: 'Pop. Growth',        value: fmtPct(selected.popGrowth), highlight: selected.popGrowth >= 2 ? 'text-green-600' : selected.popGrowth < 0 ? 'text-red-500' : '' },
                  { label: 'Median Income',      value: fmtK(selected.medianIncome) },
                  { label: 'Unemployment',       value: fmtPct(selected.unemployment) },
                  { label: '$ / Acre',           value: selected.medianPpa != null ? '$' + Math.round(selected.medianPpa).toLocaleString() : '–' },
                ].map(({ label, value, highlight }, i) => (
                  <div key={label} className={`flex items-center justify-between px-3 py-2.5 text-xs ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}`}>
                    <span className="text-gray-500">{label}</span>
                    <span className={`font-semibold text-gray-800 tabular-nums ${highlight || ''}`}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Tags */}
              <div className="flex gap-2 flex-wrap">
                {selected.mhFriendly && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                    MH Friendly
                  </span>
                )}
                {selected.priority && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                    ★ Priority Market
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Rankings Table ────────────────────────────────────────────────── */}
      <div className="mt-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <p className="text-sm font-bold text-gray-800">{cfg.label} — Top Counties</p>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{statistic} · {status} · {timePeriod}</span>
          </div>
          <span className="text-xs text-gray-400">{displayCounties.length} shown</span>
        </div>
        <div className="overflow-x-auto">
          <div className="grid divide-y divide-gray-50" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {[...displayCounties]
              .filter(c => c[metric] != null)
              .sort((a, b) => cfg.higherIsBetter === false ? a[metric] - b[metric] : b[metric] - a[metric])
              .slice(0, 30)
              .map((c, i) => {
                const norm  = normalize(c[metric], minV, maxV);
                const color = scoreToColor(norm, cfg.higherIsBetter);
                const barW  = Math.round(norm * 100);
                return (
                  <div key={c.fips}
                    onClick={() => setSelected(c)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50/80 transition-colors group ${selected?.fips === c.fips ? 'bg-green-50/60' : ''}`}>
                    <span className="text-xs text-gray-400 w-6 text-right font-mono tabular-nums flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-green-700 transition-colors">
                        {c.name} <span className="font-normal text-gray-400 text-xs">{c.state}</span>
                      </p>
                      <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: barW + '%', backgroundColor: color }} />
                      </div>
                    </div>
                    <span className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color }}>{cfg.fmt(c[metric])}</span>
                    {c.priority && <span className="text-amber-400 flex-shrink-0 text-xs">★</span>}
                  </div>
                );
              })}
          </div>
        </div>
        {displayCounties.length > 30 && (
          <div className="px-5 py-3 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">Showing top 30 of {displayCounties.length} counties · Use Market Stats tab for full table</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'heatmap',  label: 'Heat Map',      icon: Map        },
  { id: 'analyzer', label: 'Deal Analyzer', icon: Calculator },
  { id: 'stats',    label: 'Market Stats',  icon: TrendingUp },
  { id: 'comps',    label: 'Comp Finder',   icon: Search     },
];

export default function MarketResearch() {
  const [activeTab, setActiveTab] = useState('heatmap');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-sidebar">Market Research</h1>
        <p className="text-sm text-gray-500 mt-1">Analyze deals, compare county markets, and find comparable sales.</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === id ? 'bg-white text-sidebar shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'heatmap'  && <HeatMap />}
      {activeTab === 'analyzer' && <DealAnalyzer />}
      {activeTab === 'stats'    && <MarketStats />}
      {activeTab === 'comps'    && <CompFinder />}
    </div>
  );
}
