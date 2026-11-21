# Data

The merchant wants to read numbers and trends: one figure, a trend over a period, a breakdown, a table of buckets, or an experiment result.

### data.metric-tile: see one metric and open its report

- Intent: learn one number, its change and its trend; do open the report behind it.
- Use when: several metrics sit side by side on an analytics overview and each has a report. Not when: the metrics summarise an index page, see `data.metrics-strip`; or the figure has no trend and no destination, see `data.stat-figure`; the numbers are the rows of a ranked list, see `data.breakdown-card`.
- Ask: which metrics? [the three or four the merchant checks first]; does each open a report? [yes]; trend line per tile? [yes]; change against the previous period? [yes], see `data.compare-picker`.
- Admin: Analytics > overview (`/analytics`), seen 2026-11-14. Also: the Orders metrics bar uses flat cells instead of tiles (`data.metrics-strip`).
- Shape: a row of 4 tiles, each 323x74, gap 16. Tile is a `section`, bg #fff, radius 20, padding 16, card shadow. The whole tile is a link (radius 16) to its report. Heading 13px/16px 600 with a dotted underline. Value 13px/20px 600 below the heading. Sparkline 80x20 at the right of the value (stroke 1.5, colour #13acf0, endpoints x 2 and 78, baseline y 18).
- States: no data shows "$0.00", "0" or an em dash for rates, and the sparkline is flat. Hover or focus on the heading opens the definition tooltip (see `data.metric-definition`).
- Behaviour: click anywhere opens the report. The change figure sits beside the value, small and 500. When a series exists, the tile value is the series total, so tile, report heading and totals row agree.
- Copy: heading is the metric name ("Total sales", "Orders").
- Evidence: measured.

### data.metrics-strip: see a few headline numbers above a list or page

- Intent: learn a handful of numbers for a period at a glance; do change the period.
- Use when: the numbers summarise the page below (Orders, a home page) and one period control serves all of them. Not when: each number opens its own report, see `data.metric-tile`; or space is tight, see `data.metrics-strip-condensed`. The same strip on a list page is `index.metrics-strip`; read both.
- Ask: which numbers? [two or three]; which period options? [last 7, 30 and 90 days, default 30]; does a number open a report? [no].
- Admin: Orders index > metrics bar (`/orders`), seen 2026-11-14. Also: Analytics overview uses tiles instead.
- Shape: a two-row bar 68 high with 8px outer padding. First cell is the period control (128x68, see `data.period-radio-menu`). Then one flat column per metric: item 225 to 450 wide, `.hover-container` margin 8, padding 4px 12px, radius 8. Heading 13px/16px 600 with a 1px dotted #ddd underline. Sparkline 80x20 in #13acf0. 16px from the bar to the filter row below.
- States: hover or focus-within on any cell gives bg #f7f7f7. Overflow: a 54px gradient from transparent to the surface at the edge, arrows appear on bar hover (opacity 0 to 1, 200ms ease-in-out), the last item has 80px end margin.
- Behaviour: cells scroll horizontally when they do not fit.
- Copy: the period cell reads the range ("Last 7 days"); the heading is the metric name.
- Evidence: measured, https://shopify.dev/docs/api/app-home/latest/patterns/compositions/metrics-card

### data.metrics-strip-condensed: show headline numbers in a narrow slot

- Intent: learn the same handful of numbers where the full bar does not fit.
- Use when: the strip sits in a narrow column or on a phone and cells must wrap. Not when: the page has room, see `data.metrics-strip`.
- Ask: which numbers must survive at phone width? [all of them, in a two-column grid].
- Admin: none as a separate shape. The Orders bar scrolls horizontally with edge arrows instead of wrapping. Nearest: `data.metrics-strip`.
- Shape: a wrapping grid of the same cells (2x2 at 390 wide) with the same 68px row, padding 8 and 4px 12px, and the same heading and sparkline measures.
- States: at 390 the third cell must not draw a divider at the grid's outer edge, or rows draw unlike each other.
- Behaviour: no scroll. The value row aligns on the label's edge, with no extra indent.
- Evidence: observed.

### data.metric-definition: read what a metric means

- Intent: learn the definition of a label or column; do nothing else.
- Use when: a heading, tile label or table header names a metric that needs a definition. Not when: the help belongs to a field, see the `fields` family.
- Ask: which metrics need a definition? [every figure whose meaning is not obvious]; what does each one say? [one or two sentences].
- Admin: Analytics tile heading and Orders metrics bar heading, seen 2026-11-14.
- Shape: the label has a 1px dotted #ddd underline. The tooltip is dark (#1a1a1a bg, #eee text), radius 10, padding 4px 8px, max 250 wide, 6px above the label. Content in a 4px box: title 13/20 700, text 12/18.
- States: opens on hover and on focus. The period cell has no tooltip.
- Behaviour: the tooltip is named by its title, so ids are unique on the page. It does not trigger the tile's link.
- Copy: one or two sentences defining the metric.
- Evidence: measured.

### data.stat-figure: show one figure with a definition

- Intent: learn one count or amount; do optionally follow it to its page.
- Use when: a single figure stands alone in a card or aside, without a trend or period control. Not when: it needs a trend and a report link, see `data.metric-tile`; the figure belongs to one record's aside, see `detail.summary-values`.
- Ask: which figure? [one count or amount]; what does it mean? [one-sentence definition]; does it open a page? [no]; what shows when the feature is off? [a badge such as "Not enabled"].
- Admin: Discount detail > Performance aside section holds a value (observed). Also: Billing bill card shows an amount as h2 29px/36px 500.
- Shape: titled card or aside section: title 13/20 with an info icon for its definition, the figure large, an optional badge in place of the figure (a setup prompt), an optional destination link.
- States: with a badge, the figure is left out.
- Behaviour: hover on the info icon shows the definition; a destination makes the card a link.
- Copy: title is the metric; badge text is a prompt such as "Not enabled".
- Evidence: observed.

### data.period-pill: see and change the period of a report

- Intent: learn which period the numbers cover; do change it, with a calendar.
- Use when: an analytics overview or report offers presets plus a custom range. Not when: only a short list of ranges exists, see `data.period-radio-menu`.
- Ask: which presets? [Today, Last 7, 30 and 90 days, Last 12 months]; custom range with a calendar? [no]; default period? [last 30 days]; kept in the URL? [yes on a report, no on the overview].
- Admin: Analytics > date button (`/analytics`), seen 2026-11-14. Also: the report page shows the same pill ("Last 365 days", 135x28). The Growth and Attribution period picker also offers a relative "Last [value] [unit]" row (units Minutes to Years) with an "Include today" option (seen 2026-11-16).
- Shape: secondary pill 28 high (91x28 for "Today"), padding 4 12 4 6, 12px/16px 500, a 20px calendar icon at the left, a 16px chevron at the right. The compare pill and a currency pill follow with gap 8. The label is the preset name, not the dates. Popover 665x371, 4px below the button, radius 16, popover shadow. Left: preset list, items 149 wide, 25 high, padding 2 6, radius 8, 13px/20px 400, grouped by hairlines (Today, Yesterday | Last... | Period to date | Black Friday, Cyber Monday, Quarters | Custom range). Right: start and end inputs (30 high) joined by an arrow icon, a 28x28 clock button, then two months side by side with chevrons and a 1px divider. Footer: Cancel (secondary) and Apply (primary, disabled until changed), right-aligned over a hairline.
- States: selected preset bg rgb(235,235,235), weight 600. Open: the trigger keeps a 2px blue ring (rgb(80,131,240) family) and the chevron points up. Calendar: month title 13/20 600, weekday headers 11px/14px rgb(74,74,74), day cells 32x32 radius 10, selected day bg rgb(16,16,16) white 600, in-range cell bg rgb(242,242,242), future days rgb(166,166,166).
- Behaviour: the overview keeps the period in localStorage, not in the URL. A report keeps it in the URL (see `data.report-page`). Apply commits; Cancel closes.
- Copy: "Today", "Last 365 days".
- Evidence: measured.

### data.period-radio-menu: pick one range from a short list

- Intent: learn the current range; do switch to another preset.
- Use when: a bar or card has a small fixed set of ranges and no calendar. Not when: custom ranges or a calendar exist, see `data.period-pill`.
- Ask: which ranges? [last 7, 30 and 90 days]; default? [last 30 days]; a date line under each range? [yes, where the range has dates].
- Admin: Orders > metrics bar > period cell (`/orders`), seen 2026-11-14.
- Shape: trigger cell 128x68, padding 8, 1px #f2f2f2 divider at the inline end; its button is 111x52, radius 4; inside a 16px calendar icon, gap 4, 12px/20px. Popover 4px below, left aligned, radius 16, white, padding 8, 0.25s opacity and transform (cubic-bezier(0.19,0.91,0.38,1)). A radio choice list: each row label 28 high (padding 4px 0, gap 8, radio column 16x20) with a 12/16 #4a4a4a description 24px indent below (20 high, 4px bottom). Radio 14px (+1px margin) unchecked; 16px #101010 checked with a white dot at scale 0.5.
- States: trigger hover bg #f7f7f7 (radius 4). Open: inner wrapper bg #f7f7f7 (radius 8). Focus: 2px solid #5083f0, offset 1px (also on the radio). Row hover has no row background; only the radio's inner fill turns #f7f7f7.
- Behaviour: Tab from the trigger lands on the checked radio. Arrow keys select and apply the next range and the popover stays open. Enter does nothing. Escape closes and returns focus to the trigger with the ring. A click on a row selects and stays open.
- Copy: range name, then a date description only for ranges that have one. Never invent a daily series for a range without data.
- Evidence: measured.

### data.compare-picker: choose what the period is compared with

- Intent: learn what the lighter series and the change figures are compared to; do change it.
- Use when: tiles and charts show a change against another window. Not when: no comparison exists; omit the control.
- Ask: compare with what? [the previous period]; compared by default? [yes].
- Admin: Analytics > "Compare to" pill (`/analytics`), seen 2026-11-14. Also: the report page shows it at 215x28. The Attribution compare menu lists: No comparison, Previous period, Previous year, Previous year (match day of week), Custom (seen 2026-11-16).
- Shape: secondary pill 129x28 with a calendar-compare icon and a chevron, 12px/16px 500, gap 8 from the date pill. It opens a popover of comparison choices.
- States: open ring as the date pill. Hidden for an all-time period.
- Behaviour: the overview keeps the choice in localStorage (`since: previous_period`). A report carries it in the query (`COMPARE TO previous_period`).
- Copy: "Compare to: Nov 13, 2026" names the window.
- Evidence: observed.

### data.overview-grid: lay out an analytics overview

- Intent: learn the key numbers, the main trend and the top breakdowns on one screen; do open any of them.
- Use when: the page is an analytics landing with several cards. Not when: the page shows a single report, see `data.report-page`; the numbers sit above a list of records, see `index.metrics-strip`; the page is a list of records, see `index.page-frame`.
- Ask: which key numbers? [three or four]; which trend leads? [the one the merchant acts on]; which breakdowns? [top three dimensions]; period and comparison controls? [yes, 30 days against the previous period]; where does each card lead? [its report].
- Admin: Analytics (`/analytics`), seen 2026-11-14, viewport 1440, nav collapsed to the 60px rail.
- Shape: title bar with "More actions". An optional dismissible banner row (1340x52). Controls row at y 125 (date, compare, currency pills, gap 8). Tiles row at y 170: 4 tiles 323x74, gap 16. Second row at y 260: trend card 888x389 (about two thirds) and breakdown card 436x389 (one third), gap 16. Then three-column cards.
- States: loading not captured. Empty values are "$0.00", "0" or an em dash.
- Behaviour: each card title is the link to its report. The overview period is not in the URL.
- Copy: card titles name the metric ("Total sales over time", "Total sales breakdown").
- Evidence: measured.

### data.report-page: read one metric over time with its table

- Intent: learn one metric across the period against the comparison; do change the period, read each bucket, export.
- Use when: a metric has a series and a bucket table. Not when: it has only a figure, see `data.stat-figure`; or the report is a list of records, see `data.report-table`; several metrics are compared on one landing page, see `data.overview-grid`.
- Ask: which metric? [one]; bucket by day, week or month? [day]; compare with the previous period? [yes]; export? [yes, as a title-bar action]; which columns in the table? [one per related metric].
- Admin: Analytics > Reports > Orders over time (`/analytics/reports/orders_over_time`), seen 2026-11-14.
- Shape: title bar with a back link ("Reports"), a breadcrumb h1 (13/28 500), a status chip and "Report details". Controls row at y 57: date pill, compare pill, and at the right "Open annotations panel" and "Toggle exploration panel" (28 high). One main card 1044 wide at y 101: bg #fff, radius 20, card shadow, `box-shadow .3s cubic-bezier(.25,.1,.25,1)`. Inside: an editor header and query editor, the chart (svg 1004x290), a legend, then the table under a hairline in the same card.
- States: empty is a flat line at 0, axis 0 to 10.
- Behaviour: everything is in the URL as one query, `?ql=FROM sales SHOW ... TIMESERIES day ... SINCE startOfDay(-30d) UNTIL today COMPARE TO previous_period ... VISUALIZE orders TYPE line`. Loading the URL restores the exact report. Back keeps the period. Page actions (Export) sit in the title bar as secondary actions, not in the pill row.
- Copy: title "<metric> over time".
- Evidence: measured.

### data.line-chart: read a trend against the previous period

- Intent: learn how a value moved over the period and against the comparison.
- Use when: a series over time is the point of a card. Not when: parts of a whole, see `data.donut` or `data.breakdown-card`; one figure with no history, see `data.stat-figure`.
- Ask: which value over time? [one series]; compared with the previous period? [yes]; which bucket? [day]; does the heading open a report? [yes].
- Admin: Analytics overview "Total sales over time" card and the report chart, seen 2026-11-14.
- Shape: card heading 13/16 600 at +16, big value 20px/20px 600 at +44, chart grid from +80 (856x253 in the overview, svg 1004x290 in a report). Y labels 11 to 12px at the left, light horizontal gridlines, x labels 11px/16px. Current series solid blue rgb(0,161,239) family; comparison lighter and dashed at the end (incomplete period). Legend `ul[aria-label=Series]` 24 high, centred below: 8px dot plus range label 12px. A "View data" link sits bottom-right. Axis dates are short without the year ("Oct 14", "Nov 2025"): every date up to 8 points, beyond that every n-th from the first (at most 7); on a phone every other date. Money axes show whole units.
- States: empty is the flat line. Hover: see `data.chart-tooltip`.
- Behaviour: the card heading is the link to the report.
- Copy: "Total sales over time"; legend "Nov 14, 2025 – Nov 14, 2026".
- Evidence: measured.

### data.chart-tooltip: read one point of a chart

- Intent: learn each series' value on the hovered date.
- Use when: a line chart with one or two series. Not when: a donut, whose legend carries the values, see `data.donut`.
- Admin: Analytics report chart hover, seen 2026-11-14.
- Shape: 1px grey vertical crosshair through the point; a filled dot about 8px with a white ring per series. Tooltip 195x127, 52px right of the point, bg rgb(27,27,27), radius about 6, padding about 8 (read from a screenshot). Title is the metric, 12px 600 white. One block per series: 8px colour dot, period label 12px light grey, value in a small dark chip (bg about rgb(60,60,60), radius 4) 12px 600 white.
- States: shows on hover, disappears when the pointer leaves; no fade measured.
- Behaviour: hover only; it needs no state.
- Copy: title "Orders"; period labels "May 2026".
- Evidence: observed.

### data.breakdown-card: see the top rows of one dimension

- Intent: learn which values contribute most; do open the full report.
- Use when: a ranked list of a few rows with amounts or shares. Not when: the rows are parts of a whole, see `data.donut`; the rows are records to search and open, see `data.report-table`.
- Ask: which dimension is ranked? [the one the merchant asks about first]; which amount or share per row? [one number]; how many rows? [five]; what does the title open? [the full report].
- Admin: Analytics overview "Total sales breakdown" card, seen 2026-11-14. The store had no orders, so rows with data were not captured.
- Shape: card 436x389 (one third). Heading 13/16 600 dotted. Rows on a 41px step; amounts `strong` 13/20 700 right-aligned.
- States: an empty line per card (no extensions, no sources, no failed codes, no blocks).
- Behaviour: the title opens the report, not the whole card. Rows are not links.
- Copy: "Shoppers", "{n} attempts", "Lifetime".
- Evidence: observed.

### data.donut: see parts of a whole

- Intent: learn the split of a total; do read each share in a legend.
- Use when: few categories sum to a whole (orders with and without an extension). Not when: ranked rows, see `data.breakdown-card`.
- Ask: which categories? [two to five that sum to the whole]; values shown as counts or shares? [counts]; what shows when empty? [one sentence naming the period].
- Admin: none captured. Compose a card with a dotted heading, the donut and a legend; the admin charts are Polaris Viz.
- Shape: SVG donut with the legend at the right. Legend dots match the slice colours (never darkened); values right-aligned with locale grouping. The card title is dotted 13/16 600 with its description as the definition; inline help in subdued text under the chart.
- States: empty "No protected orders found for this period".
- Behaviour: none beyond the legend.
- Copy: "Orders with extensions".
- Evidence: observed.

### data.period-table: read each bucket of a report

- Intent: learn the exact figures per day, week or month for both periods.
- Use when: under a chart in the same card, a numeric table by time bucket. Not when: a list of records, see `data.report-table`.
- Ask: which columns? [one per metric in the chart]; bucket by day, week or month? [day]; totals row on top? [yes]; sortable? [no].
- Admin: Analytics report table, seen 2026-11-14.
- Shape: same card as the chart, hairline above, a density toggle icon 28x28 at the right. Header 12/20 500 (36 high), a sort icon on the first column, numeric columns right-aligned. First body block holds the totals of both ranges on grey (rgb(242,242,242) family), both lines bold. Then one block per bucket: current line 13/20 rgb(16,16,16), comparison line rgb(112,112,112) family under it, block step 56, hairlines between blocks.
- States: none captured.
- Behaviour: no row click.
- Copy: header labels are metric names; the first column is the bucket date.
- Evidence: measured.

### data.report-table: list the records behind a report

- Intent: learn which sessions, codes or events make up a figure; do search, filter and page.
- Use when: the report ends in a records list with its own filters. Not when: bucket totals, see `data.period-table`; the list is a plain index page with no report above it, see `index.page-frame`.
- Ask: which columns? [name, status, date, one key number]; filter keys? [status and date]; search on? [the name]; what does a row open? [its detail page]; page size? [50].
- Admin: the index filter bar and index table, reused under analytics reports. Seen 2026-11-14 on index pages; no analytics records list was captured.
- Shape: a view pill, a "Search and filter" field, sentence tokens ("Extension is Honey"), a filter-name list on focus, a value list, an add button, clear all. Column headers carry dotted definitions. Badges stay on one line per row. Paging "Showing a to b of N", 50 per page.
- States: empty "No sessions match these filters" and "No qualifying sessions in this period". The open filter list is transient and not in the URL.
- Behaviour: filters and page live in per-table URL keys; a deep link restores a token.
- Copy: "Showing 1 to 50 of 1,242".
- Evidence: observed.

### data.chart-empty: show a chart or breakdown with nothing to plot

- Intent: learn that there is no data in the period.
- Use when: a period has zero values or no rows. Not when: the feature was never set up, see `onboarding.setup-guide`; a list has no rows, see `index.no-results` and `index.empty-first-run`.
- Ask: what does the empty message say? [that nothing was found for the period]; does it suggest a next step? [no].
- Admin: Analytics overview on a store with 0 orders, seen 2026-11-14.
- Shape: values show "$0.00", "0" or an em dash for rates. The line chart draws a flat line at 0 with axis 0 to 10. Breakdown and donut cards have an empty line of their own (see their entries).
- States: loading skeletons and error were not captured (data arrived before the first dump).
- Behaviour: tiles stay links.
- Copy: "No protected orders found for this period".
- Evidence: observed.

### data.experiment-results: read an experiment's outcome by variant

- Intent: learn whether a variant beat the control; do read each metric per variant and the timeline.
- Use when: an A/B test or rollout has results with a confidence level. Not when: one figure per period, see `data.metric-tile`; the series is a plain trend with no variants, see `data.line-chart`.
- Ask: which metrics per variant? [the goal metric and two guards]; which confidence threshold marks a winner? [p at most 0.05]; which charts? [one per metric over time]; what do the sidebar sections show? [timeline and audience].
- Admin: Rollouts > results (`/rollouts`). Not seen live: the store has no rollout, so this was read from the admin's front-end bundle on 2026-11-14.
- Shape: two columns, main flex 1, sidebar 19.5rem (under 65em it drops below the main column), gap 16. Main: an insight row (flex, centred, gap 8) with a trend chip 36x36 radius 8 (positive: success icon on the success secondary fill; negative: arrow flipped on the critical secondary fill; inconclusive: tertiary fill) and a small heading with a subdued paragraph. Metric table in a section with no padding: grid `minmax(11.25rem,1fr) 1fr 1fr auto`, gap 4, padding 8. Header row min 40: "Metric" strong, then per treatment an 8px dot and the name 600. Data rows bg-surface-secondary, radius 8, min 36, cells padding 8/16, the metric name semibold with a definition popover, the value plus a change badge. Charts in a grid, 280 high with axes, series colours #13acf0 (control) and #6a42e9 (treatment). Sidebar: "Timeline" (calendar-time icon, duration, dot events) and "Audience" (globe and markets, team and "{n}% of visitors", per arm an 8px dot and "{n}% allocated to {label}").
- States: no data shows a disabled icon on a neutral chip and "Insights not yet available". Change badge: arrow plus percent (2 decimals), tone success or critical when p is at most 0.05, otherwise neutral, none on the control column. Popover "Change over control" or "Inconclusive".
- Behaviour: status badges sit beside the page title (Active success, Expired neutral).
- Copy: "Insights not yet available", "Change over control".
- Evidence: docs (admin bundle, not seen live).

### data.attribution-controls: pick how credit is assigned and which traffic is counted

- Intent: do change the model behind the numbers.
- Use when: the same data has several interpretations. Not when: only a period changes, see `data.period-pill`.
- Ask: Which models? [last non-direct click, last click, first click, any click, linear]. Which traffic? [all, marketing, paid, organic].
- Admin: Growth > Attribution (`/growth/attribution`), seen 2026-11-16.
- Shape: period pill, compare pill, then a model select showing the current choice and "A 30-day attribution window applies." The options each carry a one-line description ("Equal credit given to each click"). A second select "Marketing traffic" with described options. Metric definitions show a formula as a sentence of chips.
- Evidence: observed.

### data.live-metrics: read what is happening right now

- Intent: learn current visitors, sales and orders as they update.
- Use when: the numbers change by the minute. Not when: the merchant reads a period, see `data.overview-grid`.
- Admin: Analytics > Live View (`/analytics/live`), seen 2026-11-16.
- Shape: a status line "Live View. This page is ready" and a "Just now" stamp. A grid of metric cards, each with its own window subtitle ("Last 5 minutes", "Since midnight", "Last 10 minutes"): Visitors right now, Total sales, Sessions, Orders, Customer behavior, Sessions by location, New vs returning customers, Total sales by product.
- States: empty cards say "No data for this date range".
- Evidence: observed.
