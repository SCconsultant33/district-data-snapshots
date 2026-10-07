# Counselor Career Tasks dashboard

A Google Apps Script web app that reads the live **District Data Snapshot: Counselor Career Tasks (Responses)** spreadsheet on opening, manual refresh, and every 60 seconds while visible. No spreadsheet data is bundled in the app, and new submissions require no redeployment.

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
7. Deploy, complete any authorization prompts, and open the resulting `/exec` URL. Verify the timestamp, counts, filters, and awaiting-district list. The `/dev` test URL is for script editors only.

Later **code** changes require editing the deployment to use a new version. Later **sheet responses** appear automatically without editing or redeploying code. No triggers, API key, client-side sheet publishing, or cached response file is needed. The owner reports that the initial deployed prototype works. Google deployment was performed by the owner, not from this workspace.

## Counting and display

Every nonempty submission row counts, including Public School Academy and Other. A timestamp-only submission also counts; wholly blank rows do not. Standard Google Forms submissions include a Timestamp. Duplicate submissions remain separate rows. Only distinct names matching the 28-district reference list count toward participation. Awaiting districts are those reference districts with no submissions, alphabetically; Public School Academy and Other never enter that list.

The District and School Level filters combine with AND and affect only the response table. Summary cards and participation always use all submissions. Reset sets both filters to All. Blank role answers display **No response provided**; blank district/level answers use the same label. Choices remain selected across refreshes, including when a chosen value no longer has any current rows.

Only District, Level, and the EDP role are returned to viewers. Timestamp is read server-side to identify submissions; the displayed refresh time is the time of a successful sheet read, shown in the viewer's browser timezone. Email and open-ended answer columns are not read as response data or returned. HTML-like answers are rendered as text.

The app pauses automatic refresh while the document is hidden and refreshes when it becomes visible again. Requests do not overlap. A request times out after 30 seconds; late replies are ignored. On an initial failure, counts remain unavailable. On a later failure, the last successful data and timestamp remain visible with an explicit stale-data message. A polite status region announces completed refreshes and filtered counts without moving focus. The manual refresh button retains focus while a request is pending.

## Run verification locally

Requires Node.js, Python with `playwright`, and Chromium at `/usr/bin/chromium`. These were available in the prepared workspace. No Apps Script credentials are required for synthetic tests.

```sh
cd /workspace/district-data-snapshots
node tests/server.test.cjs --fixtures
python tests/browser_test.py
```

The first command runs six server tests and writes synthetic browser fixtures to `/tmp/district-test-fixtures.json`. The second exercises the actual `Index.html` using a mocked `google.script.run` bridge, checks keyboard behavior and responsive layouts, and writes temporary screenshots. Mock tests verify logic; they do not prove authorization or operation of a deployed Apps Script app.

## Final live/manual acceptance

After deployment, submit a real response through the existing form (or coordinate an authorized test submission with the form owner). Leave the dashboard visible and confirm the new row and total within the next refresh cycle; check distinct participation only increases for a newly represented reference district. Verify selected filters remain unchanged and the timestamp advances. Keep this check separate from synthetic tests: this workspace did not add or modify sheet responses.

Use keyboard-only navigation and a screen reader on the deployed page. Confirm table header associations, mobile table reading order, polite refresh announcements, labels, and retained focus. Check actual browser zoom at 200%, mobile portrait/landscape, and operating-system high-contrast mode. These platform and assistive-technology checks are needed before asserting full WCAG 2.1 AA conformance.

## Migrating from the earlier broad-scope manifest

Replace both `Code.gs` and `appsscript.json` with the current read-only versions; changing only the manifest is insufficient. `Index.html` stays the same. If you already approved the earlier edit-capable spreadsheet scope, remove this script project's existing authorization under Google Account → Security → Your connections to third-party apps & services, then rerun `getDashboardData` and authorize the read-only version. Confirm you are removing the authorization for this script project. Update any existing web-app deployment to the new script version so it uses the read-only adapter. Old deployments must be updated or archived to prevent continued use of earlier code.
