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
      ranges, valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'SERIAL_NUMBER', majorDimension: 'ROWS'
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

// Exact form choices and shorter display aliases. Unknown entered text is Other.
function displayRole_(value) {
  const answer = clean_(value);
  if (!answer) return 'No response provided';
  const labels = {
    'school counselor': 'School counselor',
    'career counselor': 'Career counselor',
    'career counselor (school counselor in a defined career-focused role)': 'Career counselor',
    'career development staff': 'Career development staff',
    'career development staff member in another role (e.g., specialist, technician, or paraprofessional)': 'Career development staff',
    'shared responsibility': 'Shared responsibility',
    'shared responsibility across roles': 'Shared responsibility',
    'other': 'Other'
  };
  return Object.prototype.hasOwnProperty.call(labels, key_(answer))
    ? labels[key_(answer)] : 'Other';
}

function displayLevel_(value) {
  const answer = clean_(value);
  if (!answer) return 'No response provided';
  const labels = {
    'high school': 'High School',
    'junior high': 'Junior High School',
    'junior high school': 'Junior High School',
    'middle': 'Middle School',
    'middle school': 'Middle School',
    'other': 'Other'
  };
  return Object.prototype.hasOwnProperty.call(labels, key_(answer))
    ? labels[key_(answer)] : 'Other';
}

function levelRank_(value) {
  const order = ['High School', 'Junior High School', 'Middle School', 'Other', 'No response provided'];
  const rank = order.indexOf(value);
  return rank < 0 ? order.length : rank;
}

// Sheets serials encode the spreadsheet's local calendar date, not browser time.
function responseDate_(value) {
  let serial = typeof value === 'number' ? value : NaN;
  if (typeof value === 'string') {
    const match = clean_(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: (\d{1,2}):(\d{2})(?::(\d{2}))?(?: (AM|PM))?)?$/i);
    if (match) {
      const month = +match[1], day = +match[2], year = +match[3];
      let hour = +(match[4] || 0);
      const minute = +(match[5] || 0), second = +(match[6] || 0);
      const meridiem = (match[7] || '').toUpperCase();
      if (meridiem) {
        if (hour < 1 || hour > 12) return null;
        hour = hour % 12 + (meridiem === 'PM' ? 12 : 0);
      }
      const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
      if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 ||
          date.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) return null;
      serial = date.getTime() / 86400000 + 25569;
    }
  }
  if (!Number.isFinite(serial) || serial <= 0 || serial >= 2958466) return null;
  const date = new Date((Math.floor(serial) - 25569) * 86400000);
  return {serial, date: date.toISOString().slice(0, 10)};
}

function summarize_(input, aliases, refreshedAt) {
  const canonical = new Map(DISTRICTS.map(name => [key_(name), name]));
  const aliasMap = new Map(Object.keys(aliases).map(name => [key_(name), aliases[name]]));
  for (const target of aliasMap.values()) {
    if (!canonical.has(key_(target))) throw new Error('Alias target must be a reference district.');
  }
  const represented = new Set();
  let latest = null;
  const rows = input.filter(row => ['timestamp', 'district', 'level', 'role']
    .some(field => clean_(row[field]) !== '')).map(row => {
    const parsed = responseDate_(row.timestamp);
    if (parsed && (!latest || parsed.serial > latest.serial)) latest = parsed;
    const rawDistrict = clean_(row.district);
    const mapped = aliasMap.get(key_(rawDistrict)) || rawDistrict;
    const district = canonical.get(key_(mapped)) ||
      (key_(rawDistrict) === 'public school academy' ? 'Public School Academy' :
        rawDistrict ? 'Other' : 'No response provided');
    if (canonical.has(key_(district))) represented.add(district);
    return {
      district,
      level: displayLevel_(row.level),
      role: displayRole_(row.role)
    };
  }).sort((a, b) => a.district.localeCompare(b.district, 'en') ||
    levelRank_(a.level) - levelRank_(b.level));
  return {
    mostRecentResponseDate: latest ? latest.date : null,
    totalResponses: rows.length,
    districtsRepresented: represented.size,
    districtTotal: DISTRICTS.length,
    awaiting: DISTRICTS.filter(name => !represented.has(name))
      .sort((a, b) => a.localeCompare(b, 'en')),
    rows,
    refreshedAt
  };
}
