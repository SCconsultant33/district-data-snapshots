# Counselor Career Tasks dashboard

A Google Apps Script web app that reads the live **District Data Snapshot: Counselor Career Tasks (Responses)** spreadsheet on opening and every 60 seconds while visible. There is no manual refresh control or displayed refresh timestamp. No spreadsheet data is bundled in the app, and new submissions require no redeployment.

## Files

- `Code.gs`: live-sheet adapter, exact configurable header mappings, 28-district reference list, and full-dataset summary calculations.
- `Index.html`: complete HTML, CSS, and browser JavaScript. No external frontend dependencies.
- `appsscript.json`: V8 runtime, America/New_York project timezone, and a read-only spreadsheet permission enforced by the Google Sheets API.
- `tests/`: synthetic server and browser verification; fixtures are never used by the deployed app.
- `VERIFICATION.md`: results and remaining deployment/manual checks.

## Configuration

At the top of `Code.gs`, configure `CONFIG.spreadsheetId`, `responseTab`, `headerRow`, and `headers`. The supplied configuration uses the live sheet ID `1MUUcwT7SFizDAqoZmbU3GZmz-GyDhXQnd7-G0XvgRyw` and the verified tab **Form Responses 1**. Header mappings are:

| Internal field | Exact sheet header |
| --- | --- |
| timestamp | Timestamp |
| district | District |
| level | Level |
| role | Which role has primary responsibility for coordinating EDP activities at your building? |

Missing or duplicate mapped headers produce a connection/configuration error instead of silently selecting another column. Matching ignores capitalization and repeated whitespace. If the form later uses alternate district names, add verified entries to `districtAliases`; alias targets must be one of the 28 reference districts. No suffix-based or fuzzy district guessing is applied.

## Deploy in Google Apps Script

1. Sign into a Google account with access to the spreadsheet. Create a standalone Apps Script project at `script.google.com` (or open Extensions → Apps Script from the spreadsheet).
2. Replace `Code.gs` with the supplied file. Add an HTML file named **Index** and paste `Index.html` into it.
3. Beside **Services** in the editor, click **+**, select **Google Sheets API**, keep version **v4** and identifier **Sheets**, and click **Add**. The supplied manifest also declares this service. For a standard Google Cloud project, enable the Google Sheets API in its Cloud Console; default Apps Script projects enable the API automatically when the service is added.
4. In Project Settings, enable **Show appsscript.json manifest file in editor**. Replace its contents with the supplied `appsscript.json`, then save.
5. Select and run `getDashboardData` once in the editor. Authorize read-only spreadsheet access. The adapter uses the Advanced Google Sheets service with only `https://www.googleapis.com/auth/spreadsheets.readonly`. It does not use `SpreadsheetApp.openById`. Confirm execution succeeds; the owning account must retain access to the sheet. If it fails, verify the tab and exact header mappings in `CONFIG`.
6. Choose Deploy → New deployment → Web app. Set **Execute as** to yourself, and choose the appropriate permitted audience (for example your organization). Viewers in that audience receive the dashboard's three display fields through the owner's sheet access. Use the organization's required access policy.
7. Deploy, complete any authorization prompts, and open the resulting `/exec` URL. Verify counts, filters, the filtered role distribution, and the awaiting-district list. The `/dev` test URL is for script editors only.

Later **code** changes require editing the deployment to use a new version. Later **sheet responses** appear automatically without editing or redeploying code. No triggers, API key, client-side sheet publishing, or cached response file is needed. The owner reports that the initial deployed prototype works. Google deployment was performed by the owner, not from this workspace.

## Counting and display

Every nonempty submission row counts, including Public School Academy and Other. A timestamp-only submission also counts; wholly blank rows do not. Standard Google Forms submissions include a Timestamp. Duplicate submissions remain separate rows. Only distinct names matching the 28-district reference list count toward participation. Awaiting districts are those reference districts with no submissions, alphabetically; Public School Academy and Other never enter that list.

The District and School Level filters combine with AND and affect the role-distribution bar chart and response table together. Summary cards and participation always use all submissions. Reset sets both filters to All. Blank role answers display **No response provided**; blank district/level answers use the same label. Entered Other text is replaced server-side with **Other** for role, school level, and district; only known form choices and explicitly configured district aliases retain their labels. Choices remain selected across refreshes, including when a chosen value no longer has any current rows.

Only District, Level, and the EDP role are returned to viewers. Timestamp is read server-side to identify submissions and compute **Most Recent Response**, independently of filters. Sheets API date serials preserve the spreadsheet calendar date rather than converting through the viewer timezone. The newest valid timestamp is used even if rows are reordered. If no dates can be parsed, the date is unavailable; an empty dataset says No responses yet. No poll/refresh timestamp is displayed. Email and open-ended answer columns are not read as response data or returned. HTML-like answers are rendered as text.

The app pauses automatic refresh while the document is hidden and refreshes when it becomes visible again. Requests do not overlap. A request times out after 30 seconds; late replies are ignored. On an initial failure, counts remain unavailable. On a later failure, the last successful data remain visible with an explicit stale-data message. The dashboard retries automatically. A visually hidden polite status region announces changed data and filtered counts without moving focus; unchanged polls remain silent. Errors remain visible.

## Run verification locally

Requires Node.js, Python with `playwright`, and Chromium at `/usr/bin/chromium`. These were available in the prepared workspace. No Apps Script credentials are required for synthetic tests.

```sh
cd /workspace/district-data-snapshots
node tests/server.test.cjs --fixtures
python tests/browser_test.py
```

The first command runs nine server tests and writes synthetic browser fixtures to `/tmp/district-test-fixtures.json`. The second exercises the actual `Index.html` using a mocked `google.script.run` bridge, checks keyboard behavior and responsive layouts, and writes temporary screenshots. Mock tests verify logic; they do not prove authorization or operation of a deployed Apps Script app.

## Final live/manual acceptance

After deployment, submit a real response through the existing form (or coordinate an authorized test submission with the form owner). Leave the dashboard visible and confirm the new row and total within the next refresh cycle; check distinct participation only increases for a newly represented reference district. Verify selected filters remain unchanged and the chart updates with the table. Keep this check separate from synthetic tests: this workspace did not add or modify sheet responses.

Use keyboard-only navigation and a screen reader on the deployed page. Confirm table header associations, mobile table reading order, polite refresh announcements, labels, and retained focus. Check actual browser zoom at 200%, mobile portrait/landscape, and operating-system high-contrast mode. These platform and assistive-technology checks are needed before asserting full WCAG 2.1 AA conformance.

## Migrating from the earlier broad-scope manifest

Replace both `Code.gs` and `appsscript.json` with the current read-only versions; changing only the manifest is insufficient. `Index.html` stays the same. If you already approved the earlier edit-capable spreadsheet scope, remove this script project's existing authorization under Google Account → Security → Your connections to third-party apps & services, then rerun `getDashboardData` and authorize the read-only version. Confirm you are removing the authorization for this script project. Update any existing web-app deployment to the new script version so it uses the read-only adapter. Old deployments must be updated or archived to prevent continued use of earlier code.

## Layout and role distribution

The provided form description appears under the title, followed by Most Recent Response. Three equal-size desktop cards show Total Responses, Districts Represented, and a teal Submit a Response link. The link opens the provided Google Form in a new tab. Awaiting districts appear below in up to four columns.

Aggregated Response Data and Individual Responses have separate headings and cards. One District/School Level filter pair updates both cards, while counts, awaiting districts, and latest date remain based on all submissions. Individual rows sort by district alphabetically, then High School, Junior High School, Middle School, Other, and missing answers last. Duplicate rows remain separate.

The horizontal chart always orders the five role categories as School counselor, Career counselor, Career development staff, Shared responsibility, and Other. They use fixed blue, orange, green, purple, and slate colors respectively, with counts/percentages providing meaning independently of color. These five categories remain visible with zero counts when a nonempty filtered dataset has no answers in a category. Missing answers appear as a separate gray No response provided category after Other when present. Empty/no-match states show a message instead of bars.

The backend maps exact long labels from the live form to the short display categories, including Career counselor (school counselor in a defined career-focused role), Career development staff member in another role (e.g., specialist, technician, or paraprofessional), and Shared responsibility across roles. Unknown entered role/level/district text is displayed as Other, not forwarded to viewers. Bars show the share of filtered submissions on a consistent 0–100% scale. Each submission contributes once. No external chart library or edit-capable Google scope is needed.

## Copy individual responses

The copy icon beside Individual Responses copies the three full column headers and every currently displayed row as tab-separated text. It preserves filters, district/school-level order, duplicate submissions, and the displayed Other/blank-answer labels. Paste into Excel or Google Sheets to obtain separate columns. Reset the filters before copying to include all submissions. An empty view copies only the header, not the empty-state message.

Copying uses data already shown to the viewer and requires no spreadsheet-edit permission or sheet access beyond the existing dashboard audience. The button stays unavailable until data has loaded. It uses the browser Clipboard API, falls back to browser copying, then provides a selected manual-copy dialog if both mechanisms are blocked. Closing the dialog restores focus to the copy button. This adds no permissions to the Apps Script manifest. Apps Script iframe clipboard behavior should be checked after deployment; the manual dialog supports denied clipboard access.
