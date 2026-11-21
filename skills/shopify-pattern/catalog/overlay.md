# Overlay

The merchant does a short task without leaving the page. These entries choose the app-side surface; the host draws the modal itself (see `chrome.modal`). A tooltip is not an overlay task, see `feedback.tooltip`.

### overlay.modal-vs-inline-vs-page: pick where a task happens

- Intent: choose the surface for an edit, a choice or a multi-step flow.
- Use when: deciding. Short task, one to a few fields, result returns to the same page: modal (`overlay.modal-edit`). One value that belongs to a row: inline in the page. Long, many sections, needs its own URL or a save bar: a sub-page (`form.*`). A flow that checks something then branches: a modal that grows, or navigates to a full page when the result needs room.
- Not when: the action only confirms a destructive step, see `overlay.confirm-destructive`. Neighbours to offer: a small edit in a modal (`overlay.modal-edit`); a block with many fields and a summary (`overlay.full-frame-edit-modal`); picking store records (`overlay.picker-modal`); a value edited in place (`fields.*`); a full create or task page (`form.create-page`, `form.task-page`).
- Ask: which task, and how many fields? [one to a few: modal; many sections: sub-page]; does it need its own URL? [no]; is there a draft with a save bar? [then a page].
- Admin: Domains, connect existing domain: a modal at `/settings/domains/connect` over the Domains page; a registered domain navigates to a full verification page (`/settings/domains/verifications/<id>`). Seen 2026-11-14.
- Shape: the modal URL sits over the list page; closing returns to the list.
- Behaviour: closing the modal returns to the list URL. Do not trap a long task in a modal.
- Evidence: observed.

### overlay.modal-edit: edit one small thing in a modal

- Intent: change one or two values and return to the page.
- Use when: the edit is small and self-contained, with its own Cancel and primary. Not when: the page has a draft and a save bar, see `chrome.save-bar`; more than about six fields or a summary of changes, see `overlay.full-frame-edit-modal`; the choice is a surface decision, see `overlay.modal-vs-inline-vs-page`.
- Ask: which fields? [one or two]; what does the primary say? [the verb]; any check before it closes? [no].
- Admin: connect domain modal, Add recipient, request integration, seen 2026-11-14. Also: Settings > Payments "Add manual payment method" is a one-select modal with a required star on the label; "Add package" is a larger modal with a segmented choice at the top.
- Shape: 620-wide modal (see `chrome.modal`). Body inset 20. Field label 13/20, 4 above a 580x30 control with radius 12. Footer: Cancel (secondary) and the primary, gap 8.
- States: primary disabled until the form is valid; a primary shows a grey spinner while it checks. An invalid value shows the inline error (see `feedback.field-error`).
- Behaviour: Enter submits when the primary is enabled; Escape and backdrop click close; a reopened modal starts empty, not on the last draft. An info banner may appear inside the modal after a check, which grows it. Seen 2026-11-16: Escape closes the add-package modal even when dirty, with no confirmation, while "Edit store address" ignored a script-sent Escape. Focus lands on the dialog container on open (Add package) or on the close X (Edit and Delete package); on close it returns to the trigger for Edit store address and the "..." row button, but goes to the body for Add package. Flow: see `flow.add-in-modal`.
- Copy: primary is the verb ("Next", "Add"); invalid email reads "Email is not valid".
- Evidence: observed.

### overlay.confirm-destructive: confirm before deleting

- Intent: learn what will be removed; do delete or cancel.
- Use when: the action is destructive and cannot be undone. Not when: the action is reversible (use a toast with Undo, see `chrome.toast-host`); the record owns data that can be reassigned, see `overlay.confirm-deactivate-with-inherit`.
- Ask: what is removed, what stays? [one plain sentence]; a typed confirmation? [no]; where does the merchant land after? [the list].
- Admin: Domains, More actions, "Delete domain", seen 2026-11-14. Also: Settings > Apps, uninstalling opens a small dialog "Uninstall <app>?" with Cancel and a red Uninstall, from the row "..." menu or the page header button "Uninstall app" (seen 2026-11-16).
- Shape: 620-wide modal, radius 24. Title h2 15px/22px 500 at inset 20; close 28x28 at inset 16; body 13/20 at inset 20, 16 below the title row. Footer right-aligned: Cancel (secondary) and a red primary named after the action ("Delete domain", bg about rgb(227,28,28), white 500 text). Height 144 for a title, one sentence and the buttons.
- Behaviour: one plain sentence, not a stack of banners and notes. A typed confirmation is added only when the product needs it. After deleting, the admin navigates back to the list with no toast visible at the next frame. Seen 2026-11-16: the delete button is red (rgb(216, 32, 25)) and names the noun ("Delete discount"); a reversible state change uses a dark primary button instead. A delete shows the toast "Discount deleted" (the "no toast visible" above is the 2026-11-14 reading, taken at the next frame). Flow: see `flow.delete-from-row-menu`, `flow.change-status-with-confirm`, `flow.bulk-action-on-index`.
- Copy: the primary repeats the action, "Delete domain".
- Evidence: measured, https://shopify.dev/docs/api/app-home/latest/patterns/compositions/index-table
- Docs differ: the docs show a toast after a delete or archive ("2 puzzles deleted"), where this entry observed none, https://shopify.dev/docs/api/app-home/latest/patterns/compositions/index-table.

### overlay.actions-popover: pick one action from a list

- Intent: do one of several actions on a row or a section.
- Use when: three or more actions on one object. Not when: page-level actions, see `chrome.more-actions-menu`; one action, show the button; the trigger is the "..." of an index row, see `overlay.row-menu`.
- Ask: which actions, in what order? [most used first, destructive last]; grouped? [no].
- Admin: row "..." menus and "More actions", seen 2026-11-14.
- Shape: popover radius 16; items 32 high, radius 12, padding 4 8 4 4, 13/20; group labels 12/18 rgb(96,96,96).
- States: Measured 2026-11-16: opacity and transform .25s cubic-bezier(.19,.91,.38,1), origin top right. States: see `actions.menu-item`, `actions.popover-animation`.
- Behaviour: opens below its trigger; Escape, outside click or choosing an item closes it.
- Evidence: measured.

### overlay.row-menu: reach actions from the "..." in a row

- Intent: do a row-level action without opening the record.
- Use when: an index row has secondary actions. Not when: the action is the row's main click, see `index.*`; the list of actions belongs to a section or page, see `overlay.actions-popover`.
- Ask: which row actions are secondary? [all but the main click]; what does the row's main click do? [opens the record].
- Admin: index rows and cards, the "..." button. Also: Settings > Shipping Packages rows and Currency display use a "..." button named "More actions". Settings > Apps rows hide items per row (Get support only for public apps) and the trigger label names the row ("More actions for Flow"), seen 2026-11-16.
- Shape: icon button 28x28 with radius 9999, opening an actions popover (`overlay.actions-popover`).
- States: see `actions.menu-item`.
- Behaviour: the button has an accessible name; the click does not open the row. Flow: see `flow.delete-from-row-menu`.
- Evidence: observed.

### overlay.picker-modal: pick records in a modal

- Intent: choose one or more existing records (collections, products).
- Use when: the merchant must choose from the store's catalog. Not when: the options are a few static values, use a select or choice list, see `fields.*`; the pick needs search with filters and variants, see `overlay.product-picker-search`; the pick sits inside a create form, see `form.resource-picker`.
- Ask: products or collections? [per target]; one or many? [many]; which are preselected? [the current picks].
- Admin: App Bridge `resourcePicker`, drawn over the store's catalog.
- Shape: the admin draws the picker; the app receives the picked resources, or nothing when the merchant cancels.
- Behaviour: cancel returns nothing; selection returns the resources.
- Evidence: docs, `https://shopify.dev/docs/api/app-home/apis/resource-picker`, https://shopify.dev/docs/api/app-home/latest/patterns/compositions/resource-list

### overlay.view-all-modal: see the full list from a card

- Intent: read every item when the page shows only the first few.
- Use when: a card truncates a list and no sub-page is needed. Not when: the list needs search, filters or a URL, see `index.*`.
- Ask: how many items does the card show? [the first few]; searchable in the modal? [no, then see `index.*`].
- Admin: not captured as a measured state.
- Shape: a modal (see `chrome.modal`, large size) with the full list; the card shows a "View all" link.
- Behaviour: closing returns to the card.
- Evidence: docs has no dump for it.

### overlay.popover-placement: place a popover and decide what closes it

- Intent: open extra controls next to a trigger.
- Use when: a popover opens from a button or field. Not when: a hover hint, see `feedback.tooltip`.
- Admin: period picker, More actions, row menus, seen 2026-11-14.
- Shape: opens below its trigger; the flyout of the collapsed rail opens at rail + 5 from the item's top.
- Behaviour: Escape, outside click or picking an item closes it; let the kit close it itself, with no synthetic close event.
- Evidence: observed.

### overlay.manage-publishing: choose where a record is sold

- Intent: learn the channels and markets a record is on; do switch each on or off.
- Use when: publishing has many targets in groups. Not when: one on/off, see `settings.switch-row`.
- Ask: which targets, in which groups? [channels, then markets]; which are on by default? [none, owner decides].
- Admin: Product aside > Publishing > sliders icon (`/products/new`), seen 2026-11-16. The aside only summarises ("Online Store, Inbox", "All catalogs").
- Shape: large modal "Manage publishing": left rail of groups with counts (Sales Channels 4, Agentic 1, group label Catalogs with Regions 1); right: search "Search channels" and a bordered list, each row an icon, name and switch; a group header row with its own switch; a warning icon with an expander on a channel with a problem. Footer Cancel, Done.
- States: Done disabled until a change.
- Behaviour: Escape or Cancel closes without saving.
- Evidence: observed

### overlay.full-frame-edit-modal: edit a block of the record in a full-frame modal with a summary

- Intent: change a block with many fields (address) and see what will change; do save.
- Use when: the edit has more than about six fields or needs a summary of changes. Not when: one or two fields, see `overlay.modal-edit`; the task changes money or stock and owns its page, see `form.task-page`.
- Ask: which fields make the block? [all of the block]; what does the summary list? [the changes]; a "Current" select? [only for addresses].
- Admin: Order > Shipping address > Edit shipping address, seen 2026-11-16. Also: Customer contact and address edits are modals of the same family.
- Shape: modal covers the frame (about 1101x710, radius 16). Header: icon, title, round close X. Body is a two-column task layout: left a card of fields, right aside "Summary" with a grey box "No changes have been made" that lists changes. The card begins with "Current" and a "Select address" pill select.
- States: no save button until a change; the host save bar appears on change.
- Behaviour: close X and Escape leave; a changed form asks before discarding.
- Copy: "Edit shipping address", "Select address", "No changes have been made".
- Evidence: observed.

### overlay.product-picker-search: add products by searching with filters

- Intent: find products or variants and add them to a record.
- Use when: the record takes products from the full catalog. Not when: a small known set, see `overlay.picker-modal`; or a free item, see `overlay.custom-item-modal`; the picks are totalled on the page, see `form.line-item-editor`.
- Ask: which search fields and filters? [title, SKU, barcode]; can variants be picked one by one? [yes]; a limit? [none].
- Admin: Create order "+ Product" ("Select products"), Edit order "+ Product" ("Add products"), seen 2026-11-16.
- Shape: modal, wide. Search field with a "Search by" select (All, Product title, Product ID, Barcode, SKU, Variant ID, Variant title) and an "Add filter" button. Table Product / Available / Price. Product rows carry a checkbox; variant rows are indented about 32px under their product. Footer: "4/500 variants selected", Cancel, Add.
- Behaviour: ticking a product ticks all its variants; Add disabled until selection.
- Evidence: observed.

### overlay.custom-item-modal: add a one-off line that is not a product

- Intent: add a line with a name and price; do add it.
- Use when: the merchant needs an item outside the catalog. Not when: the item exists, see `overlay.product-picker-search`.
- Ask: which fields? [name, price, quantity]; flags such as taxable? [yes]; weight? [optional].
- Admin: Create order > "+ Custom item", Edit order > "+ Custom item", seen 2026-11-16.
- Shape: small modal "Add custom item": Item name, Price with "$" prefix, Quantity, two checkboxes, then "Item weight (optional)" with a unit select and help "Used to calculate shipping rates accurately". Footer Cancel and "Add item".
- Evidence: observed.

### overlay.confirm-deactivate-with-inherit: deactivate a record that owns stock

- Intent: learn what the record owns; do hand it to another and deactivate.
- Use when: removing a record would orphan data that can be reassigned. Not when: nothing depends on it, see `overlay.confirm-destructive`; the task is a refund or order change, see `form.task-page`.
- Ask: who inherits what is owned? [one record, required]; what must be handed over? [listed in the warning banner].
- Admin: Settings > Locations > one location > "..." More actions > "Deactivate location", seen 2026-11-16.
- Shape: modal titled with a question naming the record ("Deactivate My Custom Location?"). A warning banner states what must be inherited, with a bullet ("Inventory stocked at this location"). A required select "Select a location". Cancel and a "Deactivate location" button disabled until a location is picked.
- Behaviour: the action lives only in the title bar "..." menu, never as a button in the page body. Not confirmed during the crawl.
- Evidence: observed

### overlay.import-file: upload a file to create something

- Intent: do import a file into the app.
- Use when: the import is one file of a known type. Not when: it maps columns or needs options, use a page flow.
- Ask: which file types [.json and .flow]? Several files [no]?
- Admin: Apps > Flow > Import (`/apps/flow`), seen 2026-11-16.
- Shape: modal titled "Import workflow" with a close X. Dashed-border drop zone with a grey pill "Add files" and the line "Accepts .json and .flow". Footer: Cancel (white pill) and Import (black pill, disabled until a file is added).
- Copy: "Accepts .json and .flow".
- Evidence: observed.

### overlay.create-by-name-modal: create a record from one name with a warning

- Intent: start a new item by naming it; read a risk note first.
- Use when: the item needs only a name at creation and the rest is edited afterwards. Not when: several fields are needed, see `overlay.modal-edit`.
- Ask: Name length limit? [30, counter inside the input]. Is there a safer alternative to promote? [a blue banner linking to apps].
- Admin: Settings > Customer events > Add custom pixel, seen 2026-11-16.
- Shape: modal about 680 wide: title and close X; info banner; one labelled input with "0/30" counter inside its right edge; a legal paragraph with a link; footer Cancel and a primary "Add pixel" disabled while empty.
- Behaviour: primary stays disabled until the name is non-empty; Cancel and X close without saving.
- Copy: "Did you check available apps first? Apps are the most secure option, with automatic updates, for integrating with third-party services."
- Evidence: observed.

### overlay.policy-editor-modal: edit a long legal text, optionally auto-managed

- Intent: write or review a policy; let the platform keep it in sync.
- Use when: long legal or help copy with formatting, edited from a list. Not when: a short field, see `fields.text`; or a full page of a record, see `form.rich-text`.
- Ask: Offer automation? [yes, a switch card on top, on by default when a template exists]. Which formats? [paragraph style, bold, italic, underline, colour, alignment, link, image, table, HTML view].
- Admin: Settings > Policies > a row (`/settings/legal/<slug>`), seen 2026-11-16. The list stays behind the modal.
- Shape: large modal with title and X; top card "Use automated policy" with help "Keep policy content in sync with store settings and latest Shopify templates" and a switch (32x16); the editor with toolbar: Paragraph select, Bold, Italic, Underline, Color, Alignment, Link, Insert image, Insert table, "..." more, Show HTML; toolbar buttons 24x24 round; body grey and toolbar buttons grey while automation is on; disclaimer text with a "disclaimer" disclosure; footer Cancel and Save.
- States: automation on locks the editor; off unlocks it.
- Behaviour: close returns to the list with `?activator=<slug>`.
- Copy: "This privacy policy is not legal advice, and you are responsible for ensuring its accuracy and complying with applicable laws."
- Evidence: measured.
