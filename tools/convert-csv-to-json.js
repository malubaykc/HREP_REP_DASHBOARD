#!/usr/bin/env node
/*
  Converts the two exported Google Sheets CSV files into local JSON.

  Input files:
    data/source-district-representatives.csv
    data/source-congress-overview.csv

  Output files:
    data/districts.json
    data/representatives.json
    data/congress_overview.json
*/

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const DISTRICTS_CSV = path.join(DATA, 'source-district-representatives.csv');
const OVERVIEW_CSV = path.join(DATA, 'source-congress-overview.csv');

const CONGRESSES = Array.from({ length: 13 }, (_, i) => {
  const n = i + 8;
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
  return `${n}${suffix} Congress`;
});
const congressOrder = Object.fromEntries(CONGRESSES.map((c, i) => [c, i]));

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (cell || row.length) {
        row.push(cell.trim());
        rows.push(row);
      }
      row = [];
      cell = '';
      if (ch === '\r' && next === '\n') i++;
    } else {
      cell += ch;
    }
  }

  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows;
}

function normCongress(value) {
  const s = String(value || '').trim();
  const match = s.match(/^(\d+)(?:st|nd|rd|th)?\s*congress$/i);
  if (!match) return s;

  const n = Number(match[1]);
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
  return `${n}${suffix} Congress`;
}

function cleanKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s*\/\s*/g, '_')
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '');
}

function cleanNumber(value) {
  const s = String(value || '').trim().replace(/,/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isNaN(n) ? value : n;
}

function splitNames(cell) {
  return String(cell || '')
    .split(/\s*;\s*|\n+/)
    .map(v => v.replace(/\s+/g, ' ').replace(/[ ,]+$/g, '').trim())
    .filter(Boolean);
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[“”"'][^“”"']*[“”"']/g, ' ')
    .replace(/\b(jr|sr|ii|iii|iv|v|vi|md|dpa|phd|rn)\.?\b/g, ' ')
    .replace(/[^a-z0-9,\s.-]+/g, ' ')
    .replace(/[.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function personKey(name) {
  const suffixWords = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v', 'vi', 'md', 'dpa', 'phd', 'rn']);
  const weakFirst = new Set(['ma', 'maria', 'jr', 'sr']);
  const n = normalizeText(name);
  if (!n) return '';

  if (n.includes(',')) {
    const [surname, rest] = n.split(',', 2);
    const tokens = rest.split(/\s+/).filter(t => t && !suffixWords.has(t));
    let first = tokens.find(t => !weakFirst.has(t)) || tokens[0] || '';
    return `${surname.trim()}|${first}`.replace(/\|$/g, '');
  }

  const tokens = n.split(/\s+/).filter(t => t && !suffixWords.has(t));
  if (tokens.length >= 2) return `${tokens[0]}|${tokens[tokens.length - 1]}`;
  return n;
}

function readRequired(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Missing file: ${filePath}`);
    process.exit(1);
  }
  return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
}

function buildOverview() {
  const rows = parseCSV(readRequired(OVERVIEW_CSV));
  const header = rows[0] || [];

  return rows.slice(1).filter(row => row.some(Boolean) && row[0]).map(row => {
    const obj = {};
    const notes = [];
    header.forEach((h, i) => {
      if (!h.trim()) {
        if ((row[i] || '').trim()) notes.push(row[i]);
        return;
      }
      const key = cleanKey(h);
      let val = row[i] || '';
      if (['members', 'district_seats', 'party_list_sectoral_seats', 'theoretical_seats', 'seat_difference'].includes(key)) {
        val = cleanNumber(val);
      }
      obj[key] = val;
    });
    obj.notes = notes.join('\n');
    obj.period_normalized = normCongress(obj.period);
    return obj;
  });
}

function buildDistrictsAndRepresentatives() {
  const rows = parseCSV(readRequired(DISTRICTS_CSV));
  const header = rows[0] || [];
  const congressCols = header.map((h, i) => [i, normCongress(h)]).filter(([, c]) => CONGRESSES.includes(c));
  const districts = [];
  const people = new Map();

  rows.slice(1).forEach(row => {
    if (!row.some(Boolean)) return;

    const region = row[0] || '';
    const district = row[1] || '';
    if (!region || !district) return;

    const history = {};

    congressCols.forEach(([index, congress]) => {
      const names = splitNames(row[index]);
      if (!names.length) return;
      history[congress] = names;

      names.forEach(name => {
        const key = personKey(name);
        if (!key) return;

        if (!people.has(key)) {
          people.set(key, {
            id: slugify(key),
            name,
            aliases: [],
            congresses: [],
            terms: [],
            regions: [],
            districts: []
          });
        }

        const person = people.get(key);
        if (name !== person.name && !person.aliases.includes(name)) person.aliases.push(name);
        if (!person.congresses.includes(congress)) person.congresses.push(congress);
        if (!person.regions.includes(region)) person.regions.push(region);
        if (!person.districts.includes(district)) person.districts.push(district);
        person.terms.push({ congress, region, district, name_used: name });
      });
    });

    districts.push({ region, district, history });
  });

  const representatives = Array.from(people.values()).map(person => {
    person.congresses.sort((a, b) => (congressOrder[a] ?? 999) - (congressOrder[b] ?? 999));
    person.terms.sort((a, b) => (congressOrder[a.congress] ?? 999) - (congressOrder[b.congress] ?? 999));
    person.term_count = person.congresses.length;
    person.first_congress = person.congresses[0] || '';
    person.last_congress = person.congresses[person.congresses.length - 1] || '';
    return person;
  }).sort((a, b) => a.name.localeCompare(b.name));

  districts.sort((a, b) => `${a.region} ${a.district}`.localeCompare(`${b.region} ${b.district}`));

  return { districts, representatives };
}

const overview = buildOverview();
const { districts, representatives } = buildDistrictsAndRepresentatives();

fs.writeFileSync(path.join(DATA, 'congress_overview.json'), JSON.stringify(overview, null, 2));
fs.writeFileSync(path.join(DATA, 'districts.json'), JSON.stringify(districts, null, 2));
fs.writeFileSync(path.join(DATA, 'representatives.json'), JSON.stringify(representatives, null, 2));

console.log(`Created data/congress_overview.json (${overview.length} rows)`);
console.log(`Created data/districts.json (${districts.length} rows)`);
console.log(`Created data/representatives.json (${representatives.length} representatives)`);
