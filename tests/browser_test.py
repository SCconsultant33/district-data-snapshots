"""Chromium tests of the actual HTML using an explicitly mocked Apps Script bridge."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = json.loads(Path('/tmp/district-test-fixtures.json').read_text())
HTML = (ROOT / 'Index.html').read_text()
BRIDGE = """
window.fixture = __FIXTURE__;
window.calls = 0;
window.copiedText = '';
Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{writeText:async text => {window.copiedText = text;}}});
window.replyMode = 'success';
window.google = {script: {run: {
  withSuccessHandler(fn) { this.success = fn; return this; },
  withFailureHandler(fn) { this.failure = fn; return this; },
  getDashboardData() {
    window.calls++;
    const success = this.success, failure = this.failure;
    if (window.replyMode === 'hold') return;
    if (window.replyMode === 'error') { failure(new Error('fixture failure')); return; }
    success(window.fixture);
  }
}}};
"""

def load(page, fixture):
    bridge = BRIDGE.replace('__FIXTURE__', json.dumps(fixture).replace('<', '\\u003c'))
    page.set_content(HTML.replace('<script>', '<script>' + bridge, 1))

def check(page, selector, expected):
    actual = page.locator(selector).inner_text()
    assert actual == expected, (selector, actual, expected)

HEADERS = ['District', 'School Level', 'Role with Primary Responsibility for EDP Coordination']
def expected_copy(rows):
    return '\n'.join(['\t'.join(HEADERS)] + ['\t'.join(row[key] for key in ['district','level','role']) for row in rows])

def role(page, name):
    return page.locator('#role-chart li').filter(has=page.get_by_text(name, exact=True))

def overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Horizontal page overflow'
    assert page.evaluate("[...document.querySelectorAll('th,td')].every(e => e.scrollWidth <= e.clientWidth + 1)"), 'Cell text overflow'

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
    page = browser.new_page(viewport={'width': 1200, 'height': 900})
    errors=[]
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.clock.install()
    load(page, FIXTURES['initial'])
    check(page, '#total', '7')
    check(page, '#represented', '3 of 28')
    assert page.locator('#copy-table').is_enabled()
    page.click('#copy-table')
    assert page.evaluate('window.copiedText') == expected_copy(FIXTURES['initial']['rows'])
    check(page, '#copy-status', 'Copied header and 7 response rows.')
    assert page.evaluate('document.activeElement.id') == 'copy-table'
    assert page.locator('#copy-table').get_attribute('aria-label') == 'Copy individual response table'
    assert page.locator('#refresh, #refreshed').count() == 0
    check(page, '#most-recent', '10/7/2026')
    check(page, '#aggregate-heading', 'Aggregated Response Data')
    check(page, '#responses', 'Individual Responses')
    check(page, '#role-heading', 'Role with Primary Responsibility for EDP Coordination')
    assert 'Response details' not in page.locator('body').inner_text()
    assert 'Responses reflect reported' not in page.locator('body').inner_text()
    assert page.locator('#role-summary').is_hidden()
    assert page.locator('#rows').evaluate("e => e.closest('section').id") == 'individual-section'
    assert page.locator('#role-chart').evaluate("e => e.closest('section').id") == 'response-section'
    link=page.locator('.submit-card')
    assert link.get_attribute('target') == '_blank'
    assert link.get_attribute('rel') == 'noopener noreferrer'
    assert link.get_attribute('href') == 'https://docs.google.com/forms/d/e/1FAIpQLSdmKski7E6IwdQmCuMvX4GXt2oktjThlhbXTtLcCviezOgmrA/viewform'
    heights=page.locator('.cards > *').evaluate_all('elements => elements.map(e=>e.getBoundingClientRect().height)')
    assert max(heights)-min(heights) < 1
    assert page.locator('#role-chart .role-name').all_inner_texts() == ['School counselor','Career counselor','Career development staff','Shared responsibility','Other','No response provided']
    colors={name:role(page,name).locator('.bar-fill').evaluate('e=>getComputedStyle(e).backgroundColor') for name in ['School counselor','Career counselor','Career development staff','Shared responsibility','Other']}
    assert len(set(colors.values()))==5
    assert page.locator('#rows tr').evaluate_all("elements => elements.map(e=>e.children[0].innerText)") == [r['district'] for r in FIXTURES['initial']['rows']]
    assert page.locator('.description').inner_text() == 'This district snapshot is seeking to better understand school counselor responsibilities and expectations related to Educational Development Plan (EDP) administration and other career-related tasks.'
    assert page.evaluate("document.getElementById('awaiting-heading').compareDocumentPosition(document.getElementById('responses')) & Node.DOCUMENT_POSITION_FOLLOWING")
    assert page.locator('#awaiting-list').evaluate("e => getComputedStyle(e).columnCount") == '4'
    assert page.locator('#role-chart li').count() == 6
    check(page, '#role-chart li:first-child .role-name', 'School counselor')
    check(page, '#role-chart li:first-child .role-count', '2 responses (28.6%)')
    assert abs(float(page.locator('#role-chart li:first-child .bar-fill').evaluate('e => parseFloat(e.style.width)')) - 200/7) < .001
    assert page.locator('#role-chart script').count() == 0
    assert page.locator('#rows tr').count() == 7
    assert page.locator('#awaiting-list li').count() == 25
    assert page.locator('#rows').inner_text().count('Avondale') == 2
    assert '<script>' not in page.locator('#rows').inner_text()
    assert 'Elementary' not in page.locator('#rows').inner_text()
    assert page.locator('#rows script').count() == 0
    page.select_option('#district', 'Avondale')
    page.select_option('#level', 'High School')
    check(page, '#result-count', '1 of 7 responses shown.')
    page.click('#copy-table')
    filtered=[r for r in FIXTURES['initial']['rows'] if r['district']=='Avondale' and r['level']=='High School']
    assert page.evaluate('window.copiedText') == expected_copy(filtered)
    check(page, '#copy-status', 'Copied header and 1 response row.')
    check(page, '#most-recent', '10/7/2026')
    assert role(page,'School counselor').locator('.bar-fill').evaluate('e=>getComputedStyle(e).backgroundColor') == colors['School counselor']
    assert page.locator('#role-chart li').count() == 5
    assert role(page, 'School counselor').locator('.role-count').inner_text() == '1 response (100%)'
    assert role(page, 'Career counselor').locator('.role-count').inner_text() == '0 responses (0%)'
    check(page, '#total', '7')
    check(page, '#represented', '3 of 28')
    page.select_option('#district', 'Berkley')
    check(page, '#rows td:nth-child(3)', 'No response provided')
    assert role(page, 'No response provided').locator('.role-count').inner_text() == '1 response (100%)'
    page.select_option('#level', 'Other')
    check(page, '#rows', 'No responses match the selected filters.')
    page.click('#copy-table')
    assert page.evaluate('window.copiedText') == '\t'.join(HEADERS)
    assert 'No responses match' not in page.evaluate('window.copiedText')
    assert page.locator('#role-chart li').count() == 0
    check(page, '#role-summary', 'No responses match the selected filters.')
    page.click('#reset')
    assert page.input_value('#district') == '' and page.input_value('#level') == ''
    check(page, '#result-count', '7 of 7 responses shown.')
    assert page.locator('#role-chart li').count() == 6
    print('PASS role chart counts/percentages, combined chart/table filters, summaries, reset, duplicate rows, blanks, safe text rendering, new layout')
    page.click('#copy-table')
    assert page.evaluate('window.copiedText') == expected_copy(FIXTURES['initial']['rows'])
    # Test denied Clipboard API with the legacy browser fallback.
    page.evaluate("navigator.clipboard.writeText = async () => {throw new Error('Denied')}; window.originalExecCommand=document.execCommand; document.execCommand=(command)=>{window.copiedText=document.activeElement.value;return command==='copy';}")
    page.click('#copy-table')
    assert page.evaluate('window.copiedText') == expected_copy(FIXTURES['initial']['rows'])
    assert page.evaluate('document.activeElement.id') == 'copy-table'
    # If both browser mechanisms fail, expose a selected manual-copy snapshot.
    page.evaluate('document.execCommand=()=>false')
    page.click('#copy-table')
    assert page.locator('#copy-dialog').is_visible()
    assert page.input_value('#copy-text') == expected_copy(FIXTURES['initial']['rows'])
    assert page.evaluate('document.activeElement.id') == 'copy-text'
    assert page.locator('#copy-text').evaluate('e=>e.selectionStart===0 && e.selectionEnd===e.value.length')
    page.keyboard.press('Escape')
    assert page.locator('#copy-dialog').is_hidden()
    assert page.evaluate('document.activeElement.id') == 'copy-table'
    page.evaluate("document.execCommand=window.originalExecCommand; navigator.clipboard.writeText=async text=>{window.copiedText=text;}")
    print('PASS complete TSV header/rows, filtered/empty/reset copying, focus retention, denied-clipboard fallback, manual-copy dialog and Escape')


    page.select_option('#district', 'Avondale')
    page.select_option('#level', 'High School')
    page.focus('#district')
    page.evaluate('(value) => { window.fixture = value; }', FIXTURES['next'])
    page.clock.fast_forward(60000)
    check(page, '#total', '8')
    check(page, '#most-recent', '10/8/2026')
    check(page, '#represented', '4 of 28')
    assert page.input_value('#district') == 'Avondale'
    assert page.input_value('#level') == 'High School'
    check(page, '#result-count', '1 of 8 responses shown.')
    assert page.evaluate('document.activeElement.id') == 'district'
    assert 'Clawson' not in page.locator('#awaiting-list').inner_text()
    page.evaluate("window.replyMode = 'error'")
    page.clock.fast_forward(60000)
    assert 'last successful refresh' in page.locator('#status').inner_text()
    check(page, '#total', '8')
    page.evaluate("window.replyMode = 'success'")
    page.clock.fast_forward(60000)
    assert page.locator('#status').get_attribute('data-error') == 'false'
    print('PASS simulated added response, preserved filters/focus, automatic updates, error/stale-data state and recovery')

    page.focus('#district')
    start = page.evaluate('window.calls')
    page.clock.fast_forward(60000)
    assert page.evaluate('window.calls') == start + 1
    assert page.evaluate('document.activeElement.id') == 'district'
    assert page.input_value('#district') == 'Avondale'
    page.evaluate("Object.defineProperty(document, 'hidden', {configurable:true, value:true}); document.dispatchEvent(new Event('visibilitychange'))")
    start = page.evaluate('window.calls')
    page.clock.fast_forward(120000)
    assert page.evaluate('window.calls') == start
    page.evaluate("Object.defineProperty(document, 'hidden', {configurable:true, value:false}); document.dispatchEvent(new Event('visibilitychange'))")
    assert page.evaluate('window.calls') == start + 1
    print('PASS automatic 60-second refresh, no focus movement, inactive-page pause and resume')

    # A timed-out callback must not overwrite a later successful refresh.
    page.evaluate("window.replyMode = 'hold'")
    page.clock.fast_forward(60000)
    page.clock.fast_forward(30000)
    assert 'Unable to refresh' in page.locator('#status').inner_text()
    page.evaluate('window.lateSuccess = window.google.script.run.success')
    page.evaluate("window.replyMode = 'success'")
    page.clock.fast_forward(60000)
    page.evaluate('(value) => window.lateSuccess(value)', FIXTURES['empty'])
    check(page, '#total', '8')
    print('PASS timeout recovery and stale callback rejection')

    # Retain selections even if all matching submissions disappear.
    page.evaluate('(value) => { window.fixture = value; }', FIXTURES['empty'])
    page.clock.fast_forward(60000)
    assert page.input_value('#district') == 'Avondale'
    assert page.input_value('#level') == 'High School'
    check(page, '#result-count', '0 of 0 responses shown.')
    page.click('#reset')
    assert page.input_value('#district') == '' and page.input_value('#level') == ''
    print('PASS filter preservation after selected values disappear')

    load(page, FIXTURES['all'])
    check(page, '#represented', '28 of 28')
    check(page, '#awaiting-message', 'All 28 districts have responded.')
    assert page.locator('#awaiting-list').is_hidden()
    load(page, FIXTURES['empty'])
    check(page, '#total', '0')
    check(page, '#most-recent', 'No responses yet')
    check(page, '#represented', '0 of 28')
    check(page, '#rows', 'No responses have been submitted yet.')
    assert page.locator('#role-chart li').count() == 0
    check(page, '#role-summary', 'No responses have been submitted yet.')
    assert page.locator('#awaiting-list li').count() == 28
    print('PASS empty dataset and all-districts completion state')

    # Initial loading and initial failure (no misleading zero counts).
    initial = BRIDGE.replace('__FIXTURE__', json.dumps(FIXTURES['initial']).replace('<', '\\u003c')) + "window.replyMode = 'hold';"
    page.set_content(HTML.replace('<script>', '<script>' + initial, 1))
    check(page, '#total', '—')
    assert page.locator('#copy-table').is_disabled()
    assert page.locator('#response-section').get_attribute('aria-busy') == 'true'
    page.evaluate("window.google.script.run.failure(new Error('fixture'))")
    check(page, '#result-count', 'Responses unavailable.')
    check(page, '#total', '—')
    print('PASS initial loading and connection failure')

    page.evaluate("window.replyMode = 'success'")
    page.clock.fast_forward(60000)
    check(page, '#total', '7')
    assert page.locator('#status').get_attribute('data-error') == 'false'
    print('PASS recovery from initial connection failure')

    load(page, FIXTURES['initial'])
    page.focus('.skip')
    expected = ['submit-response','district','level','reset']
    for name in expected:
        page.keyboard.press('Tab')
        assert page.evaluate('document.activeElement.id') == name
        assert page.locator(':focus').evaluate("e => getComputedStyle(e).outlineStyle") != 'none'
    page.keyboard.press('Enter')
    check(page, '#result-count', '7 of 7 responses shown.')
    assert page.locator('th[scope="col"]').count() == 3
    assert page.locator('label[for="district"]').count() == 1
    assert page.locator('label[for="level"]').count() == 1
    assert page.locator('#status').get_attribute('aria-live') == 'polite'
    page.focus('#district')
    page.keyboard.press('ArrowDown')
    page.keyboard.press('Tab')
    assert page.input_value('#district') != ''
    page.focus('#reset')
    page.keyboard.press('Tab')
    assert page.evaluate('document.activeElement.id') == 'copy-table'
    assert page.locator(':focus').evaluate('e=>getComputedStyle(e).outlineStyle') != 'none'
    page.keyboard.press('Enter')
    assert page.evaluate('window.copiedText').startswith('\t'.join(HEADERS)+'\n')
    print('PASS keyboard tab order, native select keyboard use, reset activation, focus indicators and semantic checks')

    page.click('#reset')
    page.screenshot(path='/tmp/district-desktop.png',full_page=True)
    page.set_viewport_size({'width': 320, 'height': 800})
    overflow(page)
    page.screenshot(path='/tmp/district-mobile.png',full_page=True)
    page.set_viewport_size({'width': 640, 'height': 900})
    page.evaluate("document.documentElement.style.fontSize = '200%'")
    overflow(page)
    page.screenshot(path='/tmp/district-zoom.png',full_page=True)
    print('PASS 320px mobile and 200% text enlargement at 640px; actual browser zoom still requires manual validation')
    assert not errors, errors
    browser.close()
