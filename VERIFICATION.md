# Verification record

## Live source inspected

Read the live Google Sheet directly through its Google Sheets edit page and CSV endpoint, not an Excel snapshot. Verified title: **District Data Snapshot: Counselor Career Tasks (Responses)**. Verified response tab: **Form Responses 1**, gid `748758638`.

The observed live headers, in order:

1. Timestamp
2. District
3. Level
4. Which role has primary responsibility for coordinating EDP activities at your building?
5. Briefly describe any additional career-related tasks that the school counselor is expected to coordinate or administer as part of their role in your building.

At inspection, the tab contained **zero submissions**. The expected live state is Total Responses 0, Districts Represented 0 of 28, an empty response table, and all 28 reference districts awaiting. No real response values, emails, or open-ended answers are stored in this repository. The fifth column's header is recorded solely as schema evidence; that column's answers are excluded from the application.

## Executed and passed

Six Node server tests exercise the actual `Code.gs` functions through a VM:

- Seven synthetic submissions, including Public School Academy, Other, duplicate Avondale submissions, one case/whitespace-normalized district, and a timestamp-only row: total 7, represented 3 of 28, awaiting 25. A wholly blank row is excluded.
- Empty dataset: 0 responses, 0 represented, 28 awaiting. All reference districts: 28 represented, none awaiting.
- Verified alias handling, unknown-label exclusion, missing/duplicate header rejection, and reordered column mapping.
- Mocked Advanced Sheets API range reads: only mapped response columns are read; only District/Level/role fields are returned. A second read after adding a mock row updates totals, participation, and blank-role display.

Chromium checks of the actual HTML with synthetic Apps Script bridge responses:

- Combined district/level filters, no-match state, reset, blank answers, distinct participation, duplicate table rows, and unchanged summary counts during filtering.
- HTML-like role values stay text rather than executing as markup.
- Added-response simulation updates counts and awaiting districts while retaining both filter selections and keyboard focus.
- Initial loading/failure; failure after a successful refresh; recovery; request timeout and ignored late callback.
- Automatic refresh after 60 seconds, no focus movement, pause while document is hidden, immediate refresh on visibility return.
- All-districts completion message and empty dataset handling.
- Keyboard Tab order through dropdowns/reset, native select keyboard operation, Enter activation, visible focus outlines, explicit table headers, labels, and a polite live region.
- No horizontal page or cell overflow at a 320px viewport and with 200% text enlargement at a 640px viewport. Rendered mobile and enlarged-text screenshots inspected. Responsive rows retain explicit table roles/header associations and show visible field labels on narrow screens.

Calculated WCAG contrast ratios: body 13.56:1; table text 14.55:1; header text 12.94:1; note 8.46:1; button 9.17:1; button hover 12.59:1; error 8.54:1; focus outline at least 7.29:1; control border 4.75:1. Normal text exceeds 4.5:1, and focus/control boundaries exceed 3:1. Color does not carry status alone; loading/error/success states have text.

## Not yet verified

- Independent inspection of Google Apps Script authorization and the deployed `/exec` app; no Google deployment tool was available here. The owner reports that the initial deployed prototype works.
- A real new Google Forms submission followed by live dashboard refresh. The source was empty; no live test response was written. Added-response behavior was tested with a changed mock Advanced Sheets API source and browser response.
- Screen-reader speech and announcements (NVDA/VoiceOver), native dropdown behavior across browsers, actual desktop browser 200% zoom, mobile-device/landscape rendering, and forced-colors/high-contrast usability in the deployed Google iframe.

The implemented accessibility features and executed checks support AA goals, but this record does not certify complete WCAG 2.1 AA conformance. See README for deployment and manual acceptance steps.

## Read-only adapter correction

The initial `SpreadsheetApp.openById` adapter could not execute with the read-only OAuth scope. It has been replaced with the Advanced Sheets service using only Values.get and Values.batchGet. The manifest declares Sheets v4 and only `https://www.googleapis.com/auth/spreadsheets.readonly`. No edit-capable scope is included. Six server tests now pass, including A1 range conversion, trailing blank column handling, a headers-only empty dataset, rereads after an added response, mapped-column privacy, and the exact read-only manifest. The owner reports that the initial prototype works after applying the read-only adapter and HTML-file setup corrections; Google authorization and deployment were not independently inspected from this workspace. Previously granted broader authorization and earlier deployments need removal/update as described in README.

## Publication baseline

The owner confirmed the initial prototype works and requested publishing the current complete files to GitHub for version control. The six server tests and Chromium browser checks were rerun successfully before preparing this initial commit.

## Layout revision validation

The updated browser checks pass for removal of the refresh button/timestamp, the exact provided form description, awaiting districts preceding response details in four desktop columns, and the filtered role chart. On the seven-submission fixture, Counselor and No response provided each have two responses (28.6%); three other categories each have one (14.3%). Combined filters reduce the chart and table together; an Avondale/High School filter shows one Counselor response (100%). Berkley/High School shows one No response provided (100%). No-match and empty states clear the chart; reset restores the full distribution. Text rendering prevents HTML-like role labels from becoming markup. The six server tests and revised browser checks pass. Desktop/mobile rendered screenshots were inspected, with no page overflow at 320px or at 200% text enlargement. Actual screen-reader speech and browser zoom remain manual checks.
