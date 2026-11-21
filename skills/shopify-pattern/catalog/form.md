# Form

The merchant creates or edits a record, sees what it will do, and saves.

### form.create-page: create a record on a full page

- Intent: describe a new record; do save it.
- Use when: the record has several sections of fields and a live summary. Not when: the record has one or two fields, use `overlay.modal-edit`; the type decides the fields, start with `form.type-first-modal`; the page acts on an existing record (refund, edit), see `form.task-page`; the record is built from lines, see `form.line-item-editor`; a group defined by rules, see `form.collection-builder`; the merchant changes behaviour of the app, a settings page (`settings.*`).
- Ask: which fields, in which sections? [one card per topic]; which are required? [only what the record cannot exist without]; type chosen first? [no], see `form.type-first-modal`; live summary beside the form? [yes when there are more than two cards], see `form.summary-aside`; where does save lead? [the detail page of the new record].
- Admin: Discounts > Create discount (`/discounts/new/amount-off-product?discountType=order&method=code`), seen 2026-11-14.
- Shape: same two-column frame as a detail page. Main column x 196, width 760. Aside x 1004, width 280. Gap 48. Title bar: back circle (link to `/discounts`) and breadcrumb "Discounts / Create discount". Body h1 "Create discount" 26px/32px 500 at y 64. Sections: heading 15px/22px 500 outside the card, card 16 below, radius 20, padding 16. Card bottom to next heading 35. Inside a card the groups stack with gap 16.
- Behaviour: the page opens clean, with no save bar and no errors. The first edit shows the save bar, see `form.save-bar`. Flow: see `flow.create-from-unsaved-page`, `flow.duplicate-record`, `flow.product-draft-lifecycle`.
- Copy: title "Create <thing>", sentence case.
- Evidence: measured.

### form.type-first-modal: pick the type before the create page

- Intent: choose what kind of record to create; do continue to its create page.
- Use when: the create page differs by type and the title bar button is "Create <thing>". Not when: there is one type, go straight to `form.create-page`.
- Ask: which types, each with what one-line description? [name plus short description]; which is preselected? [none]; does the type change the fields? [yes, otherwise skip the modal].
- Admin: Discounts > "Create discount" opens "Select discount type", seen 2026-11-14.
- Shape: modal listing the types (for example amount off products, amount off order) with Cancel. Choosing one navigates to the create page with the type in the URL (`discountType=order`). Seen 2026-11-16: a row is a list item with an icon, a bold title, grey one-line help and a trailing chevron; app types are grouped under app-name header rows; the footer has Cancel only.
- Behaviour: Cancel and Escape close it. The page that follows has no type picker of its own. Opens from the index primary button; selecting a row pushes the create URL (seen 2026-11-16). Flow: see `flow.create-from-unsaved-page`.
- Evidence: observed.

### form.summary-aside: a live summary beside the form

- Intent: learn what the record will do as it is filled in; do copy its code.
- Use when: the form's result can be described in a few lines. Not when: a saved record's facts only, see `detail.aside-section`; the aside also holds the task's fields and one primary action, see `form.task-page`.
- Ask: which facts does the summary show? [the ones the merchant checks before saving]; a copyable value on top? [only when the record has a code]; which sections? [Type, Details, then access or tags].
- Admin: Discount create, aside, seen 2026-11-14.
- Shape: not a card. Top: the code (13px/20px 500) with a 28x28 copy button (rgb(96,96,96)), and "Code" under it 12px/18px subdued. Sections with 13/20 500 headings and hairlines: "Type" (value plus 20px icon row), "Details" (bulleted list, 13/20, bullet indent 24, row step 24), "Sales channel access" (checkbox plus 2-line label, label x = checkbox x + 24), "Tags". On a saved record the code is an h3 15px/22px 500.
- Behaviour: updates live as fields change. Dates read "Oct 13", with the year only when it is not this year.
- Evidence: measured.

### form.save-bar: save or discard unsaved edits

- Intent: keep or drop the edits; do save or discard.
- Use when: any create or edit form. Not when: the change saves on its own (a switch).
- Admin: appears on the first edit of Discount create, seen 2026-11-14. Host-owned: see `chrome.save-bar`.
- Shape: replaces the centre of the title bar and does not cover the page. Pill 277x36 at y 12, bg rgb(10,10,10), radius 9999, padding 4 4 4 12. Label "Unsaved discount". Discard 73x28 (bg rgba(255,255,255,.12)), Save 55x28 (bg rgb(252,252,252)), gap 4. The title bar actions and breadcrumb stay visible on both sides.
- Behaviour: stays until saved or discarded. Save is not disabled: on an invalid form it shows the banner and field errors, see `form.validation-banner`. Setting an end date also shows it. Observed 2026-11-16: Discard on an existing record asks no confirmation. A dirty page blocks the Back arrow, sidebar links and browser Back with no modal: the URL stays and the bar animates. Label by page: "Unsaved discount", "Unsaved product", "Unsaved changes". Flow: see `flow.create-from-unsaved-page`, `flow.edit-with-unsaved-guard`, `flow.duplicate-record`, `flow.product-draft-lifecycle`.
- Copy: "Unsaved <thing>".
- Evidence: measured, https://shopify.dev/docs/apps/launch/built-for-shopify/requirements

### form.validation-banner: list what blocks saving

- Intent: learn what is wrong; do fix it.
- Use when: Save is pressed with invalid or missing values. Not when: the problem is not the merchant's input, see `detail.banner-in-body`.
- Ask: which problems block saving? [missing required values and impossible combinations]; what does each message say? [<Field> can't be blank].
- Admin: Discount create after Save, seen 2026-11-14. Also: Add metaobject definition shows "To save this definition, 4 changes need to be made:" with a list, seen 2026-11-16; Save is not disabled there.
- Shape: a critical banner inserted at the top of the main column (y 108, above the first section). Width 760, radius 20, bg rgb(255,231,230), text rgb(54,2,0). Heading "There are 2 errors with this discount:" 13/20 500 with a red 20px alert icon. Then a bullet list of the messages, rgb(126,16,12), 13/20.
- Behaviour: pairs with a red ring and message on each invalid field, see `form.field-error`. The save bar stays. Seen 2026-11-16: text "There is 1 error with this discount:" followed by the message; the banner clears when the field is edited, and the field keeps its own inline error. Flow: see `flow.create-from-unsaved-page`.
- Copy: "Discount code can't be blank", "Target collections must be added". A message that offers a choice says "or uncheck this option".
- Evidence: measured.

### form.field-error: the error under one field

- Intent: learn which field is wrong and why; do fix it.
- Use when: a field is invalid after Save. Not when: the error is general, see `form.validation-banner`; you need the anatomy of any field's error, see `fields.error`; the error sits in a modal whose primary stays disabled, see `feedback.field-error`.
- Admin: Discount create errors, seen 2026-11-14.
- Shape: invalid control shadow `rgb(235,0,20) 0 0 0 1px, rgba(0,0,0,.04) 0 4px 5px -2px, rgba(0,0,0,.04) 0 3px 4px -1.5px, rgba(0,0,0,.04) 0 2px 3px -1px, rgba(224,61,80,.05) 0 0 8px 1px inset`. Message 7 below the field: 16px alert-circle icon, gap 2, text 12px/18px 400, rgb(206,31,24). The help text is replaced by the error while the field is invalid.
- Evidence: measured.

### form.error-timing: when errors first show

- Intent: be left alone until the form is submitted; do see errors when Save is pressed.
- Use when: any form with required values. Not when: a value can never be entered wrong (see `form.schedule`); a modal disables its primary until valid instead, see `feedback.field-error`.
- Admin: Discount create, seen 2026-11-14. Errors appear after Save, not on open and not on the first keystroke.
- Behaviour: the page opens with no errors. Save is always available. Pressing Save on an incomplete form shows the banner and the field errors at once. An invalid value that can be prevented is prevented instead (end before start is disabled in the calendar, no message).
- Copy: required values read "<Field> can't be blank".
- Evidence: measured, https://shopify.dev/docs/apps/design/user-experience/alerts

### form.field-layout: spacing between fields in a card

- Intent: read the form as groups; do fill each group.
- Use when: laying out fields inside a form card. Not when: you need one control's anatomy (the fields family).
- Admin: Discount create, seen 2026-11-14.
- Shape: label bottom to control top 4. Control bottom to help text 6. A field followed by another group 16. Two fields side by side, 360 wide each, gap 8 (x 212..572 and 580..940). A field with a trailing button: the field is 654 wide, the button a 70x32 grey pill (bg rgb(235,235,235)), gap 4. A field revealed by a checkbox sits at x + 24, 4 below the label line. Keep 4px of room around a focused field near a container edge (ring plus halo).
- Copy: help 12px/18px rgb(74,74,74), "Customers must enter this code at checkout."
- Evidence: measured.

### form.schedule: start and end date with time

- Intent: say when the record is active; do set a start and optionally an end.
- Use when: a record has an active period. Not when: you need a date range filter, see the period picker entries.
- Ask: is a start required? [defaults to now]; is an end optional? [yes, behind Set end date]; time of day or dates only? [date with time]; time zone shown? [yes when the store has one].
- Admin: Discount create > "Schedule" card, seen 2026-11-14. The old "Active dates" card with labelled fields and a "Set end date" checkbox is gone.
- Shape: one row in a card (padding 16, height 60, row 28): grid `minmax(0,1fr) auto minmax(0,1fr)`, gap 8. Start: a field-styled button 346x28 (301 when the end column is empty), radius 12, padding 0 12, value "Nov 14 at 11:02 AM" 13/20 left, zone "EST" right in rgb(96,96,96). Then a secondary button "Set end date" (111x28, plus icon, 12/16 500). An arrow icon before it grows from 0 to 32 wide on hover, 100ms. No labels, no help.
- States: after "Set end date": the button becomes an arrow plus an End button (placeholder "End date" until a day is picked, then "Nov 20 at 11:30 AM EST") and its popover opens at once. Hover: input hover bg.
- Behaviour: popover 272 wide, radius 16, left aligned, role dialog, labelled "Start date" or "End date". Box padding 12, gap 8. Calendar 248x226: header "November 2026" 13/20 600, weekdays 11/14, days 32x32 radius 10, today has an inset ring, selected bg rgb(16,16,16). Below it a date field (calendar icon) and a time combobox (clock icon, zone suffix) with 30-minute steps from "12:00 AM (start of day)" to "11:30 PM". On the start day the end list starts after the start time. Picking a day keeps the popover open; Escape closes it and returns focus. End defaults to the start day, next half hour. End popover only: footer (bg rgb(247,247,247), padding 6 8) with a tertiary "Clear" that returns to "Set end date"; it shows only once an end is set. End before start cannot be entered: earlier days are disabled and the end time clamps. Setting an end date shows the save bar.
- Copy: "Set end date", "End date", "Clear".
- Evidence: measured.

### form.reveal-by-checkbox: a field shown only when its box is ticked

- Intent: opt in to a limit or requirement; do give its value.
- Use when: a setting is off by default and needs one value when on ("Limit number of times this discount can be used"). Not when: the choice has several exclusive options, see `form.choice-with-help`; an optional end date, see `form.schedule`; only the anatomy of the revealed field matters, see `fields.checkbox-dependent`.
- Ask: which limits are optional? [off by default]; what value does each take? [a number or an amount]; what happens when the limit is reached? [none, owner decides].
- Admin: Discount create > the "Limit number of times..." option, seen 2026-11-14.
- Shape: a checkbox with its label, then the field 4 below the label line, indented to x + 24, 150x32 for a number. Unchecked: nothing below. A money field is 150x30 under its radio, prefix "$" 12 from the left.
- States: hidden when unticked.
- Behaviour: an error on the revealed field can offer "or uncheck this option".
- Copy: label like "Limit number of times this discount can be used in total".
- Evidence: measured.

### form.choice-with-help: radios with long help become a select

- Intent: pick one of a few modes, each with a sentence of explanation; do read the chosen one.
- Use when: the options each carry long help, so a radio list would become a wall of text. Not when: each option has one short line of help, see `form.choice-list-details`.
- Ask: which modes? [as few as possible]; which is the default? [the safest]; which needs a follow-up field? [only a mode that cannot work without it]; which is recommended? [marked (recommended) in its label].
- Admin: Settings > General "Store defaults" selects grouped in one card; Discounts > Eligibility select with a picker revealed below, seen 2026-11-14.
- Shape: a select (label 13/20 500, 4 above the control, control 30 to 32, radius 12). Help 12px/18px under it (6 below) describes only the chosen option. A follow-up field appears under it, 4 below, when the choice needs one.
- Behaviour: the help changes with the selection. A nuance that matters to every option goes into the help of the select, not each option.
- Copy: short option names; the help carries the facts. Recommendations in the label, "(recommended)".
- Evidence: observed.

### form.choice-list-details: options each with one line of help

- Intent: pick one option or several; do read what each means before choosing.
- Use when: two to four options, each with one short line of help. Not when: the help is long, see `form.choice-with-help`; two peers that switch the whole form, see `form.method-toggle`; you need one control's own anatomy (radio size, rows), see `fields.choice-list`.
- Ask: which options, each with what one-line help? [two to four]; one choice or several? [one]; which is the default? [the recommended one]; follow-up input under which option? [only where needed].
- Admin: Settings > Checkout choices; Discount create "Minimum purchase requirements" and usage limits, seen 2026-11-14.
- Shape: group label 13/20 500, 9 above the first row. Rows 28 high, step 28, radio 16x16 (14x14 unchecked) or checkbox 16x16, label 13/20 400. Details 12px/16px (radio) or 12px/18px (checkbox) rgb(74,74,74) under the label, starting 25 below its top. A choice list with several choices is checkboxes.
- States: keyboard focus draws a 2px blue ring around the box, 2px offset. Disabled label rgb(166,166,166).
- Behaviour: an error sits on the list ("Select at least one"). Follow-up inputs go under the picked choice.
- Copy: "10 hours (recommended)", `(recommended)` in the label; Polaris draws labels as plain text.
- Evidence: measured.

### form.method-toggle: choose how the record works first

- Intent: choose between two peers that change the rest of the form; do continue.
- Use when: two to three modes at the top of a card ("Discount code | Automatic discount"). Not when: the options are values of one setting, see `form.choice-list-details`.
- Ask: which two or three modes? [peers that change the rest of the form]; which is the default? [the most common]; what changes below each? [only the fields that mode needs].
- Admin: Discount create > Method, seen 2026-11-14.
- Shape: segmented control, two 28-high buttons, 12px/16px 500, padding 6 12, radius `9999 0 0 9999` and `0 9999 9999 0`. Selected bg rgb(208,208,208) with an inset shadow; unselected bg rgb(235,235,235). A label "Method" sits above.
- Evidence: measured.

### form.code-generator: type a code or generate one

- Intent: give the code customers use; do type it or get a random one.
- Use when: the record has a code or key the merchant may want generated. Not when: the system always makes it; the value is composed around a generated core, see `fields.affix-preview`.
- Ask: typed, generated or both? [both]; what does a generated code look like? [none, owner decides]; must it be unique? [yes].
- Admin: Discount create > Discount code, seen 2026-11-14.
- Shape: a text field 728x30. The label row is 400 weight (not 500) and carries a right-aligned link "Generate random code" (13/20, rgb(22,80,208), padding 0 2). Help 6 below: "Customers must enter this code at checkout."
- Behaviour: the link fills the field and the value shows in the summary aside at once.
- Evidence: measured.

### form.resource-picker: pick products or collections

- Intent: choose which products or collections the record targets; do review the picks.
- Use when: the target is a set of store resources. Not when: the choices are a few fixed values, use `fields.select`; the picker is the whole task in a modal, see `overlay.picker-modal`; the picks carry quantities, see `form.line-item-editor`.
- Ask: products, collections or both? [one select chooses]; may nothing be picked? [no, error "must be added"]; any limit on the count? [none].
- Admin: Discount create > Applies to, seen 2026-11-14.
- Shape: a select "Applies to" (360 wide) and "Purchase type" (360), side by side with gap 8. Below, the search field "Search collections" 654 wide and a grey "Browse" button 70x32 (bg rgb(235,235,235)), gap 4. Typing in the field or pressing Browse opens the resource picker. Picked rows show a thumbnail and an x icon button.
- States: error under the field when nothing is picked ("Target collections must be added").
- Behaviour: the picker is App Bridge's; the app only receives the picks.
- Evidence: measured; picked rows observed.

### form.eligibility-card: who or what the record applies to

- Intent: narrow the audience or requirements; do choose them.
- Use when: a card holds the conditions (customers, purchase minimum, usage limit). Not when: it is one value, see `form.reveal-by-checkbox`.
- Ask: which conditions exist? [one card per concern]; one choice or several per concern? [radio for one, checkbox for combinable]; what is the default? [no restriction]; which reveal a value? [minimums and limits].
- Admin: Discount create > "Minimum purchase requirements" and the usage limit options, seen 2026-11-14.
- Shape: one card per concern with the section heading outside. Inside, `form.choice-list-details`, with a field revealed under the picked option (money field 150x30 indented under its radio, with help 12px/18px). Multiple facts use checkboxes with short details; the group has one error ("Select at least one").
- Copy: details one line each, for example "guest: new or returning unknown".
- Evidence: observed.

### form.tags: add and remove tags

- Intent: label the record; do add, pick or remove tags.
- Use when: free labels or a set of existing codes can be attached. Not when: the values are a closed list of one choice; the record is also classified by type, vendor and collections, see `form.organization-card`.
- Ask: free text or existing tags only? [existing plus typed creation]; a limit on tags? [none]; where do they show? [the aside].
- Admin: Order aside "Manage tags", Discount aside "Tags", seen 2026-11-14. Also: the Product aside (`/products/new`) uses a popover of existing tags plus typed creation, not a modal.
- Shape: a combobox 280 wide and 30 to 36 high, radius 12, input shadow. Tag chips 12px/18px 500 below.
- States: Measured 2026-11-16: chip 20 high, radius 8, bg rgba(0,0,0,.05), hover .08; the remove button is hidden (opacity 0) until revealed. States: see `actions.chip`.
- Behaviour: suggestions in a list; a pick that is already a tag removes it. Keyboard navigates the list.
- Evidence: measured.

### form.preview: show the result next to the field

- Intent: see how the text or setting will appear; do adjust it.
- Use when: the output lands somewhere the merchant cannot see (a banner, a message, a channel). Not when: the page's facts are enough, see `form.summary-aside`.
- Ask: where does the output appear? [named in the frame title]; which fields change it? [every field that feeds the text].
- Admin: none; the nearest is the checkout editor preview.
- Shape: a framed window with a title bar naming the place, then the content. Same frame wherever it shows.
- Evidence: observed.
- Note: composed from a bordered container, kept because the merchant cannot see the output otherwise.

### form.chip-reveal-fields: add optional fields to a card from chips

- Intent: learn which optional fields exist; do add only the ones this record needs.
- Use when: a card has one primary field and several rarely used ones of the same topic (price, inventory). Not when: the extra field depends on a choice that changes meaning, see `form.reveal-by-checkbox` and `fields.checkbox-dependent`.
- Ask: which optional fields get a chip? [the rarely used ones of the card's topic]; which chips show a state? [yes/no ones]; any shown by default? [only the primary field].
- Admin: Products > Add product > Price and Inventory cards (`/products/new`), seen 2026-11-16.
- Shape: primary field on top; a footer row under a divider with pill chips and a chevron at the right. A chip shows its state when it has one ("Charge tax Yes", "Sell when out of stock Off"). Pressing a chip adds its field to the card and the chip looks pressed.
- States: chip pressed (darker fill) means the field is shown. Measured 2026-11-16: pills 28 high, radius 8, padding 4 8, 13px/400. States: see `actions.chip`.
- Behaviour: chevron collapses the footer. Cost per item adds Cost plus read-only Profit and Margin that show an em dash until values exist.
- Copy: Compare-at, Unit price, Charge tax, Cost per item, SKU, Barcodes.
- Evidence: observed

### form.inventory-by-location: edit quantity per location in the create form

- Intent: learn where stock sits; do set the starting quantity at each location.
- Use when: the record has stock at several locations. Not when: only one number exists, see `fields.number-suffix`.
- Ask: tracked by default? [yes]; which locations are listed? [all active ones]; starting quantity? [0].
- Admin: Products > Add product > Inventory (`/products/new`), seen 2026-11-16. Also: an existing product with variants uses the variant table with an "Available" column and a footer total, see `detail.variant-table`.
- Shape: card with a header switch "Inventory tracked"; inner bordered table: header "Quantity" with a pencil icon, a dotted-underline term "Quantity" at the right; one row per location with the name and a number field with steppers.
- Behaviour: switch off hides the table. Footer chips: SKU, Barcodes, "Sell when out of stock".
- Copy: Inventory tracked, Quantity, Shop location.
- Evidence: observed

### form.organization-card: classify a record in the aside

- Intent: do set type, vendor, collections and tags.
- Use when: the record is grouped by shared labels. Not when: a single tag list, see `form.tags`.
- Ask: which classifications? [type, vendor, collections, tags]; which are picked and which typed? [type and vendor picked, tags typed]; may a new collection be created here? [yes].
- Admin: Product aside > Product organization (`/products/new`), seen 2026-11-16.
- Shape: heading with an info icon; Type and Vendor as selects ("None"); Collections and Tags as bordered fields holding an "Add collections" or "Add tags" chip that opens a popover list. Chosen values show as chips and a plus icon sits at the heading. The Collections popover starts with the action "Add new collection". The Tags popover lists existing tags and creates one from typed text. No "manage" modal was seen.
- Evidence: observed

### form.media-dropzone: add images and files to a record

- Intent: do add media.
- Use when: a record has a gallery. Not when: a single logo, see `fields.which-control`.
- Ask: which file types? [images, videos, 3D models]; a maximum count? [none]; what does the first item mean? [the main one].
- Admin: Product Media card (`/products/new`), seen 2026-11-16. Also: the blog post Image card is a dashed dropzone with "Add image" and "or drop an image to upload"; the Files index accepts drops on the whole page ("Drop your files here"), seen 2026-11-16.
- Shape: empty state is a dashed dropzone with an "Upload new" button, a "Select existing" link and "Accepts images, videos, or 3D models". With media: the first image as a large tile and a dashed square tile with a plus.
- Evidence: observed

### form.rich-text: write a long description with formatting

- Intent: do write formatted text.
- Use when: the text needs headings, lists or links. Not when: plain text, see `fields.textarea`.
- Ask: which formatting tools? [the full toolbar]; required? [no]; which placeholder? [none].
- Admin: Product and Collection description (`/products/new`, `/collections/new`), seen 2026-11-16. Also: the blog post editor (`/content/articles/new`) has the toolbar, left to right: Generate text, style select "Paragraph", Bold, Italic, Underline, Color, Alignment, Link, Insert image, Insert video, Insert table, bulleted and numbered lists, outdent, indent, clear formatting, and "Show HTML" at the far right. The policy editor (Settings > Policies) adds a Color control, Insert table, a "..." overflow and Show HTML, and greys out while the "Use automated policy" switch is on (seen 2026-11-16).
- Shape: bordered box with a toolbar (Paragraph select, bold, italic, underline, color, align, link, image, video, table, lists, indent, clear, code view). A narrow box or short toolbar collapses tools into "...". Label "Description"; collection placeholder "Add a collection description".
- Evidence: observed

### form.line-item-editor: search products and total an order

- Intent: do pick products, set quantities and read totals.
- Use when: a record is made of products with quantities (purchase order, transfer). Not when: just choosing resources, see `form.resource-picker`; each line needs a bounded quantity inside a task page, see `form.line-item-stepper`. The product search itself is `overlay.product-picker-search`.
- Ask: which kinds of lines? [catalog variants]; which header pickers? [only those the record needs]; which totals show? [items, taxes, total]; terms, currency, tags? [only if the record uses them].
- Admin: `/purchase_orders/new`, `/transfers/new`, seen 2026-11-16. Quantity steppers and added rows were not opened.
- Shape: pickers "Select supplier" and "Select destination" (transfer: "Select origin" with an "In transit" pill); "Search products to add"; summary card "Order details" with "0 variants (0 items)", Taxes (Included), Total; Terms and Currency selects; tags "Find or create tags" 0/40. Transfer adds date, reference name, note, tags and "Link purchase order".
- Evidence: observed

### form.collection-builder: build a group by conditions or by hand

- Intent: do define which products belong to a collection.
- Use when: grouping products. Not when: a plain label, see `form.tags`.
- Ask: by conditions, by hand or both? [both, chosen first]; which condition fields? [none, owner decides]; image and description? [optional]; which channels? [all].
- Admin: `/collections/new`, seen 2026-11-16. Condition rows were not opened.
- Shape: header with an image tile "Add image", an inline large name field, chips "4 channels" and "Default collection"; rich description; card "Collection items 0" with skeleton tiles. Aside: type chip "Products" with a "..." menu, a card with "Add condition" and "Add products" side by side, then a card with a plus.
- Evidence: observed

### form.gift-card-create: issue a stored value

- Intent: do set value, expiry and customer.
- Use when: issuing money to a customer. Not when: a discount, see `form.code-generator`.
- Ask: which fields? [customer, value, expiry, note]; which expiry choices? ["Doesn't expire" first]; code typed or generated? [generated]; sent to the customer? [none, owner decides].
- Admin: `/gift_cards/new`, seen 2026-11-16. The generated code field was not seen.
- Shape: "Search or create customer"; note "No notes"; "Initial value" with $ prefix; "Expiry date" select "Doesn't expire", help "Gift card expiration laws can vary by country". The save bar "Unsaved changes", Discard, Save shows at once.
- Evidence: observed

### form.task-page: act on a record in a full page with summary aside and one primary action

- Intent: do a consequential task (refund, edit order, return); preview its effect; confirm once.
- Use when: the task changes money or stock and needs a live summary. Not when: a small confirm, see `overlay.confirm-destructive`; a block of one record edited in place, see `overlay.full-frame-edit-modal`; a new record, see `form.create-page`.
- Ask: which task, and what does the summary show? [the effect, in numbers]; which fields in the aside? [only those the task needs]; label of the primary action? [verb plus the amount]; where does confirm lead? [back to the record].
- Admin: Order > Refund (`/orders/ID/refund`), Edit order (`/orders/ID/edit`), seen 2026-11-16.
- Shape: title bar with back arrow and crumb "Orders / #1044". Title is the task ("Refund", "Edit order"). Main: stage header, line card, further titled cards ("Refund shipping", "Reason for refund"). Aside: "Summary" text that starts at "No items selected" or "No changes have been made", then task fields (Refund method, Refund amount), then one full-width primary button ("Refund $0.00", "Update order") disabled until a change exists. The button label carries the amount.
- States: primary disabled at rest. Taxes note strip at the foot of the payment card on Edit.
- Behaviour: back arrow returns to the order; unsaved changes prompt through the host.
- Copy: "Only you and other staff can see this reason", "$779.95 available for refund".
- Evidence: observed.

### form.line-item-stepper: set a quantity per line with its maximum

- Intent: choose how many units of a line to act on (refund, return, edit).
- Use when: each line has a bounded quantity. Not when: free quantity without a maximum, use a plain number field, see `fields.number-suffix`; lines are added by search, see `form.line-item-editor`.
- Ask: what is each line's maximum? [the quantity still available]; may a line be removed? [only on edit pages]; what updates on change? [the summary and the primary button].
- Admin: Refund page ("0 / 1"), Edit order page (quantity input "1" and a remove X), seen 2026-11-16.
- Shape: row of thumbnail, title, unit price, quantity input, line total. On Refund the input shows "0" and a "/ 1" suffix for the maximum and the total reads "$0.00" until set. On Edit the input holds the current quantity and a remove icon button follows the total. The unit price is a blue dotted-underline link that opens a discount popover.
- Behaviour: changing a quantity updates the Summary aside and enables the primary button.
- Evidence: observed.

### form.query-editor: write a query in a code editor with a result table

- Intent: define a rule in code and see the matching records; do run, save, use.
- Use when: the rule is too rich for filters. Not when: simple conditions, see `index.filter-tokens`.
- Ask: which records does it query? [none, owner decides]; templates offered? [yes, in a side panel]; what does Use do with the result? [none, owner decides].
- Admin: Customers > Segments > one segment, seen 2026-11-16.
- Shape: title bar crumbs "Segments / name" with Duplicate, "Use segment" (caret menu), "More actions" (caret). Top card: "1 customer | 1.56% of your customer base", collapse chevron, quoted description, code editor with line numbers (FROM, SHOW, WHERE, GROUP BY, ORDER BY), hint "Ctrl + Enter to run this query". Toolbar: shortcuts, help, undo, redo, Run, Templates (opens a side panel), toggle editor. Under the editor an AI input "Refine your segment" with a send arrow. Results card "Customers" with a column-picker icon and the table.
- Behaviour: Ctrl+Enter runs; the editor collapses with the chevron.
- Evidence: observed.

### form.draggable-field-list: define a list of typed fields that can be reordered

- Intent: do declare the fields of a new structure, set each label and type, and order them.
- Use when: the merchant builds a schema (fields of a content type). Not when: the list is of simple values, see `form.tags`.
- Ask: Which field types are offered? [all, grouped]. Required flag per field? [yes, asterisk in the label input]. Single or list per field? ["One" select].
- Admin: Settings > Metafields and metaobjects > Add metaobject definition (`/settings/custom_data/metaobjects/create`), seen 2026-11-16. Also: Content > Metaobjects index has the "Add definition" button.
- Shape: section heading "Fields" over one card. Each row: 6-dot drag handle, "Field label" input with required asterisk, "One" select (one or list), type picker button (type icon, name, up-down chevron), expand chevron for per-field options. Foot of the card: "Add field" with a plus icon. Page card above: Name input, "Type: <key>" line, "Add description" link.
- States: first edit shows the page save bar "Unsaved changes | Discard | Save". Save with errors shows a banner "To save this definition, 4 changes need to be made:" and a message under each invalid field.
- Behaviour: space lifts a row, arrows move it, space drops, escape cancels. The key is generated from the name; its help reads "Use letters, numbers, underscores, and dashes".
- Copy: "Examples: Cart upsell, Fabric colors, Product bundle"; "Field name is required"; "Name is too short (minimum is 3 characters)".
- Evidence: observed.

### form.tree-list-editor: edit an ordered, nestable list of items inline

- Intent: do add, order, nest and remove items such as menu entries.
- Use when: items form a hierarchy or an order and each has a label and a target. Not when: items are only ordered with no nesting, see `form.draggable-field-list`.
- Ask: Maximum depth? [nesting by arrow keys]. Which target types? [products, collections, pages, blogs, URLs].
- Admin: Content > Menus > one menu (`/content/menus/<id>`), seen 2026-11-16.
- Shape: Name card with "Handle: main-menu" under the input; heading "Menu items"; one card of bordered rows, each with a 6-dot handle and the label; the last row "Add menu item" with a blue plus circle. Measured: row 784 wide, 44 tall with 12 bottom padding.
- States: adding replaces the click with an inline row: Label input ("e.g., About us"), Link input ("Search or paste link"), a check button, a trash button. The page save bar appears.
- Behaviour: space or return lifts a row, up/down arrows move it, left/right arrows nest it, space drops, escape cancels. The header offers Duplicate and More actions.
- Evidence: measured (row and input).

### form.content-editor-page: write a post with a main column and a flat aside

- Intent: do write long content, set when it shows, attach an image, organise it.
- Use when: the record is long-form content with a publish state. Not when: the record is a product, see `form.create-page`.
- Ask: Draft by default? [Hidden]. Which organisation fields? [author, blog, tags, theme template].
- Admin: Content > Blog posts > Add blog post (`/content/articles/new`), seen 2026-11-16.
- Shape: main column: card Title (with a sparkle "Generate" icon in the input) and Content (rich text); section "Excerpt" (card with a placeholder sentence); section "Search engine listing" (card). Aside is one flat column separated by hairlines, no cards: Visibility, Image, Organization, Theme templates.
- Behaviour: pencil icons at the right of the Excerpt and Search engine listing headings open the editors in place.
- Evidence: observed.

### form.visibility-with-date: choose visible or hidden and optionally a date

- Intent: do control whether a record shows now or at a chosen time.
- Use when: publishing is a state of the record. Not when: a start and end are both needed, see `form.schedule`.
- Ask: Default state? [Hidden]. Allow a date? [yes, behind an icon].
- Admin: Blog post aside "Visibility", seen 2026-11-16.
- Shape: heading "Visibility" with a calendar-clock icon button at the right (tooltip "Set visibility date"); radios Visible and Hidden. The icon reveals "Date (YYYY-MM-DD)" and "Time" inputs (defaults today and "10:00 AM").
- Behaviour: the date is hidden until asked for, so the common case stays two radios.
- Evidence: observed.

### form.seo-listing-editor: write the search engine title, description and URL

- Intent: learn how a page appears in search; do set title, description and handle.
- Use when: a public page needs search metadata. Not when: no public page exists.
- Ask: Limits shown? [70 characters title, 160 description].
- Admin: Blog post > "Search engine listing" (also on products and pages), seen 2026-11-16.
- Shape: heading with a pencil icon; closed card shows "Add a title and description to see how this blog post might appear in a search engine listing". Edit reveals Page title ("0 of 70 characters used"), Meta description ("0 of 160 characters used"), URL handle with prefix "blogs/news/" and the full URL line.
- Behaviour: the closed card becomes a search result preview once filled.
- Evidence: observed.

### form.excerpt-card: add an optional summary under the main content

- Intent: do add a short summary shown on lists.
- Use when: the summary is optional and short. Not when: it is required, use a field in the main card.
- Admin: Blog post > "Excerpt", seen 2026-11-16.
- Shape: heading "Excerpt" with a pencil icon; a card with a placeholder sentence "Add a summary of the post to appear on your home page or blog."; edit opens a text editor in place.
- Evidence: observed.

### form.key-from-name: show the key that a name generates

- Intent: name a definition and see its immutable key as I type.
- Use when: a record needs a machine key derived from a human name. Not when: the code is chosen freely, see `form.code-generator`.
- Ask: Can the key be edited? [not at creation; the key is shown as "Type: cart_upsell" under the name, and as "Key: ..." in each field's options].
- Admin: Settings > Custom data > Add definition (`/settings/custom_data/metaobjects/create`), seen 2026-11-16.
- Shape: "Name" input with an example placeholder ("Examples: Cart upsell, Fabric colors, Product bundle"); beneath it a live help line "Type: <snake_case name>"; "Add description" link.
- Behaviour: the key updates on each keystroke; spaces become underscores, lowercase.
- Evidence: observed.

### form.repeatable-row-with-options: define a list of fields, each with expandable rules

- Intent: add several fields, reorder them, set required and open per-field validation.
- Use when: a record is built from a user-defined list of parts. Not when: a fixed form.
- Ask: Which rules per type? [text: character limit, min and max count, regular expression]. Can fields be reordered? [yes, drag with keyboard lift].
- Admin: Settings > Custom data > Add definition, seen 2026-11-16.
- Shape: card "Fields"; each row: drag handle, "Field label" input, "Make field required" checkbox, a "One" select, the type select, a chevron "Expand field options". Expanded: "Validation", Description, Character limit, Minimum character count, Maximum character count, Regular expression, "Delete field", "Key: <key>". "Add field" below. A second card "Metaobject options" holds checkbox rows (Active-draft status, Translations, Publish entries as web pages, Storefronts API access, Customer Account API access, Filter or group data in Analytics); a third "Field options" has Display name (Auto-generated) and "Fields used as filters" with "Add fields".
- Behaviour: drag by handle; screen reader hint "Press space bar to lift an item"; dirty form shows the save bar with Discard and Save.
- Evidence: observed.
