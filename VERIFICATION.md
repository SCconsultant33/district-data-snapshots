# Verification record

## Live sources

The live spreadsheet response tab is Form Responses 1 (gid 748758638). Its headers are Timestamp, District, Level, Which role has primary responsibility for coordinating EDP activities at your building?, and an additional open-ended question excluded from the app. The initial inspection found no submissions; the latest inspection found eight submissions, six represented reference districts, and a latest response date of 10/7/2026. Live short-category role counts reconcile to eight: School counselor 2, Career counselor 2, Career development staff 1, Shared responsibility 2, Other 1. No response values or Other text are stored in the repository.

The supplied live Google Form was inspected to verify the exact long role labels and school-level choices. These map to the requested short category labels, while entered Other text is replaced with Other server-side. Blank answers remain No response provided. The application continues to use the Advanced Sheets API and only spreadsheets.readonly permission. Submission timestamps are requested as Sheets serial numbers to preserve the spreadsheet's calendar date.

## Automated checks executed

Nine backend tests pass:

- Counts, duplicate submissions, distinct reference participation, alphabetical awaiting list, and exclusion of Public School Academy/Other from participation.
- Empty/all-districts datasets, explicit district aliases, reordered headers, and missing/duplicate-header rejection.
- Mapped-column read-only API reads, trailing blank columns, and a new submission on a later read.
- Exact read-only manifest and A1 column conversion.
- Canonical live-form role aliases, canonical school levels, and replacement of all entered Other text in the returned payload.
- Most Recent Response uses the greatest valid submission timestamp rather than row order or poll time; numeric serials, AM/PM strings, invalid dates, and empty datasets are checked.
- Individual table ordering by district, then High School, Junior High School, Middle School, Other, and missing levels last.

Chromium browser checks pass for:

- Latest response date, full-dataset date during filtering, and update after a simulated newer submission.
- Separate aggregate/individual cards and headings, removed prior description/footer, no Share of... text, equal-height summary/submission cards, and exact survey href/target/rel.
- Fixed role order, five distinct stable colors, zero-count categories, optional missing-answer category, counts and percentages, and shared chart/table filters.
- Reset, no matches, empty data, all-district completion message, duplicate table rows, suppressed entered Other text, and full-dataset summaries.
- Automatic 60-second polling, inactive-page pause/resume, filter/focus preservation, failure/stale-data/recovery states, timeout, and ignored late replies.
- Keyboard tab order including the survey link, visible focus, native selects, reset activation, table header associations, and polite status semantics.
- No page/cell overflow at 320px and with 200% text enlargement at 640px; desktop/mobile screenshots inspected.

Contrast measured against the light bar track is at least 5.59:1 for all six category colors. The survey link's white text against teal is 7.04:1. Existing body, button, error, focus, and control colors passed AA text/nontext thresholds in prior checks and remain unchanged. Color is accompanied by role names, counts, and percentages.

## Remaining manual checks

The owner previously reported a working deployed prototype; this revision has not been independently deployed or executed inside Google Apps Script from the workspace. Save both updated source files and deploy a new version. A real new form submission followed by deployed-page refresh, screen-reader speech (including revised headings and chart reading order), actual browser 200% zoom, real mobile devices, and forced-colors usability still require manual validation. Automated checks support accessibility goals but do not certify full WCAG 2.1 AA conformance.
