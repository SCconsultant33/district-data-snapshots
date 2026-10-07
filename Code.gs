/** Live Google Sheets adapter. Only the three display fields leave the server. */
const CONFIG = Object.freeze({
  spreadsheetId: '1MUUcwT7SFizDAqoZmbU3GZmz-GyDhXQnd7-G0XvgRyw',
  responseTab: 'Form Responses 1',
  headerRow: 1,
  headers: {
    timestamp: 'Timestamp',
    district: 'District',
    level: 'Level',
    role: 'Which role has primary responsibility for coordinating EDP activities at your building?'
  },
  // Add only verified aliases if district labels change, e.g. 'Avondale School District': 'Avondale'.
  districtAliases: {}
});

const DISTRICTS = Object.freeze([
  'Avondale', 'Berkley', 'Birmingham', 'Bloomfield Hills', 'Brandon',
  'Clarenceville', 'Clarkston', 'Clawson', 'Farmington', 'Ferndale',
  'Hazel Park', 'Holly', 'Huron Valley', 'Lake Orion', 'Lamphere',
  'Madison', 'Novi', 'Oak Park', 'Oxford', 'Pontiac', 'Rochester',
  'Royal Oak', 'South Lyon', 'Southfield', 'Troy', 'Walled Lake',
  'Waterford', 'West Bloomfield'
]);

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('District Data Snapshot: Counselor Career Tasks');
}

function getDashboardData() {
  try {
    // The Advanced Sheets service supports the read-only OAuth scope.
    const tab = "'" + CONFIG.responseTab.replace(/'/g, "''") + "'";
    const headerRange = tab + '!' + CONFIG.headerRow + ':' + CONFIG.headerRow;
    const headerResult = Sheets.Spreadsheets.Values.get(
      CONFIG.spreadsheetId, headerRange, {valueRenderOption: 'FORMATTED_VALUE'}
    );
    const headers = (headerResult.values || [])[0] || [];
    const columns = resolveHeaders_(headers, CONFIG.headers);
    const fields = Object.keys(columns);
    // Read only mapped columns, including Timestamp to identify submissions.
    // Email addresses and open-ended answers are neither read nor returned.
    const ranges = fields.map(field => {
      const column = columnLetter_(columns[field] + 1);
      return tab + '!' + column + (CONFIG.headerRow + 1) + ':' + column;
    });
    const result = Sheets.Spreadsheets.Values.batchGet(CONFIG.spreadsheetId, {
      ranges, valueRenderOption: 'FORMATTED_VALUE', majorDimension: 'ROWS'
    });
    const values = {};
    fields.forEach((field, i) => {
      const range = (result.valueRanges || [])[i] || {};
      values[field] = (range.values || []).map(row => row[0] == null ? '' : row[0]);
    });
    // The API omits trailing blanks separately for each column.
    const count = Math.max(0, ...fields.map(field => values[field].length));
    const rows = Array.from({length: count}, (_, i) => ({
      timestamp: values.timestamp[i], district: values.district[i],
      level: values.level[i], role: values.role[i]
    }));
    return summarize_(rows, CONFIG.districtAliases, new Date().toISOString());
  } catch (error) {
    // Do not expose Google exceptions, response values, or internal identifiers to viewers.
    console.error('Dashboard read failed: ' + error.message);
    throw new Error('Unable to load current sheet data. The dashboard will retry automatically. If this continues, ask the dashboard owner to check spreadsheet access, the enabled Google Sheets service, the response tab, and header mappings.');
  }
}

function columnLetter_(number) {
  let result = '';
  while (number > 0) {
    number--;
    result = String.fromCharCode(65 + number % 26) + result;
    number = Math.floor(number / 26);
  }
  return result;
}

function clean_(value) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
}
function key_(value) { return clean_(value).toLowerCase(); }

function resolveHeaders_(actual, expected) {
  const result = {};
  Object.keys(expected).forEach(field => {
    const matches = actual.map((header, i) => key_(header) === key_(expected[field]) ? i : -1)
      .filter(i => i >= 0);
    if (matches.length !== 1) {
      throw new Error('Expected exactly one configured header for ' + field + '.');
    }
    result[field] = matches[0];
  });
  if (new Set(Object.values(result)).size !== Object.keys(expected).length) {
    throw new Error('Header mappings must refer to different columns.');
  }
  return result;
}

function summarize_(input, aliases, refreshedAt) {
  const canonical = new Map(DISTRICTS.map(name => [key_(name), name]));
  const aliasMap = new Map(Object.keys(aliases).map(name => [key_(name), aliases[name]]));
  for (const target of aliasMap.values()) {
    if (!canonical.has(key_(target))) throw new Error('Alias target must be a reference district.');
  }
  const represented = new Set();
  const rows = input.filter(row => ['timestamp', 'district', 'level', 'role']
    .some(field => clean_(row[field]) !== '')).map(row => {
    const rawDistrict = clean_(row.district);
    const mapped = aliasMap.get(key_(rawDistrict)) || rawDistrict;
    const district = canonical.get(key_(mapped)) || rawDistrict || 'No response provided';
    if (canonical.has(key_(district))) represented.add(district);
    return {
      district,
      level: clean_(row.level) || 'No response provided',
      role: clean_(row.role) || 'No response provided'
    };
  });
  return {
    totalResponses: rows.length,
    districtsRepresented: represented.size,
    districtTotal: DISTRICTS.length,
    awaiting: DISTRICTS.filter(name => !represented.has(name))
      .sort((a, b) => a.localeCompare(b, 'en')),
    rows,
    refreshedAt
  };
}
