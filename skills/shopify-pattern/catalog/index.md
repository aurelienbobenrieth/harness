# Index

The merchant wants to browse, find, narrow and act on many records, then open one.

### index.page-frame: see a list of records and create one

- Intent: learn what the list holds; do create a record or open one.
- Use when: the page is a flat list of one kind of record to search and open (Orders, Discounts). Not when: the same list needs headline numbers above it, add `index.metrics-strip`; the list is short and sits in a card or modal, see `index.resource-list`; the page shows numbers and trends without rows, see `data.*`; the page is a list of links to settings pages, see `navigation.settings-link-list`; the records are saved rules, see `index.segment-list`; the work is a queue with a state per row, see `index.queue-table-recovery`.
- Ask: which columns? [name, status, date, one key number]; sortable? [yes, newest first]; free-text search? [yes, on the name]; filters? [status and date]; saved views? [All only]; bulk actions? [none]; what does a row open? [its detail page]; numbers above the table? [no], see `index.metrics-strip`; primary action? [create a record]; secondary actions? [Export, if the data leaves the app].
- Admin: Orders, Discounts (`/orders`, `/discounts`), seen 2026-11-14.
- Shape: dark frame, white page panel (radius 16, inset 4) with no card around the table. One title row 28 high at y 16: 20px icon, h1 13px/28px 500, optional picker pill. Right side: secondary buttons, then one primary, gap 6. Order in the panel: title row, metrics strip (when there is one), filter bar, table, pagination pill. Nothing else: no sentence of introduction or help above the metrics or the table (a metric explains itself in its heading's tooltip, a column in its header, see `index.settings-table-header-help`).
- Behaviour: the host draws the title bar from App Bridge. The table sits straight on the panel; rows are the click target.
- Copy: primary is verb plus noun ("Create order", "Create discount"). Secondary example: "Export".
- Evidence: measured, https://shopify.dev/docs/api/app-home/latest/patterns/templates/resource-index

### index.view-menu: switch between saved slices of the list

- Intent: learn which slice is shown; do switch to another view or a custom one.
- Use when: the list has a few named slices of one record type (All, Unfulfilled, Unpaid). Not when: the slice is a free condition the merchant builds, see `index.filter-tokens`; the choice is between places, see `navigation.views-vs-tabs`.
- Ask: which named slices? [All only; add one per status the merchant works through]; can the merchant save and duplicate their own views? [no]; which view opens first? [All].
- Admin: Orders, Discounts, filter bar left end, seen 2026-11-14. Also: Settings > Users and Roles use the same index view bar (tabs All, Active, Pending, search and sort icons) inside a settings page. Files, Metaobjects and Catalogs use the same view bar with Sort by, Columns and "Reset view | Save | Update view | Save as new view" (seen 2026-11-16).
- Shape: a pill dropdown at the left of the filter bar, not tabs. Pill 51x28, radius 9999, padding 0 2 0 8, label 12/18 500, up-down chevron in a 20px box. Menu is a popover (`role=menu`, label "Select a view") 4 to 5 below the pill, radius 16, min width 188 (222x204 with six items), inner padding 4. Rows are `menuitemradio`, 28 high, radius 12, padding 4 32 4 4, gap 8, 20px check, label 13/20.
- States: pill hover bg rgba(0,0,0,.08), open rgba(0,0,0,.13), keyboard focus 2px outline offset 1. Checked row weight 600 with a visible check; unchecked hidden, shown at .35 on row hover. A row has a "View actions" 24x24 "…" button; its menu holds "Duplicate view". After a change the bar adds an eye toggle, "Reset view" and "Save" (disabled grey until changed). Measured 2026-11-16: view pill 28 high, radius 9999, hover bg rgba(0,0,0,.08). States: see `actions.chip`.
- Behaviour: choosing a view writes `savedViewId` and its own `query` to the URL. The pill label is the view name only, no counts.
- Copy: "All", "Unfulfilled", "Unpaid", "Open", "Archived", "Return requests", then custom views.
- Evidence: measured.

### index.search-and-filter: find records by text or by a condition

- Intent: learn which records match; do type text or build a filter in one field.
- Use when: the merchant narrows one list. Not when: the choice is a fixed slice, see `index.view-menu`; several keys are combined as a sentence, see `index.filter-tokens`; the key and value are picked from a list, see `index.filter-popovers`.
- Ask: search on which fields? [the name]; which filter keys? [status and date]; any key the merchant must not need typing? [none].
- Admin: Orders filter bar, seen 2026-11-14.
- Shape: one contenteditable `role=textbox` "Search and filter", not a search box plus a filter button. Container is a card-shadow bar 36 high (padding 4, row 28), radius 12; the field is radius 8 (12 on focus), text 13/20, 20px search icon #606060. Row order: view pill, field (flex), display options button 28x28.
- States: keyboard focus draws the input focus ring; pointer focus none. Clear (x-circle 20x20) shows once there is text or a token. The plus-circle 20x20 "add filter" shows after the last token or text, never on an empty field. Padding right grows to 28 when there is content.
- Behaviour: free text follows the tokens as plain text. Typing a filter name also searches rows by that text. State goes to the URL, see `index.url-state`.
- Copy: placeholder "Search and filter".
- Evidence: measured.

### index.filter-tokens: build and edit a filter as a sentence

- Intent: learn what is filtered; do pick a key, an operator and values, and remove them.
- Use when: the list has several filter keys. Not when: one key exists and the views already cover it; show only the view pill and the search text, see `index.view-menu`; the field is plain text only, see `index.search-and-filter`.
- Ask: which filter keys? [status and date]; which operators? [Is, Is not]; which values per key? [the key's known options].
- Admin: Orders filter bar, seen 2026-11-14.
- Shape: tokens live inside the search textbox, 20 high, 12px 400. Key part "Payment status is": bg #f2f2f2, radius 8 2 2 8, padding 2 4 2 6. Value part "Authorized": bg #d2f6fe, text #01246f, radius 2 8 8 2, padding 2 6 2 4. Gap 1 between the parts. Flow: key list, then operator list ("Is", "Is not"), then value list.
- States: chip hover #ebebeb (key) and #b2e9f6 (value); active (popover open) #ddd and #a0e5f7. The remove x on the value chip appears on hover.
- Behaviour: Enter picks the highlighted option, Escape removes an unfinished token, ArrowUp and ArrowDown move. The first row is highlighted on open and after each keystroke. A deep link rebuilds both tokens and the text.
- Copy: "<Name> is", "<Name> is not", "Is", "Is not".
- Evidence: measured.

### index.filter-popovers: choose the filter key and its value

- Intent: learn which keys and values exist; do pick one without typing it.
- Use when: the caret is in the search field (key list) or on a value token (value list). Not when: the value is a date; use the date choice list described under Behaviour; the merchant reads or edits the finished token, see `index.filter-tokens`.
- Ask: which date ranges? [Today, Last 7 days, Last 30 days, Last 90 days, Last 12 months, Custom range]; which keys offer a value list? [every key with fixed options].
- Admin: Orders search field, seen 2026-11-14.
- Shape: key list popover anchored at the caret, 6 below the field, radius 16, popover shadow, width by content (min 200, list about 291, max 300), max height 292 and scrolls. Rows 28 high, padding 4 8, radius 12, 13/20, list padding 4. The highlighted row (also hover) is #f7f7f7 and shows an "Enter" hint at the right: padding 1 4, bg #f2f2f2, border 1px #ddd, radius 6, return icon 16 plus "Enter" 12/16. Value popover: min width 200, checkbox rows 28 high (16px checkbox, gap 6), 1px #f2f2f2 divider, then "Is" and "Is not" rows with a 20px check (selected weight 500).
- Behaviour: typing narrows the key names (contains, case-insensitive). Toggling a value makes the value chip appear. A date key shows a single-choice list (Today, Last 7 days, Last 30 days, Last 90 days, Last 12 months, Custom date, Custom range) with a check, then "Is / Is not". "Custom range" types the dates in the token ("Starting ... Ending ...") with a bare calendar popover under the part being edited; a start moves on to the end; a complete range applies, closes the calendar and reopens the key list. The key list also offers "<date key> is not".
- Copy: date choices as listed above.
- Evidence: measured; the date flow is observed.

### index.display-options: pick the sort and the visible columns

- Intent: learn what the table shows and in what order; do change the sort, hide a column or reorder columns.
- Use when: the list has more columns than fit or more than one sort key. Not when: the merchant sorts by clicking one heading, see `index.sortable-heading`; columns are fixed (leave the button out).
- Ask: which sort keys? [the date and the main number]; default sort? [newest first]; which columns can be hidden or reordered? [all but the name]; which columns start hidden? [none].
- Admin: Orders filter bar, right end, seen 2026-11-14. Also: `/products` lists per-column Hide and Show items, "Reset view", "Save", "Update view" and "Save as new view", with keyboard shortcuts.
- Shape: trigger is a tertiary icon button 28x28 (icon `layout-columns-3`, label "Display options"). Popover 276 wide, radius 16, popover shadow, right aligned under the button. Section 1 (padding 8 6): "Sort by" row 24 high (icon `sort` 20, label 13/20) with a key button at the right (padding 2 0 2 6, radius 8, `select` icon), then toggle rows (24 high, switch 32x16). 1px #f2f2f2 divider. Section 2: label "Columns" 13/500 #4A4A4A, then rows 24 high (drag-handle icon 20, label 13/20, eye button 20x20 radius 4 at the right).
- States: trigger hover bg rgba(0,0,0,.08), open or pressed rgba(0,0,0,.13). A hidden column has label #4A4A4A and an eye-off icon, and keeps its place. A dragged row is at .5 opacity and the others shift. The sort key picker is a nested popover (min width 142, options 28 high, radius 6, check 20, selected weight 600). Directions read by type: "Oldest first / Newest first", "A-Z / Z-A", "Ascending / Descending".
- Behaviour: choosing a key keeps the direction and keeps the outer popover open. Order and visibility persist into the table and the URL (`selectedColumns`). Rows are keyboard sortable (`role=button`, sortable).
- Copy: "Sort by", "Columns", aria-labels "Hide <column>" and "Show <column>".
- Evidence: measured.

### index.sortable-heading: sort the table from a column heading

- Intent: learn which column leads the sort; do sort by another column.
- Use when: a column is worth sorting. Not when: the sort key is not a column, or the merchant also hides and reorders columns; use `index.display-options`.
- Ask: which columns are sortable? [date, name, numbers]; default sort? [newest first].
- Admin: Orders table header, seen 2026-11-14.
- Shape: the whole header cell is the button. Padding 6 (first cell takes the table edge padding), full width, 12px/18px 500 #4A4A4A on the header row bg #F7F7F7, no hover bg, no radius. Arrow 16x16 (`arrow-up` or `arrow-down`, 12px glyph, #101010) right after the label with no gap; its space is always reserved so nothing shifts. Header row 31 high. Numeric columns align end, arrow still after the label.
- States: hover or keyboard focus shows the arrow at opacity 1 (.1s); an unsorted column previews the up arrow; the sorted column keeps its arrow. Focus ring 2px #1650d0, offset -4. Measured 2026-11-16: heading button 30 high, padding 6, 12px/500 #4A4A4A, pointer cursor; focus ring 2px #5083F0 offset -4 (the #1650d0 above is the older reading).
- Behaviour: click unsorted sorts ascending; click sorted flips. The URL gets `order=<field>+asc|desc`. A column that is a metric with a meaning draws a dotted underline under its label, with a tooltip.
- Evidence: measured.

### index.table-rows: scan records and open one

- Intent: learn each record's facts; do open it.
- Use when: the records are one entity per row. Not when: a cell opens its own popover (customer, items); that cell takes the click and the row keeps the rest; the rows have a picture, see `index.thumbnail-title-cell`; the list is short and sits in a card, see `index.resource-list`.
- Ask: which columns? [name, status, date, one key number]; what does a row open? [its detail page]; row actions? [none]; checkboxes for bulk actions? [no], see `index.bulk-bar`; which cells are interactive? [none].
- Admin: Orders, Discounts tables, seen 2026-11-14.
- Shape: header 31 high, bg #f7f7f7, labels 12/18 500 #4a4a4a. Body rows 32 high for one line and 52 to 53 for two lines. Cell text 13/20 400. The first column holds a checkbox. Badges sit inline in the cell.
- States: row hover bg #f7f7f7; selected row bg #f2f2f2. Hovering an interactive cell shows a chevron and a cell bg. Measured 2026-11-16: row hover fills each cell #F7F7F7 (the row is display: contents) with a pointer cursor; buttons nested in cells are 32 high. States: see `actions.clickable-row`.
- Behaviour: the row is the click target and opens the detail (`/orders/<id>`); browser Back returns to the same list view. Click target: the whole row is clickable, the label keeps the text color (never a blue link), and an underline appears only when the label itself is hovered (owner review, not dumped). A control inside a row (copy, a menu) does not open the row. On a phone the admin's list shows unlabelled facts under the title. A cell holds no text call to action such as "View details": the row itself opens the record, and an action on a row is an icon button or a menu in the last cell (owner review, 2026-11-16).
- Copy: dates in cells read "Nov 12 at 11:50 AM"; the year is dropped when it is this year. One placeholder glyph for an empty value.
- Evidence: measured; row Back behaviour observed, https://shopify.dev/docs/api/app-home/latest/patterns/compositions/index-table, https://shopify.dev/docs/apps/design/layout

### index.secondary-line: show a second fact under the title instead of a column

- Intent: learn a record's main second fact in the same cell as its name.
- Use when: one short fact belongs with the title (a discount's value) and is not compared across rows. Not when: it needs sorting or comparing, use a column, see `index.sortable-heading`.
- Ask: which fact goes under the title? [the one summary the merchant reads first].
- Admin: Discounts title cell, seen 2026-11-14.
- Shape: title 13/20 500, then a regular-weight summary line under it. Row is 52 to 53 high. A button in the cell must not grow the row: keep it 28 high with negative block margins inside the 20px line.
- States: on a phone the summary stays regular weight while the title is bold.
- Evidence: measured (row heights).

### index.source-badges: show where a record comes from in a cell

- Intent: learn which sites or sources a record is tied to at a glance.
- Use when: a cell lists several named sources. Not when: one status, use a badge, see `feedback.*`.
- Ask: which sources are shown? [all that apply]; how many before "+N"? [five]; what does the tooltip say? [the source names].
- Admin: none: the admin has no logo row in a table cell. Nearest: badges inline in a cell (`index.table-rows`), 20 high, radius 8, 12/18 500.
- Shape: a row of source logos (initials when a source has none), a count of the rest, and a tooltip. Up to five shown.
- Evidence: observed (badges only).

### index.bulk-bar: act on several selected rows

- Intent: learn how many rows are chosen; do run one action on them.
- Use when: the merchant ticks one or more row checkboxes. Not when: the action is about the whole list; use a title-bar action, see `index.page-frame`; the action belongs to one row, use a row action in the last cell, see `index.table-rows`.
- Ask: which actions on a selection? [none; delete only if records can be removed]; which need a confirmation? [destructive ones]; is "select all matching" needed? [no].
- Admin: Orders, 2 rows selected, seen 2026-11-14.
- Shape: the header row becomes the bulk bar, same 31 height and bg #f7f7f7. Left to right: indeterminate checkbox, "2 selected" menu (90x24), action pills (24 high, radius 9999, bg #ebebeb, padding 2 8, or 2 4 2 8 with a chevron, 13/20, gap 4), then "…". At the right a "Show all selected" switch (32x16) with its label.
- States: pill bg transition .4s cubic-bezier(.2,.8,0,1). Measured 2026-11-16: bar buttons are 24 high. On a Discounts row the status badge shows a chevron on hover (inline status change) and a copy icon appears next to the title (observed 2026-11-16).
- Behaviour: it replaces the column headings while rows are selected; clearing the selection restores them. Header checkbox is select-all and reads "44 selected"; unchecking one row gives "43 selected" with a filled header checkbox. On Orders, select-all picks all 44 rows and the bar shows Print, Create shipping labels, Mark as, Capture payments, Create batch, Move to batch, "...", then a "Show all selected" switch. On Discounts the bar actions are text buttons, then "..." and the switch (2026-11-16). Flow: see `flow.bulk-action-on-index`.
- Copy: "N selected", "Print", "Mark as", "Show all selected".
- Evidence: measured, https://shopify.dev/docs/api/app-home/latest/patterns/compositions/index-table

### index.pagination: move through pages of rows

- Intent: learn the range shown; do go to the previous or next page.
- Use when: the list passes one page (Discounts, 50 per page). Not when: the list fits one page; draw nothing.
- Ask: how many rows per page? [50].
- Admin: Discounts, seen 2026-11-14.
- Shape: a pill at the bottom left under the table, row 50 high: Previous icon button 28x28, range label "1-50" 13/20, Next 28x28. The pill floats at the bottom left.
- States: disabled arrow rgb(166,166,166); enabled rgb(96,96,96). Measured 2026-11-16: previous and next are a grouped pair, 28 high; disabled bg rgba(0,0,0,.03), text #A6A6A6, cursor auto. States: see `actions.split-button`.
- Behaviour: tooltips carry the key: "Previous (J)", "Next (K)". The URL carries `after` or `before` plus `start`, see `index.url-state`.
- Copy: "Previous (J)", "Next (K)".
- Evidence: measured, https://shopify.dev/docs/api/app-home/latest/patterns/compositions/index-table

### index.metrics-strip: read a few totals above the list

- Intent: learn the list's headline numbers for a period; do open the report behind one.
- Use when: the list has a few totals over a period (Orders). Not when: the page is an analytics report, see `data.*`; each number opens its own report on a tiled overview, see `data.metric-tile`. The same strip seen from the analytics side (overflow, period cell) is `data.metrics-strip`; read both. The period control is `data.period-radio-menu`.
- Ask: which totals? [two or three the merchant checks first]; which period? [last 30 days, selectable]; does a tile open a report? [yes, the report behind it]; trend line per tile? [yes].
- Admin: Orders (`/orders`), above the filter bar, seen 2026-11-14. Also: `/products` strip is a period pill then three metrics, one with a link-style value (ABC product analysis).
- Shape: strip 68 high, 8 outer padding, y 57 (13 below the title row); the filter bar starts 16 below it. Period button 111x52 with a calendar icon. Tiles 209x52, padding 4 12, radius 8, step 225 (gap 16). Tile heading 13/16 600 with a dotted underline (a definition button); value 13/20 600; sparkline 80x20 at the right (end points x 2 and 78, baseline y 18, stroke 1.5, #13acf0). Back and forward arrows 28x28 at the right behind a white fade.
- States: arrows disabled rgb(166,166,166). Hover or focus on a heading opens a definition tooltip, not a navigation.
- Behaviour: each tile links to its report (`/analytics/reports/...?ql=...`). A tile that does nothing on click is a gap.
- Evidence: measured, https://shopify.dev/docs/api/app-home/latest/patterns/compositions/metrics-card

### index.no-results: say the filter or search matched nothing

- Intent: learn that nothing matched; do change the filter or search.
- Use when: the list has records but the view, filter or text matches none. Not when: no record exists at all, see `index.empty-first-run`.
- Ask: what does the message say? ["No <records> found" and a hint to change filters]; a clear button? [no, the bar's clear icon is enough].
- Admin: Orders, a filter token plus text with no match, seen 2026-11-14.
- Shape: the filter bar stays above. Centred block 315 wide, 16 below the header row (box padding 32 0): search illustration 60x60 (#8C9196), 21 gap, title 22/28 500, 16 gap, body 13/20 #4a4a4a. The captures disagree on a button: one shows a primary "Clear search and filters" (28 high, padding 6 12, 12/16 500, bg #101010) 20 below; the other shows none.
- Behaviour: the bar's clear icon also clears. Opening the URL directly restores the tokens and the empty result.
- Copy: "No orders found"; "Try changing the filters or search terms for this view".
- Evidence: measured.

### index.empty-first-run: invite the first record when none exist

- Intent: learn the list is empty; do create the first record or learn about it.
- Use when: no record exists in the list. Not when: records exist but none match, see `index.no-results`.
- Ask: what does the empty state invite? [create the first record]; what does it say the record is for? [one sentence]; a "Learn more" link? [yes, if a help page exists].
- Admin: Purchase orders, seen 2026-11-14 (Orders and Discounts were not empty in the store).
- Shape: the filter bar stays above (view pill "All", Save disabled). Illustration 226x226 centred; title 15/22 500 right under it; body 12/18 400, 6 below; primary button 28 high (padding 6 12, radius 9999), 16 below. A "Learn more about <records>" link pill 28 high sits outside the block, about 116 below the button.
- Copy: title and body name the record; button "Create <record>".
- Evidence: measured, https://shopify.dev/docs/api/app-home/latest/patterns/templates/resource-index

### index.url-state: keep the list view in the URL

- Intent: do return, share or reload and see the same view.
- Use when: any index state (view, query, sort, columns, page). Not when: transient UI (an open popover, a selection).
- Admin: every index, seen 2026-11-14.
- Shape: query keys. Saved view `savedViewId=<id>` (plus its own `query`). Search and filters `query=` in Shopify search syntax, free text last (`query=financial_status:"authorized" zzqx`). Sort `order=<field>+asc|desc`. Columns `selectedColumns=A,B,C`. Pages `after=<base64>` or `before=<base64>` plus `start=<base64>`.
- Behaviour: a deep link restores view, tokens, text, sort and columns. Opening a row then browser Back returns to the same URL. A key at its default is left out. Choosing adds a history entry; typing replaces it, see `navigation.push-vs-replace`. Flow: see `flow.return-to-list`.
- Evidence: measured.

### index.resource-list: browse a short list of same-type items in a card or modal

- Intent: learn which items exist; find one; open it or select several.
- Use when: the collection is small or the selection sits inside a card or a modal. Not when: many records need columns, sorting and paging, see `index.table-rows`; the page itself is the list, see `index.page-frame`.
- Ask: search? [yes]; filters and sort? [none until the list passes about ten]; selecting several? [no]; what does a row open? [its detail page]; row actions? [none].
- Admin: Shopify dev docs > API > App Home > Patterns > Compositions > Resource list (`https://shopify.dev/docs/api/app-home/latest/patterns/compositions/resource-list`), seen 2026-11-16.
- Shape: a section holding a search field with a search icon, a filter button opening a popover, removable chips for active filters with a "Clear" link, a sort select, then one row per item: checkbox, avatar or thumbnail, heading, detail text, chevron. A "Showing 2 customers" line gives the count.
- Behaviour: a clickable row has an `href` to the item's detail page. Row actions open a popover menu; destructive items use critical tone and confirm in a modal. Toasts confirm actions and pass `isError` for failures.
- Copy: "Filter customers", "Showing 2 customers", "Delete customer?", "Customer archived".
- Evidence: docs, https://shopify.dev/docs/api/app-home/latest/patterns/compositions/resource-list

### index.thumbnail-title-cell: show a record's picture beside its name

- Intent: scan records by image and name.
- Use when: records have an image. Not when: none do, see `index.table-rows`.
- Ask: which columns beside the name? [status, one key number]; what does a row open? [its detail page].
- Admin: `/products`, seen 2026-11-16.
- Shape: row: checkbox, square framed thumbnail, bold name (wraps), Status badge, Inventory text ("20 in stock", "30 in stock for 3 variants", "Inventory not tracked"), Category, counts right aligned (Channels, Catalogs), Product type, Vendor.
- Evidence: observed

### index.inventory-table: adjust stock by location

- Intent: learn stock states; do edit Available and On hand.
- Use when: stock lives per location. Not when: totals only, see `index.table-rows`.
- Ask: which quantities are editable? [Available and On hand]; which locations? [all, one at a time]; which columns? [Unavailable, Committed, Available, On hand, Incoming]; save per row or all at once? [all at once].
- Admin: `/products/inventory`, seen 2026-11-16. Edit and adjust popover not opened.
- Shape: location select, view tab All, Save; columns Image, Product (variant as second line), SKU ("No SKU"), Unavailable, Committed, Available, On hand, Incoming; the URL keeps `?location_id=`.
- Evidence: observed

### index.queue-table-recovery: list unfinished records with email and recovery status

- Intent: scan abandoned checkouts by email and recovery state; do open one or export.
- Use when: the list is a work queue with a state per row. Not when: plain records, see `index.table-rows`.
- Ask: which state columns? [status badges]; which recovery or follow-up actions per row? [none]; export? [yes]; what does a row open? [its detail page]; a banner about automation? [no].
- Admin: `/checkouts`, seen 2026-11-16.
- Shape: title with Export and "View automation" actions, info banner about the new automation, "All" view tab, columns Checkout, Created, Customer name, Email status, Region, Recovery status, Total price. Status columns are badges.
- Evidence: observed.

### index.segment-query-bar: start a segment from the customer list

- Intent: describe a group of customers in words or code; do save it as a segment.
- Use when: the list can be narrowed by a rule set. Not when: a simple filter, see `index.search-and-filter`; the merchant manages saved rules, see `index.segment-list`.
- Ask: describe in words, in code, or both? [words]; which columns in the result? [name, key facts]; can the result be saved? [yes, as a saved rule].
- Admin: Customers index ("Start a query / Describe your segment" above the table), seen 2026-11-16.
- Shape: a one-line input above the table with the placeholder text; table below with columns Customer name, Note, Email subscription, Location, Orders, Amount spent.
- Evidence: observed.

### index.segment-list: list saved segments with their share of customers

- Intent: see which segments exist and how big; do open or create one.
- Use when: saved rules are the records. Not when: records are people, see `index.table-rows`; the merchant is writing a new rule, see `index.segment-query-bar`.
- Ask: which columns? [name, share, last activity, created by]; what does a row open? [its editor]; actions per row? [none].
- Admin: `/customers/segments`, seen 2026-11-16.
- Shape: "Create segment" primary. Table Name, "% of customers", "Last activity" ("Edited on Nov 4, 2024"), "Created by" (Shopify or a person), Actions.
- Evidence: observed.

### index.live-theme-card: show the live theme and its main action

- Intent: learn which theme is live; do edit it.
- Use when: one item is "the live one" among drafts. Not when: all items are equal, use a list.
- Ask: which actions [Edit theme, "..." menu, Preview store in the title bar]? Draft list below [yes, with Import and New]?
- Admin: Online Store (`/themes`), seen 2026-11-16.
- Shape: full-width rounded card filled with the storefront preview. Bottom overlay on a dark gradient: name in large white text, subline "test-data . Last saved: Nov 6 at 6:33 pm", right side white pill "Edit theme" and a faint "..." button. Next: "Draft themes" h2 with "Import" (split) and "+ New" grey pills.
- Evidence: observed.

### index.file-library: browse, upload and organise media files

- Intent: learn which files exist and where they are used; do upload, rename, open a file.
- Use when: the records are images and documents that other records reference. Not when: the media belongs to one record, see `form.media-dropzone`.
- Ask: Which columns show by default? [thumbnail, name, alt text, date added, size, references]. Folders? [yes, "New folder"]. Upload from a URL too? [yes].
- Admin: Content > Files (`/content/files`), seen 2026-11-16.
- Shape: an index table, not a grid. Title "Files"; primary "Upload files", secondary "Upload from URL" and "New folder". View bar "All", sort (Date added, File name, Size), Columns (Alt text, Date added, Size, References, Updated). Row: checkbox, thumbnail, name with extension, alt text, date, size, references count ("1 product").
- States: header checkbox reads "Select all 20 on page"; dirty view shows Reset view, Save, Update view, Save as new view.
- Behaviour: the row link opens the file editor page (see `detail.media-file-editor`); dropping files on the page uploads them ("Drop your files here" overlay).
- Evidence: observed.

### index.graph-view-toggle: offer a graph view next to the table

- Intent: do see how records relate to each other.
- Use when: records form a hierarchy. Not when: records are flat.
- Admin: Markets index, secondary button "Graph view"; each row has "View on graph", seen 2026-11-16.
- Shape: tabs "Markets", "Store default", "Regions" over a search, Filter (F), Sort bar. Columns Market, Status, Includes, Customizations (chips such as Shipping, Catalogs, Domain / languages).
- Evidence: observed.

### index.report-library: browse available reports by name and category

- Intent: do open a built-in or custom report.
- Use when: reports are many and fixed. Not when: the list is of records, see `index.table-rows`.
- Ask: Search and filters? [none; category is a column]. Custom reports? ["New exploration"].
- Admin: Analytics > Reports (`/analytics/reports`), seen 2026-11-16.
- Shape: title Reports, primary "New exploration". Table Name, Category (Orders, Marketing, Acquisition, Behavior, Customers, Finances), Last viewed, Created by ("Shopify"), row Actions. Sort "Oldest first / Newest first".
- Behaviour: the row opens `/analytics/reports/<key>`.
- Evidence: observed.

### index.settings-table-header-help: explain a column in its header

- Intent: learn what a status or flag column means; search, sort and act on a short list.
- Use when: columns carry terms merchants may not know. Not when: values explain themselves.
- Ask: Which columns need help? [Status and Data]. Search and sort? [yes, search field with a sort icon above the rows].
- Admin: Settings > Customer events pixel table, seen 2026-11-16.
- Shape: section title with an info icon and help; card with "Search pixels" field and a sort icon button; table Name (name plus a "Web" sub-label) | Status | Data | Actions. Header cells with help have a dotted underline and a tooltip. A cell can hold a two-line value: "Optimized" plus "Access on: We detect signals such as referred traffic and campaign settings."
- Behaviour: sort menu A-Z / Z-A.
- Evidence: observed.
