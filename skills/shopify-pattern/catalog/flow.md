# Flow

The merchant wants to complete a task that crosses several steps or surfaces.

### flow.add-in-modal: add a record to a settings list in a modal

- Intent: add one entry to a short settings list; see it appear and know it saved.
- Use when: the entry has a few fields and the list stays on the page. Not when: the change is a draft with a save bar, see `flow.edit-with-save-bar`; an entry needs its own page, see `settings.record-page-with-status-rows`.
- Ask: which fields are required? [name and three sizes; weight optional]; is the first entry the default? [yes, ticked and disabled]; does the modal ask before discarding typed values? [no].
- Admin: Settings > Shipping and delivery > Packages, seen 2026-11-16.
- Shape: list row with name, details, "Store default" pill and "..." button; "Add package" text button under the rows; modal as in `overlay.modal-edit`.
- Steps: 1. Open the collapsible (`settings.collapsible-section`). 2. Click "Add package": modal opens, URL and history unchanged, focus on the dialog container. 3. Fill the fields; the primary stays `aria-disabled` and out of the tab order until every required field is valid; an invalid number sets `aria-invalid`. 4. Click the primary: the modal stays open about a second, then closes. 5. The row appears, the section counter ("1 box") updates, a toast confirms, focus lands on the page body. Surfaces: `settings.package-list`, `overlay.modal-edit`, `chrome.modal`, `chrome.toast-host`.
- States: primary disabled until valid, no message on click; Enter in a number field does not submit.
- Behaviour: Escape and Cancel close a dirty modal without a confirmation; a reopened modal is empty; focus after close goes to the body, not the trigger.
- Copy: title "Add package"; primary "Add package"; toast "Successfully added package".
- Evidence: observed

### flow.edit-with-save-bar: change a setting inline and save it from the bar

- Intent: change a value on a settings page; save it or throw the change away.
- Use when: the value is a select, checkbox or field placed on the page. Not when: the value is behind a summary row that opens a modal, see `settings.address-modal-row`; a switch that saves itself, see `settings.save-model`.
- Ask: does leaving the page with a draft ask or block? [block, no dialog]; is Discard confirmed? [no].
- Admin: Settings > General (Unit system), seen 2026-11-16.
- Shape: dark pill bar centred at the top: "Unsaved changes", Discard, Save (see `chrome.save-bar`).
- Steps: 1. Change the select: the bar appears at once, no URL change. 2. Discard: the value reverts, the bar disappears, no confirmation. 3. Or click another settings link while dirty: navigation is blocked, no dialog, the bar shakes sideways. 4. Or Save: the draft commits and the bar leaves (Save not pressed in the crawl). Surfaces: `chrome.save-bar`, `chrome.discard-confirmation`, `settings.save-model`.
- States: bar buttons are pills 28 high; the bar also appears above an open modal.
- Behaviour: the guard was seen on in-app navigation only; browser reload not tested.
- Copy: "Unsaved changes", "Discard", "Save".
- Evidence: measured

### flow.delete-from-row-menu: delete a list entry with a confirmation

- Intent: remove one entry from a settings list; be sure which one.
- Use when: the entry is not the default. Not when: the entry is the default or the last one: the admin offers only Edit; make another entry default first.
- Ask: may the last entry be deleted? [no]; is the default replaceable? [yes, "Set as default" on another row].
- Admin: Settings > Shipping and delivery > Packages, seen 2026-11-16.
- Steps: 1. Open "..." on the row (popover: Edit, Set as default, Delete in red). 2. Choose Delete: modal "Delete <name>?" with "Are you sure you want to delete the package <name>? This can't be undone.", Cancel and a red "Delete package"; focus on the close X. 3. Confirm: the modal closes, the row disappears, the counter drops, focus goes to the body. Surfaces: `overlay.row-menu`, `overlay.confirm-destructive`, `settings.package-list`.
- States: the default row menu has Edit only.
- Behaviour: "Set as default" acts at once with a "Changes saved" toast and re-orders the rows.
- Evidence: measured

### flow.create-from-unsaved-page: create a record on an unsaved page

- Intent: learn what the record needs; do create it and land on its detail page.
- Use when: the record has several fields and a type choice (discount). Not when: one name is enough, see `overlay.create-by-name-modal`.
- Ask: Type-first modal or one create page? [type-first modal for discounts]. Land on the new record's detail or on the list? [detail]. Next-step banner after the first save? [yes, with a share action].
- Admin: Discounts > Create discount (`/discounts`, `/discounts/new/<type>`, `/discounts/<id>`), seen 2026-11-16.
- Steps:
  1. Index primary button "Create discount" opens a modal "Select discount type" (`form.type-first-modal`): rows with icon, title, one-line help and a chevron; app-provided types sit under app-name group headers; close X and a footer Cancel. URL unchanged. Focus moves to the modal container.
  2. Click a row: pushes `/discounts/new/amount-off-order` (history +1). Tab title "Create discount", page h1 "Create discount", back arrow plus the parent label "Discounts" in the title bar, a section heading with the type name, a right summary card ("No discount code yet" / "Code", Type, Details bullets). No save bar and no Save button yet. Nothing is focused (body).
  3. First edit (typing the code): a dark pill appears top-centre of the title bar: "Unsaved discount" + Discard + Save. Save is enabled the moment the bar appears. The summary card mirrors the code live and shows a copy icon.
  4. Save with a required field empty: the page stays, no navigation. A critical banner appears above the first section: "There is 1 error with this discount:" then "Discount value can't be blank". The field gets a red border and the inline error "Discount value can't be blank". The save bar stays and Save stays enabled. Focus lands on the page container, not on the field. Editing the field removes the banner at once; the field error remains until the next save.
  5. Fix and Save: pushes `/discounts/<id>` (history +1, so Back returns to the create URL). A black toast "Discount created" shows top-centre in the title bar. A success banner: "<code> was created successfully. What's next?" with help text and a "Get shareable link" button. The save bar is gone. The create page's method toggle is gone.
  6. After the first save the page is the detail page: h1 is the code, a green "Active" badge, actions Duplicate, Promote (menu), More actions (menu); the summary card gains "Performance" ("0 used") and the Details list gains the value line ("1% off entire order"). Surfaces: `form.create-page`, `form.save-bar`, `form.validation-banner`, `feedback.toast-when`.
- Behaviour: the create URL is a pushed route, not replaced. The redirect after the toast can take a moment.
- Copy: "Unsaved discount", "Discount created", "There is 1 error with this discount:".
- Evidence: observed.

### flow.edit-with-unsaved-guard: edit a record, save or discard, and try to leave

- Intent: learn the page has unsaved edits; do save, discard or leave.
- Use when: any detail page that is itself the form. Not when: the edit happens in a modal, see `overlay.modal-edit`.
- Ask: Leave guard: block silently or open a modal? [block, with the save bar drawing attention]. Confirm Discard? [no].
- Admin: Discounts > a discount (`/discounts/<id>`), seen 2026-11-16.
- Steps:
  1. First edit: the save bar appears with "Unsaved changes" (create pages say "Unsaved discount"). The success banner from the first save disappears. The summary card updates live.
  2. Discard: no confirmation. Values revert, the bar hides, focus moves to the main region, no toast, no history change.
  3. Save: no navigation, no history change, toast "Changes saved", bar hides.
  4. Leave while dirty: the Back arrow, a sidebar link and the browser Back are all blocked. No modal opens. The URL stays (browser Back is undone, history length unchanged) and an animation runs on the save bar container, which draws attention to it. Leaving works once saved or discarded. Surfaces: `form.save-bar`, `chrome.discard-confirmation`, `navigation.back-link`, `detail.back`.
- Copy: "Unsaved changes", "Discard", "Save", "Changes saved".
- Evidence: observed.

### flow.change-status-with-confirm: activate or deactivate a record

- Intent: learn the record's state; do turn it on or off now.
- Use when: the state change is reversible and takes effect immediately. Not when: the state is a field of the form (product status select), see `flow.product-draft-lifecycle`.
- Ask: Confirm both directions? [yes]. Inline status change on the list row? [yes, via a chevron on the badge on hover].
- Admin: Discount page > More actions menu (Deactivate or Activate, View activity, Delete in red) and the index bulk bar, seen 2026-11-16.
- Steps:
  1. More actions > Deactivate: modal "Deactivate <name>?" body "This discount will expire now and all unsaved changes will be lost." Buttons Cancel and a dark primary (not red) "Deactivate".
  2. Confirm: no navigation, no history change. Toast "Discount deactivated". The badge changes from green "Active" to grey "Expired". The Promote button disappears. The menu item becomes "Activate". The summary line changes from "Active from <date>" to "Active today".
  3. More actions > Activate: modal "Activate <name>?" body "This discount will become active now and will have no end date. All unsaved changes will be lost." Confirm gives toast "Discount activated" and the badge returns to Active.
  4. Schedule is not an action: it is set by start and end date fields in the form and saved with the save bar (not exercised). Surfaces: `detail.more-actions`, `overlay.confirm-destructive`, `feedback.toast-when`.
- Evidence: observed.

### flow.duplicate-record: copy a record into a new unsaved one

- Intent: do reuse a record as a starting point.
- Use when: records are configuration worth cloning. Not when: copying is rare, leave it out.
- Ask: Copy name prefix? ["Copy of <name>"]. Save immediately or review first? [review first].
- Admin: Discount page > Duplicate button in the title bar (`/discounts/<id>/duplicate`), seen 2026-11-16.
- Steps:
  1. Click Duplicate: no modal. Pushes `/discounts/<id>/duplicate`. A create-style page opens with the code "Copy of <name>", the method toggle and a banner "Discount is not active yet". The save bar shows "Unsaved changes" with Save enabled from the start.
  2. Save: toast "Discount created". After a short delay the URL changes to the new id (history +1) and the detail page opens. The copy keeps the source's values. Surfaces: `detail.title-actions`, `form.create-page`, `form.save-bar`.
- Evidence: observed.

### flow.delete-record-with-confirm: delete a record from its page

- Intent: do remove a record for good.
- Use when: deleting from a detail page. Not when: deleting many rows, see `flow.bulk-action-on-index`.
- Ask: Confirm every delete? [yes]. Land where? [list].
- Admin: Discount page > More actions > Delete (red text, last item), seen 2026-11-16.
- Steps:
  1. Delete: modal, title "Delete <name>?", body "The discount will be deleted. This can't be undone.", Cancel plus a critical red "Delete discount" (background rgb(216, 32, 25), white text). Focus is on the dialog container.
  2. Confirm: pushes `/discounts` with no search, filter or sort (the list view is not restored). Toast "Discount deleted". Surfaces: `detail.more-actions`, `detail.destructive-in-more-actions`, `feedback.toast-when`.
- Copy: the button names the noun ("Delete discount").
- Evidence: observed.

### flow.bulk-action-on-index: act on selected rows and see the result

- Intent: do activate or deactivate several records.
- Use when: the action is the same for each row. Not when: each needs its own input.
- Ask: Which actions sit in the bar? [Activate, Deactivate, then "..." for the rest]. Confirm? [yes].
- Admin: Discounts index (`/discounts`), seen 2026-11-16.
- Steps:
  1. Tick a row checkbox: the header row turns into the bulk bar: header checkbox (indeterminate), "N selected" with a chevron menu, "Activate discounts", "Deactivate discounts", "..." and a "Show all selected" switch. Column headings fade behind. Export dims.
  2. Click an action: modal "Deactivate selected discounts?" body "These discounts will be deactivated now." Cancel plus "Deactivate".
  3. Confirm: toast "Deactivated 2 discounts". Selection clears and the bar disappears. The rows stay in place with the badge updated to "Expired", even when the list filter is Active (no refetch); the filter applies on the next load. URL unchanged, no history change. Surfaces: `index.bulk-bar`, `overlay.confirm-destructive`, `feedback.toast-when`.
- Evidence: observed.

### flow.product-draft-lifecycle: start a product, differences from other creates

- Intent: do add a product; learn how it differs from a discount.
- Use when: records the merchant builds before publishing. Not when: the record is active as soon as it exists, see `flow.create-from-unsaved-page`.
- Ask: Default status? [Active, so choose Draft on purpose].
- Admin: Products > Add product (`/products/new`), seen 2026-11-16. Save was not run: the Status control did not open in the session.
- Steps:
  1. The index button opens `/products/new` directly: no type modal. The page exists before any save: title "Add product", Title field with placeholder "Short sleeve t-shirt", description editor, media, category, price, inventory; right column Status (default Active), Publishing, Product organization.
  2. No save bar until the first edit. The first edit shows "Unsaved product" with Discard and Save, both enabled.
  3. Discard on an unsaved create page: no confirmation. It leaves to `/products` (the list). Surfaces: `form.create-page`, `form.save-bar`.
- Evidence: observed.

### flow.return-to-list: come back to the list with the view kept

- Intent: do go back to the list as it was.
- Use when: a record was opened from a filtered, sorted list. Not when: the record was deleted, the list opens clean.
- Admin: Discounts index and detail, seen 2026-11-16.
- Steps:
  1. Open the index with a query, a status filter and a sort: the admin rewrites the status filter into the query (`query=zz+pattern+status:"active"&sortKey=created_at&reverse=false`).
  2. Open a row (pushes the detail URL). Click the Back arrow in the title bar: the index returns with the same search text, filter token and sort (verified). The click can take a few seconds.
  3. After a save on the detail page the merchant stays on the detail page. After a delete the list opens unfiltered. Surfaces: `navigation.back-link`, `detail.back`, `index.url-state`.
- Evidence: observed.
