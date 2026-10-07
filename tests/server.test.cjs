const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const context = vm.createContext({console});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../Code.gs'), 'utf8'), context);
const run = (code) => JSON.parse(JSON.stringify(vm.runInContext(code, context)));
const input = [
  {timestamp: '1', district: 'Avondale', level: 'High School', role: 'Counselor'},
  {timestamp: '2', district: 'Avondale', level: 'Middle School', role: 'Principal'},
  {timestamp: '3', district: 'Berkley', level: 'High School', role: ''},
  {timestamp: '4', district: 'Public School Academy', level: 'High School', role: 'Counselor'},
  {timestamp: '5', district: 'Other', level: 'Elementary', role: '<script>alert(1)</script>'},
  {timestamp: '6', district: '  birmingham  ', level: 'Elementary', role: 'Teacher'},
  {timestamp: '7', district: '', level: '', role: ''},
  {timestamp: '', district: '', level: '', role: ''}
];
context.input = input;
const result = run("summarize_(input, {}, '2026-10-07T16:00:00.000Z')");
test('submission count, duplicate rows, reference participation, blanks and privacy', () => {
  assert.equal(result.totalResponses, 7);
  assert.equal(result.districtsRepresented, 3);
  assert.equal(result.districtTotal, 28);
  assert.equal(result.rows.filter(r => r.district === 'Avondale').length, 2);
  assert.equal(result.rows[2].role, 'No response provided');
  assert.equal(result.rows[6].district, 'No response provided');
  assert.equal(result.rows[5].district, 'Birmingham');
  assert.equal(result.awaiting.length, 25);
  assert(!result.awaiting.includes('Other'));
  assert(!result.awaiting.includes('Public School Academy'));
  assert(!result.awaiting.includes('Avondale'));
  assert.deepEqual(result.awaiting, [...result.awaiting].sort((a,b)=>a.localeCompare(b,'en')));
  assert.deepEqual(Object.keys(result.rows[0]), ['district','level','role']);
});
test('all districts represented and empty dataset', () => {
  const all = run("summarize_(DISTRICTS.map(district => ({district, timestamp: '1'})), {}, 'now')");
  assert.equal(all.totalResponses, 28); assert.equal(all.districtsRepresented, 28);
  assert.deepEqual(all.awaiting, []);
  const empty = run("summarize_([], {}, 'now')");
  assert.equal(empty.totalResponses, 0); assert.equal(empty.districtsRepresented, 0);
  assert.equal(empty.awaiting.length, 28);
});
test('configured aliases; unknown labels cannot inflate participation', () => {
  const alias = run("summarize_([{district:'Avondale Schools'}, {district:'Unknown District'}], {'Avondale Schools':'Avondale'}, 'now')");
  assert.equal(alias.districtsRepresented, 1);
  assert.throws(()=>run("summarize_([], {'bad':'Unknown'}, 'now')"));
});
test('header mappings handle reordered columns; missing/ambiguous mappings fail', () => {
  assert.deepEqual(run("resolveHeaders_(['Level','District','Timestamp','Which role has primary responsibility for coordinating EDP activities at your building?'], CONFIG.headers)"), {timestamp:2, district:1, level:0, role:3});
  assert.throws(()=>run("resolveHeaders_(['District'], CONFIG.headers)"));
  assert.throws(()=>run("resolveHeaders_(['District',' district '], {district:'District'})"));
});
test('live adapter reads only mapped columns and rereads for new submissions', () => {
  let source = [['private@example.test', 'District', 'Level', 'Timestamp', 'Which role has primary responsibility for coordinating EDP activities at your building?', 'Open-ended answer'],
    ['hidden@example.test','Avondale','High School','today','Counselor','DO NOT RETURN']];
  const reads=[];
  context.Sheets={Spreadsheets:{Values:{
    get:(id,range,options)=>{
      assert.equal(id,'1MUUcwT7SFizDAqoZmbU3GZmz-GyDhXQnd7-G0XvgRyw');
      assert.equal(range,"'Form Responses 1'!1:1");
      assert.equal(options.valueRenderOption,'FORMATTED_VALUE');
      return {values:[source[0]]};
    },
    batchGet:(id,options)=>{
      assert.equal(id,'1MUUcwT7SFizDAqoZmbU3GZmz-GyDhXQnd7-G0XvgRyw');
      assert.equal(options.valueRenderOption,'FORMATTED_VALUE');
      return {valueRanges:options.ranges.map(range=>{
        reads.push(range);
        const match=range.match(/^'Form Responses 1'!([A-Z]+)2:\1$/);
        assert(match);
        const index=[...match[1]].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;
        const values=source.slice(1).map(row=>row[index] ? [row[index]] : []);
        while(values.length && !values.at(-1).length) values.pop();
        return values.length ? {values} : {};
      })};
    }
  }}};
  assert.equal(run('getDashboardData()').totalResponses,1);
  source.push(['hidden@example.test','Clawson','Middle School','today','','PRIVATE']);
  const next=run('getDashboardData()');
  assert.equal(next.totalResponses,2); assert.equal(next.districtsRepresented,2);
  assert.equal(next.rows[1].role,'No response provided');
  assert(reads.every(r=>/^'Form Responses 1'![B-E]2:[B-E]$/.test(r)));
  source=source.slice(0,1);
  assert.equal(run('getDashboardData()').totalResponses,0);
  assert(!JSON.stringify(next).includes('PRIVATE'));
});
test('read-only manifest, no SpreadsheetApp adapter, and A1 column conversion', () => {
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../appsscript.json'),'utf8'));
  assert.deepEqual(manifest.oauthScopes,['https://www.googleapis.com/auth/spreadsheets.readonly']);
  assert.equal(manifest.dependencies.enabledAdvancedServices[0].userSymbol,'Sheets');
  assert(!fs.readFileSync(path.join(__dirname,'../Code.gs'),'utf8').includes('SpreadsheetApp'));
  assert.deepEqual(run('[1,26,27,52,53,702,703].map(columnLetter_)'),['A','Z','AA','AZ','BA','ZZ','AAA']);
});
if (process.argv.includes('--fixtures')) {
  const next = run("summarize_(input.concat([{timestamp:'8', district:'Clawson', level:'High School', role:'Counselor'}]), {}, '2026-10-07T16:01:00.000Z')");
  const all = run("summarize_(DISTRICTS.map(district => ({district, timestamp:'1'})), {}, '2026-10-07T16:02:00.000Z')");
  const empty = run("summarize_([], {}, '2026-10-07T16:03:00.000Z')");
  fs.writeFileSync('/tmp/district-test-fixtures.json', JSON.stringify({initial:result,next,all,empty}));
}
