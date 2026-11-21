# Feedback

The merchant knows what happened, what is wrong, or what something means.

### feedback.banner: tell the merchant something that stays visible

- Intent: learn a condition or a problem that affects the page; do the action it offers or dismiss it.
- Use when: the message must stay until it is resolved or dismissed. Not when: a quick confirmation (`feedback.toast-when`, `chrome.toast-host`); help for one field (`feedback.field-error`, `feedback.help-text`); a list of form errors on Save, see `form.validation-banner`; a status word on a record, see `feedback.badge`; a problem on a record page, see `detail.banner-in-body`.
- Ask: which tone? [info, warning or critical by severity]; dismissible? [info only]; which action does it offer? [one]; where does it sit? [top of the column].
- Admin: order "Test order" (warning), form errors (critical), connect domain modal (info), seen 2026-11-14.
- Shape: radius 20, no border, no shadow, full column width. Padding 16. 20px tone icon at 16 left, heading 13px/20px 500 at x + 42, body 13/20 under it. A dismiss button 24x24 sits at the top right when present.
  - warning: bg rgb(255,245,197), text rgb(49,37,0). 760x80.
  - critical: bg rgb(255,231,230), text rgb(54,2,0), list items rgb(126,16,12). 760x100.
  - info: bg rgb(210,246,254), text rgb(0,44,56). 580x52 inside a modal.
- States: success tone was not seen in this store.
- Behaviour: critical sits at the top of a form with a list of the fields to fix. Inside a modal it grows the modal.
- Copy: a heading sentence, then the body, for example "Domain available for purchase".
- Evidence: measured, https://shopify.dev/docs/apps/design/user-experience/alerts

### feedback.toast-when: pick a toast or something else

- Intent: decide whether a result gets a toast.
- Use when: a reversible, low stakes action finished and the merchant stays on the page ("Link created", "Settings saved"). Not when: copying (`feedback.copy-confirmation`), an error the merchant must act on (`feedback.banner`), a message that must stay until resolved (`feedback.banner`), a confirmation before deleting (`overlay.confirm-destructive`), a destructive result where the admin navigates away (no toast was seen at the next frame after deleting a domain).
- Ask: which actions get a toast? [reversible and quick]; what does it say? [past tense, three words or fewer]; an Undo? [only when reversible].
- Admin: toast not captured on 2026-11-14; the host draws it (`chrome.toast-host`).
- Behaviour: a toast is short and expires; do not carry facts the merchant needs later. Seen 2026-11-16: "Set as default" shows a dark pill toast "Changes saved" with a green check at the top centre of the page, not the bottom. Toasts are black pills top-centre in the title bar: "Discount created", "Changes saved", "Discount deactivated", "Discount activated", "Discount deleted", "Deactivated 2 discounts". Flow: see `flow.create-from-unsaved-page`, `flow.change-status-with-confirm`, `flow.delete-record-with-confirm`, `flow.bulk-action-on-index`.
- Copy: past tense, short ("Sending domain removed").
- Evidence: observed, https://shopify.dev/docs/apps/design/user-experience/alerts
- Docs differ: toasts appear at the top center of the app screen, https://shopify.dev/docs/apps/design/user-experience/alerts.

### feedback.copy-confirmation: confirm a copy in place

- Intent: learn that a value was copied; do copy it again.
- Use when: any copy-to-clipboard control. Not when: a toast, because the admin no longer uses one for copy.
- Admin: DNS records table on a domain verification page, seen 2026-11-14. Also: Discounts, where the check lasts 1.5 seconds and the tooltip is dropped meanwhile.
- Shape: icon button 28x28 (padding 4, radius 9999) at the end of the cell, `aria-label="Copy updated CNAME value"`. After the click the icon swaps to a 20px "check" in place, seen 250 ms after the click.
- States: the check returns to the copy icon after a delay (the admin's duration was not timed).
- Behaviour: no toast. The button keeps its accessible name.
- Evidence: measured.

### feedback.tooltip: explain a control on hover or focus

- Intent: learn what a control does or what a heading means.
- Use when: an icon button, a column heading or a term needs a short hint. Not when: a term beside a field label needs a definition, see `fields.help-tooltip`; the text is essential (put it in the page) or the element is only a tooltip trigger on something that is not a pointer target: a tooltip alone does not make an element clickable or give it a pointer cursor.
- Ask: which controls get a hint? [icon buttons and terms]; is the shortcut shown? [yes when one exists].
- Admin: back button in the title bar, pagination ("Next (K)"), the navigation toggle, seen 2026-11-14.
- Shape: appears 4 below the trigger (button bottom 44, tooltip 48), centred on it. 76x28 for a short label, bg rgb(26,26,26), radius 10, padding 4 8, text 13px/20px 400 rgb(238,238,238). Shadow is the family of the save bar. The nav tooltip shows a key chip.
- States: opacity and transform transition `.25s cubic-bezier(.19,.91,.38,1)`; it appears after about 0.5-0.9 s (within 900 ms). Measured 2026-11-16: bg #1A1A1A, text #EEE 13px, radius 10, max-width 250, above the trigger with a 4 gap, .25s from scale(.95); no delay measured. States: see `actions.tooltip-look`.
- Behaviour: on hover and keyboard focus; Escape closes. In a table on a phone, draw the text from an attribute so row labels stay clean.
- Copy: the action, plus the key in brackets for shortcuts, "Next (K)".
- Evidence: measured.

### feedback.badge: label a status

- Intent: learn the state of a record at a glance.
- Use when: a status word fits in a few characters. Not when: it needs a sentence, see `feedback.banner`.
- Ask: which statuses, which tones? [by meaning, see `feedback.status-colors`]; where shown? [table cell and page title].
- Admin: Unfulfilled, Paid, Expired, Needs setup, seen 2026-11-14.
- Shape: 20 high, radius 8, 12px/18px 500, padding 1 6 1 4 with a leading 12px icon.
  - attention: bg rgb(255,228,92), dark text, ring icon.
  - neutral: grey bg about rgb(235,235,235), dot icon for payment states.
  - info: light blue about rgb(210,246,254).
  - Success and critical tones were not present in this store; padding without an icon was not measured.
- Behaviour: inline in a table cell; in the page title 8 after the h1.
- Evidence: measured (tone colours marked "from crop" are approximate), https://shopify.dev/docs/apps/design/visual-design

### feedback.field-error: say what is wrong with one field

- Intent: learn why a value is invalid; do fix it.
- Use when: one field is invalid, below that field. Not when: several errors on a form, add a critical banner above (`feedback.banner`, `form.validation-banner`); you need the measured error anatomy, see `fields.error` and `form.field-error`.
- Ask: what does each invalid case say? [short and specific]; when does it show? [after Save].
- Admin: Add recipient, Add email domain, seen 2026-11-14.
- Shape: a line of critical text with an icon under the field, in place of its help text while the value is invalid; the field names it through `aria-describedby`.
- Behaviour: shown on submit or after the field loses focus; the primary stays disabled until valid.
- Copy: short, "Email is not valid".
- Evidence: observed (modal copy), https://shopify.dev/docs/apps/design/user-experience/alerts

### feedback.help-text: explain a field or a section

- Intent: learn what a setting means.
- Use when: the explanation is short and belongs next to the field. Not when: it is a warning that needs attention, see `feedback.banner`; you need the measured spacing and colour under a control, see `fields.help-text`; a term needs a definition, see `fields.help-tooltip`.
- Ask: which fields need help? [only where the label is not enough].
- Admin: settings sections and fields. Crowded screens are often long copy, so match the admin's length.
- Shape: subdued text under the control.
- Evidence: observed.

### feedback.screen-reader-text: name something only a screen reader needs

- Intent: learn a control's purpose without it showing.
- Use when: an icon control lacks a visible label. Not when: sighted users need the text too, show it.
- Admin: the copy button's `aria-label`.
- Evidence: observed, https://shopify.dev/docs/apps/design/../build/accessibility

### feedback.loading: show that something is working

- Intent: learn that content or a check is in progress.
- Use when: data or a check takes time. Not when: the wait is shorter than a blink; show nothing.
- Admin: a records table shows a 20px spinner and "Loading items…" 13/20 in place of rows; a primary button shows a grey disabled spinner while checking; the panel is blank white for about 1 s before a deleted resource resolves.
- Shape: skeletons for index, detail and analytics were not caught (pages loaded too fast).
- Behaviour: layout does not shift when the content arrives; controls keep their size.
- Copy: "Loading items…".
- Evidence: observed, https://shopify.dev/docs/apps/launch/built-for-shopify/requirements

### feedback.progress: show how far a multi-step task is

- Intent: learn how far along a guided task is.
- Use when: a flow has known steps. Not when: unknown length, use a spinner (`feedback.loading`).
- Ask: which steps, in what order? [the known ones]; can the merchant go back? [yes].
- Admin: DNS verification steps: step 1 open, steps 2 and 3 pending.
- Shape: each step has a 16x16 icon, a dashed circle while pending and a check when done. Active step colour rgb(16,16,16), pending rgb(74,74,74); pending titles rgb(166,166,166); steps sit 32 apart when collapsed.
- Evidence: measured.

### feedback.not-found: tell the merchant a page does not exist

- Intent: learn that the address is wrong; do find the right page.
- Use when: an unknown URL or a deleted resource id. Not when: the list is merely empty, see `feedback.empty-state`; a filter found nothing, see `feedback.no-results`.
- Admin: `/store/<store>/doesnotexist`, and `/discounts/<bad id>` shows the same page. The first frame is blank white for about 1 s. Seen 2026-11-14.
- Shape: the admin frame stays (nav, white panel radius 16, Sidekick bar); no title bar, no back arrow, no action button. One row centred in the panel: illustration 240x240, 20 gap, text column 428 wide. h2 29px/36px 500 rgb(16,16,16); p 15px/22px 400 rgb(74,74,74) directly under it.
- Behaviour: there is no "resource not found" variant. The document title becomes "Shopify".
- Copy: "There's no page at this address" and "Check the URL and try again, or use the search bar to find what you need."
- Evidence: measured.

### feedback.empty-state: say a list has nothing yet

- Intent: learn why a list is empty; do the first action.
- Use when: the list has no records at all. Not when: a filter or search returned nothing, see `feedback.no-results`; a page or id does not exist, see `feedback.not-found`.
- Ask: what does the empty list invite to do? [the first action]; a secondary link? [Learn more]; an illustration? [yes].
- Admin: Purchase orders index, seen 2026-11-14. Also: Campaigns "Centralize your campaign tracking" and Blog posts "Write a blog post" use a centred empty state with a primary button and "Learn more" (seen 2026-11-16).
- Shape: illustration 226x226, title 15px/22px 500 right under it, body 12/18 400 6 below, a primary button 28 high 16 below, a "Learn more" link pill outside the block. The filter bar stays above.
- Evidence: measured (cited only), https://shopify.dev/docs/api/app-home/latest/patterns/templates/resource-index

### feedback.no-results: say a filter or search found nothing

- Intent: learn that no record matches; do change the filters.
- Use when: a filter or search returned nothing. Not when: the list is truly empty, see `feedback.empty-state`.
- Ask: offer to clear the filters? [yes].
- Admin: an index with no match, seen 2026-11-14.
- Shape: centred block 315 wide, 16 below the header row. Search illustration 60x60 grey, 21 gap, title "No orders found" 22px/28px 500, 16 gap, body "Try changing the filters or search terms for this view" 13/20 rgb(74,74,74).
- Behaviour: the filter bar and tokens stay above.
- Evidence: measured (cited only).

### feedback.empty-value: write an empty value

- Intent: learn that a cell has no value.
- Use when: a table cell or field has none. Not when: a loading state.
- Admin: Polaris uses an em dash for an empty value. DNS table shows "(empty)" subdued for a current value.
- Behaviour: one glyph per product; do not mix "N/A", "-" and an em dash.
- Evidence: observed.

### feedback.no-hover-shift: keep layout still on hover

- Intent: learn nothing; the control only reacts to the pointer.
- Use when: any hover effect. Not when: nothing.
- Admin: hover fills are overlays (`::before`) with opacity and colour transitions; the box does not grow. Button transition `.4s cubic-bezier(.2,.8,0,1)` on background and shadow; sidekick button hover only changes bg.
- Behaviour: no border, margin or size change on hover or focus; a focus halo stays inside its container padding.
- Evidence: measured.

### feedback.status-colors: choose a colour for a state

- Intent: read a state from its colour and icon.
- Use when: a badge, banner or row signals a state. Not when: the value is a category such as a product type or tag, use a neutral chip or plain text; see `feedback.badge`.
- Ask: which states exist, and which are errors? [mapped by meaning, red only for blocked or failed].
- Admin: Shopify dev docs > App design > Visual design > Color (`https://shopify.dev/docs/apps/design/visual-design`), seen 2026-11-16.
- Shape: green is positive status or completion. Yellow is paused or incomplete, or non-urgent attention. Orange is in progress, pending or needs attention. Red is only for impossible, blocked or errored states. Blue `info` is for general information. Most text stays a legible neutral.
- Behaviour: never use a colour role to entice, to announce, to mean "coming soon", or to categorise. Never rely on colour alone: add an icon or words. Text contrast is at least 4.5:1. A row carries one severity signal at most.
- Evidence: docs, https://shopify.dev/docs/apps/design/visual-design
