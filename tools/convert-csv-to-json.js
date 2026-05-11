const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

const DISTRICTS_CSV = path.join(DATA_DIR, "source-district-representatives.csv");
const OVERVIEW_CSV = path.join(DATA_DIR, "source-congress-overview.csv");

const DISTRICTS_JSON = path.join(DATA_DIR, "districts.json");
const REPRESENTATIVES_JSON = path.join(DATA_DIR, "representatives.json");
const OVERVIEW_JSON = path.join(DATA_DIR, "congress_overview.json");

const ALL_CONGRESSES = [
  "8th Congress",
  "9th Congress",
  "10th Congress",
  "11th Congress",
  "12th Congress",
  "13th Congress",
  "14th Congress",
  "15th Congress",
  "16th Congress",
  "17th Congress",
  "18th Congress",
  "19th Congress",
  "20th Congress"
];

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (cell || row.length) {
        row.push(cell.trim());
        rows.push(row);
      }

      row = [];
      cell = "";

      if (char === "\r" && next === "\n") {
        i++;
      }
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows.filter(r => r.some(c => String(c || "").trim()));
}

function cleanKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeCongress(value) {
  const raw = String(value || "").trim();

  const match = raw.match(/^(\d+)(?:st|nd|rd|th)?\s*Congress$/i);
  if (!match) return raw;

  const n = Number(match[1]);

  let suffix = "th";
  if (n % 100 < 11 || n % 100 > 13) {
    if (n % 10 === 1) suffix = "st";
    if (n % 10 === 2) suffix = "nd";
    if (n % 10 === 3) suffix = "rd";
  }

  return `${n}${suffix} Congress`;
}

function splitNames(value) {
  return String(value || "")
    .split(/\s*;\s*|\n+/)
    .map(v => v.trim())
    .filter(Boolean);
}

function makeId(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function surnameOf(name) {
  const value = String(name || "").trim();

  if (!value) return "Unknown";

  if (value.includes(",")) {
    return value.split(",")[0].trim();
  }

  return value.split(/\s+/)[0].trim();
}

function readCSV(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing CSV file: ${filePath}`);
  }

  return parseCSV(fs.readFileSync(filePath, "utf8"));
}

function convertDistricts() {
  const rows = readCSV(DISTRICTS_CSV);

  const header = rows[0];
  const body = rows.slice(1);

  const regionIndex = 0;
  const districtIndex = 1;

  const congressColumns = header
    .map((column, index) => ({
      index,
      congress: normalizeCongress(column)
    }))
    .filter(item => ALL_CONGRESSES.includes(item.congress));

  const districts = body
    .filter(row => row[regionIndex] && row[districtIndex])
    .map(row => {
      const history = {};

      congressColumns.forEach(({ index, congress }) => {
        const names = splitNames(row[index]);

        if (names.length) {
          history[congress] = names;
        }
      });

      return {
        region: row[regionIndex],
        district: row[districtIndex],
        history
      };
    });

  return districts;
}

function buildRepresentativesFromDistricts(districts) {
  const people = new Map();

  districts.forEach(district => {
    Object.entries(district.history || {}).forEach(([congress, names]) => {
      names.forEach(name => {
        const id = makeId(name);

        if (!people.has(id)) {
          people.set(id, {
            id,
            name,
            surname: surnameOf(name),
            aliases: [],
            congresses: [],
            regions: [],
            districts: [],
            terms: []
          });
        }

        const person = people.get(id);

        if (!person.congresses.includes(congress)) {
          person.congresses.push(congress);
        }

        if (!person.regions.includes(district.region)) {
          person.regions.push(district.region);
        }

        if (!person.districts.includes(district.district)) {
          person.districts.push(district.district);
        }

        person.terms.push({
          congress,
          region: district.region,
          district: district.district,
          name_used: name
        });
      });
    });
  });

  return Array.from(people.values())
    .map(person => ({
      ...person,
      congresses: person.congresses.sort((a, b) => parseInt(a) - parseInt(b)),
      term_count: person.congresses.length
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function convertOverview() {
  if (!fs.existsSync(OVERVIEW_CSV)) {
    return [];
  }

  const rows = readCSV(OVERVIEW_CSV);
  const header = rows[0].map(cleanKey);

  return rows.slice(1).map(row => {
    const item = {};

    header.forEach((key, index) => {
      item[key || `column_${index + 1}`] = row[index] || "";
    });

    return item;
  });
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  console.log(`Wrote ${path.relative(process.cwd(), filePath)}`);
}

function main() {
  const districts = convertDistricts();
  const representatives = buildRepresentativesFromDistricts(districts);
  const overview = convertOverview();

  writeJSON(DISTRICTS_JSON, districts);
  writeJSON(REPRESENTATIVES_JSON, representatives);
  writeJSON(OVERVIEW_JSON, overview);

  console.log("");
  console.log("CSV to JSON conversion complete.");
  console.log(`Districts: ${districts.length}`);
  console.log(`Representatives: ${representatives.length}`);
  console.log(`Congress overview rows: ${overview.length}`);
}

main();
