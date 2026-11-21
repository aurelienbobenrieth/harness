# Settings

The merchant configures how something behaves: reads the current rule at a glance, changes it, and trusts it is saved.

### settings.page-frame: lay out one settings section

- Intent: learn which section is open and what it holds; do change its groups.
- Use when: a section of configuration with several groups of cards. Not when: one task with a start and an end, see `form.*`; the section list itself, see `navigation.settings-sidebar`; more than about six groups, see `settings.long-page-rhythm`; one settings record with its own name, address and linked setups, see `settings.record-page-with-status-rows`; a single row that opens its own editor, see `settings.summary-row`.
- Ask: which groups, in what order? [one card per topic, most used first]; any rare or advanced group? [collapsed at the bottom, see `settings.collapsible-section`]; does it need a destructive reset? [no]; one save bar for the page? [yes].
- Admin: Settings > General (`/settings/general`), seen 2026-11-14. Also: Settings > Plan, Billing, Notifications use the same frame. Online Store settings (`/online_store/preferences`) are a separate page with a back circle button and a breadcrumb title, seen 2026-11-16. Flow, Checkout Blocks and Messaging show no settings page in their own nav; the title bar "..." menu is their only extra entry (2026-11-16).
- Shape: settings render inside the main white panel (no full-screen modal). Section list on the left, 239 wide. Content column max 784, centred, 32 side gutters at a 1169 viewport. Page title h1 26px/32px 500; title block 32 top and 12 bottom padding. Title box to first group heading box: 32. Groups 16 apart. Sibling cards in one group 12 apart.
- Behaviour: the column keeps 784 on wide screens and shrinks with gutters on narrow ones. The title bar carries the page name 13px/28px 500.
- Evidence: measured, https://shopify.dev/docs/api/app-home/latest/patterns/templates/settings

### settings.group-heading: name a group of cards

- Intent: learn what a group of cards controls; do nothing.
- Use when: every group of cards on a settings section. Not when: a card that needs its own title inside the body, see `settings.summary-row`.
- Ask: does the group need a description line? [no, unless it adds a fact]; an info icon? [no]; an action at its end? [none, see `settings.recipients-list`].
- Admin: Settings > General, Plan, Notifications, seen 2026-11-14. Also: General "Order ID format" has a heading plus a description; "Order processing" has an info icon after the heading; same on Checkout (seen 2026-11-16).
- Shape: the heading sits outside and above the card. h2 15px/500/22. Heading block 16 top padding, 12 bottom margin. h2 bottom to card top: 15 (37 from heading top on Notifications). Optional subdued one-line description under it, 13px, may carry an inline link. An action may sit at the heading's end (see `settings.recipients-list`). Every section has at least one heading; a lone card still gets one.
- Copy: short nouns: "Plan details", "Subscriptions", "Recipients". A description is dropped when it only repeats the heading.
- Evidence: measured.

### settings.summary-row: show a setting's value and open its editor

- Intent: learn the current value or rule in one line; do open a modal or sub-page to change it.
- Use when: the value is long, has several fields, or needs its own save step. Not when: one short value the merchant flips (see `settings.switch-row`) or one select (see `settings.select-card`); the editor is another tool, see `settings.entry-row-button`; the value is a pill with an advanced editor, see `settings.value-pill-menu-row`; the fields are a postal address, see `settings.address-modal-row`; the row opens an editor with its own URL, choose by field count, see `settings.edit-inline-or-modal`.
- Ask: what does the subdued line say? ["Off", or what the rule does]; modal or sub-page? [modal for a short edit, sub-page for many fields or a step-by-step setup]; icon at the start? [none unless the list mixes kinds]; what do Cancel and Save do? [Save disabled until a field changes].
- Admin: Settings > General, Notifications, seen 2026-11-14. Also: Customer accounts "Branding" row ends in a secondary "Customize" button instead of a chevron.
- Shape: rows straight in a card with no card padding, split by dividers. Row padding 12px 16px (first 16 16 12, last 12 16 16). Icon 16 (margin 2) at 18 inset; text at 48 inset. Title 13px/400 rgb(16,16,16). Subdued line 13px/400 rgb(74,74,74). Chevron 16, rgb(96,96,96), at the end. No status badge. Row heights 64-68.
- States: the whole row is the click target; pointer cursor. States: see `actions.clickable-row`.
- Behaviour: opens a modal (short edit) or navigates (a page, such as history). The state shows in the subdued line, not a badge ("Off" or what the rule does).
- Copy: "Expire leaked codes" / "Off". A pill action at the end ("View release notes") is a secondary button 24 tall, radius 9999, bg rgb(235,235,235), 12px/500.
- Evidence: measured.

### settings.select-card: set several preferences in one card

- Intent: learn the current choices; do change each with one select.
- Use when: each setting is a pick from a short list, grouped by topic. Not when: the options need long explanations side by side, see `fields.choice-list`; one yes/no, see `settings.switch-row`; five or more options where help would crowd, see `settings.select-rows-card`; the select also needs an editable wording, see `settings.select-with-edit-action`.
- Ask: which settings and what are the options of each? ; which option is the default? [the recommended one, labelled "(recommended)"]; what does the help line say per option? [a shortened explanation of the chosen option]; does an option need a follow-up field? [only that option reveals it]; saves with the page save bar? [yes].
- Admin: Settings > General "Store defaults" (selects with one `details` line each, grouped in one card), seen 2026-11-14. Also: Discounts > Create "Eligibility" is one select with a field revealed below it. General store defaults (seen 2026-11-16): Backup Region select with help "Determines settings for customers outside of your markets"; Unit system and Default weight unit side by side in two columns; Time zone full width with help "Sets the time for when orders and analytics are recorded". A sentence under the card links to account settings for the user-level time zone.
- Shape: one card, selects stacked 16 apart, each with a label and a single help line (6 under the control). Field metrics as in `fields.select`.
- Behaviour: the help line shows the chosen option's explanation. A follow-up field (picker, number) appears under the select only for the option that needs it.
- Copy: the option label keeps "(recommended)" in plain text, no bold. Help is a shortened version of the chosen option's explanation.
- Evidence: observed.

### settings.switch-row: turn one rule on or off

- Intent: learn whether a rule is on and what it does; do flip it.
- Use when: a single binary rule with a one-line effect. Not when: the rule has options to set (use `settings.summary-row` with the state in its line); a choice inside a form, see `fields.switch`; several independent rules saved with the page save bar, see `settings.checkbox-list-with-help`; the row leads to another tool, see `settings.entry-row-button`.
- Ask: default state? [off]; saves at once or with the save bar? [at once, as the admin's switch rows; checkboxes are for save-bar pages]; what does the subdued line say when off? ["Off"]; does it need options? [no, otherwise use `settings.summary-row`].
- Admin: Settings > Customer accounts "Sign in with Shop", Settings > Notifications, seen 2026-11-14. Also: Settings > Policies, where the "Use automated policy" switch locks the editor below it (seen 2026-11-16).
- Shape: list card, rows split by an inset 16 divider. Row padding 16 16 12 / 12 16 / 12 16 16, height 64-68. Grid: icon 20 | text 1fr | trailing 32, gap 12. Icon box 20, glyph 16, #101010. Title 13px/20 400 #101010. Subdued line 13px/20 400 #4a4a4a; an inline link inherits the subdued colour and is underlined. Switch label 32x24 (padding 4 0), input 32x16, radius 9999. On bg #101010, off bg #dddddd, transition background-color .1s cubic-bezier(.42,0,.58,1).
- Behaviour: only the switch toggles in the admin; the row is not a button. Notifications rows that also open a modal show switch and chevron together. A card can mix switch rows with button rows (Customer accounts: Store credit, Sign in with Shop and Multipass are switches; the others end in a button), seen 2026-11-16.
- Copy: the subdued line says what the rule does ("Sent when ...") or "Off".
- Evidence: measured.

### settings.threshold-fields: set two related numbers side by side

- Intent: learn two limits that work together; do edit each.
- Use when: two short numeric values belong to one rule. Not when: a single value, see `fields.number-suffix`; two unrelated picks from lists, see `settings.select-card`.
- Ask: which two values and in which unit? ; default of each? [the safest value]; minimum and maximum? [none shown, an error beside the field]; does one depend on the other? [no]; saves with the page save bar? [yes].
- Admin: Settings > General "Unit system / Default weight unit": two fields side by side in one card, seen 2026-11-14.
- Shape: two-column grid in one card, gap 8. Labels visible; unit as suffix (`%`) or prefix (currency symbol, leading in English, trailing in French).
- Copy: labels use the discount words the admin uses ("Percentage discounts", "Fixed amount discounts"); the group description is one plain line.
- Evidence: observed.

### settings.recipients-list: manage a list of people who get something

- Intent: learn who is on a list; do add or remove one.
- Use when: a flat list of entries added one at a time. Not when: entries have rich data and bulk actions, see `index.*`; the entries are staff accounts with roles, see `settings.user-list`; the entries are typed records with a page each, see `settings.manual-method-list`.
- Ask: who may be added and what does each receive? ; what does the empty state say? ["You haven't created any ... yet"]; saves at once or with Save? [at once]; is there a limit? [none]; can an entry be edited or only removed? [removed].
- Admin: Settings > Notifications > Staff notifications "Recipients" (`/settings/notifications/staff`), seen 2026-11-14.
- Shape: heading left (h2 15/500/22), secondary pill "+ Recipient" at the right: 28 tall, 12px/500, padding 4 12 4 6, aria-label "Add recipient". Heading block padding-top 16, margin-bottom 12, min-height 28. List card below, rows 16 padded. Card above to heading top 35, heading top to list card 37.
- States: empty row padding 16, one line. Modal "Add recipient": Email address field, select "Receive notifications for", one help line with a link, Cancel and primary "Add recipient" disabled while empty.
- Behaviour: add opens the modal; the admin saves the staff list at once. The modal opens empty each time and Enter runs the primary action when it is enabled.
- Copy: empty "You haven't created any order notifications yet"; invalid email "Email is not valid".
- Evidence: measured.

### settings.connected-account-row: show a connection and its actions

- Intent: learn whether an account or domain is connected and healthy; do reconnect, edit or disconnect.
- Use when: one external account or domain with a state and several actions. Not when: a list of installed apps, see `settings.app-list`; the login happens in the provider's own admin during a guided setup, see `onboarding.connect-account`; a payment provider with a setup lifecycle, see `settings.provider-card`.
- Ask: which states can it be in? [connected, needs reauth, pending]; what is the one main action? ["Connect" or "Reconnect"]; which actions go in the "..." menu? [edit, disconnect last in critical tone]; does disconnect confirm? [yes, a modal naming the account].
- Admin: Settings > Domains (`/settings/domains`), seen 2026-11-14. Also: Settings > Apps row menu.
- Shape: row with globe icon, domain, subdued "Primary", success badge "Connected", icon actions (view, edit). More actions go in a tertiary "..." button (menu-horizontal icon) opening a menu. A destructive item is last and in critical tone (red).
- States: warnings that block the row (needs reauth, pending disconnect) go into the row's subdued line, not a banner. Two separate readiness facts keep two badges.
- Behaviour: one visible button for the main action ("Connect", "Reconnect"); everything else in the menu; an item appears only when it applies (for example "Clear channel" only with a channel set).
- Copy: title plus one subdued line joined with " · ".
- Evidence: observed, https://shopify.dev/docs/api/app-home/latest/patterns/compositions/account-connection

### settings.app-list: list apps or tools in one card

- Intent: learn which apps or tools exist and their state; do open one or act on it.
- Use when: several items of the same kind, each with a logo, name and one line. Not when: one item with its own settings, see `settings.connected-account-row`; dozens of logos with no state, see `settings.logo-collection`; a planned item, see `settings.coming-soon-item`.
- Ask: which items and what is each one's one line? ; which actions per row? [open, details, uninstall last]; an activity column? [no]; a planned item in the list? [yes, see `settings.coming-soon-item`].
- Admin: Settings > Apps (`/settings/apps`), seen 2026-11-14.
- Shape: one card, one row per app (row heights 68 first and last, 64 middle). Thumbnail 24 (`s-thumbnail` small-200, radius clamp(6px, 25%, 12px)). Name link 13px/400. Subdued line ("Public app by ..."). Activity column. Tertiary "..." menu: Open app, View details, Get support, Uninstall (critical).
- Behaviour: a planned item sits in the same list with a row action, see `settings.coming-soon-item`.
- Copy: the repeated product name is dropped from descriptions.
- Evidence: measured.

### settings.logo-collection: show a long set of logos without filling the page

- Intent: learn which tools are covered; do open the full list if wanted.
- Use when: dozens of logos serve only as reassurance. Not when: each item needs its own state, see `settings.app-list`; a few items suffice, show them in a `settings.summary-row` line.
- Ask: which names lead the subdued line? [three, then "and N more"]; does the modal need a Learn link? [yes]; is the list static or does it track real coverage? [static].
- Admin: none for a logo wall. Nearest: Settings > General one-row card with a trailing button ("Development store ... View release notes"), a row that opens a modal, seen 2026-11-14.
- Shape: one summary row (icon, title, subdued line naming a few items and a count, "View all" secondary button at the end) in a one-row card. The button opens a modal with the grid of logos, a trailing "and N more" note and a Learn link.
- Behaviour: the grid never renders inline; Escape closes the modal.
- Copy: subdued line in the style "Honey, Rakuten, Klarna and 133+ more".
- Evidence: observed.

### settings.plan-and-usage: show the plan, its price and usage

- Intent: learn the plan, its price and how much is used; do change plan.
- Use when: a settings section about subscription and consumption. Not when: choosing or comparing plans, see `onboarding.plan-picker` (the former plan comparison entry was absorbed there); the plan is shown inside the app's own page with the same rows, see `onboarding.plan-summary`.
- Ask: which usage is measured and what is its unit? ; what happens at the limit? [a warning banner in the card, "N over your limit" in critical]; is there an unlimited case? ["No order limit on your plan"]; does it link to a plan change? [yes, to the plan picker].
- Admin: Settings > Plan (`/settings/plan`), Billing (`/settings/billing`, redirects to `/settings/organization-billing`), seen 2026-11-14. Also: Settings > Locations shows a usage line under its group heading, "Using 2 of 200 active locations available on your plan" (seen 2026-11-16).
- Shape: "Plan details" heading, card (radius 20, padding 16, `role=list`) with one 784x54 row: plan name as h2 15/22 500 plus a badge ("Development store"). "Subscriptions" heading with a subdued description and "View all subscriptions" at its end; 32 below the card above. App row 784x70: icon 24 (radius about 6), text at icon x + 36, name 13/20 400, price line 12px/18 400 subdued ("$1,699.00 yearly. Renews ..."). Billing: "Current billing cycle" card, amount "$0.00" + "USD" as h2 29px/36 500, link "View current charges", subdued "Running total · dates" 2 below, hairline, full-width row action "Add payment method" (48 high, 13/20 500, 20 icon). Usage is one value plus one subdued line, label left and value right, with a bar.
- States: a limit exceeded notice is a warning banner inside the card; a load failure a critical banner.
- Copy: usage line "90% used · 1,000 remaining"; over the limit "N over your limit" in critical; unlimited "No order limit on your plan".
- Evidence: measured.

### settings.fixed-view-tabs: switch between fixed views inside a card

- Intent: learn one of a small fixed set of views; do switch.
- Use when: the set never changes, as in billing history. Not when: views are user-made or many, see `index.*` view dropdown; the card is a people list with search and sort icons, the index view bar sits inside the settings page, see `settings.user-list`.
- Ask: which views, and which opens first? [the fixed set, the first tab]; does a view need a count? [no].
- Admin: Settings > Billing bills section, seen 2026-11-14. Also: Users and Roles use the index view bar (tabs All, Active, Pending, search and sort icons) inside a settings page (seen 2026-11-16).
- Shape: `ul[role=tablist]` inside the card, padding 4 8. Tabs `button[role=tab]` 28 high, padding 4 12, radius 9999, label 12px/18 500. Selected bg rgba(0,0,0,.13), text rgb(16,16,16). Others transparent, text rgb(74,74,74). Gap 0 to 4. Overflow goes to a "More views" menu (12/18 500).
- Evidence: measured.

### settings.footer-note: legal or help note under the cards

- Intent: learn where the legal terms or help live; do open them.
- Use when: a section ends with a pointer that is not a setting. Not when: the text is a setting's help, see `fields.help-text`; the pointer sits in the onboarding home, see `onboarding.contact-row`.
- Ask: which links end the page? [help, terms, privacy]; a note about the account or store? [only if it explains a limit].
- Admin: Settings > Plan footer, General footer, seen 2026-11-14. Also: General ends with a plain list of text links (Change log, Shopify Help Center, Hire a Shopify Partner, Keyboard shortcuts, Store activity log) and a note ("This store can't be transferred because it's a development store created for testing."), seen 2026-11-16.
- Shape: centred line under the last card, 12px/18 400, inline links underlined in link colour. A footer note such as "Missing a tool? Request an integration" replaces a dedicated card; the link opens a modal.
- Copy: "View terms of service and privacy policy".
- Evidence: measured, https://shopify.dev/docs/api/app-home/latest/patterns/compositions/footer-help

### settings.coming-soon-item: offer something not yet available

- Intent: learn a tool is planned; do ask for early access.
- Use when: a planned integration worth listing. Not when: it has no demand signal, leave it out; it is live, see `settings.app-list`.
- Ask: what does the request collect? [the merchant's email, one line of need]; what does the modal say? [what is planned, no dates]; is it hidden after a request? [no, the row says so].
- Admin: none dedicated. Nearest: Apps rows with a row action, Domains rows with a status badge.
- Shape: a normal row in the same list card as live items; one visible button ("Request early access") that opens a learn-more modal. Description without the repeated product name.
- Behaviour: the modal's Send stays disabled until filled; Enter sends.
- Evidence: observed.

### settings.edit-inline-or-modal: decide where a setting is edited

- Intent: learn the value; do change it in the lightest place.
- Use when: choosing the editor. One select, switch, short number or checkbox: inline in the card (`settings.select-card`, `settings.switch-row`, `settings.checkbox-list-with-help`). A value with several fields, long text, or its own list: summary row that opens a modal (`settings.summary-row`, `settings.address-modal-row`). A rare, advanced editor behind a pill: `settings.value-pill-menu-row`. A step-by-step setup or a record with its own URL: sub-page (`settings.record-page-with-status-rows`, `settings.entry-row-button`). Not when: only the save timing is open, see `settings.save-model`.
- Ask: how many fields does the setting have? [one: inline; several: modal]; does it need its own URL or a step-by-step setup? [no, otherwise a sub-page]; is it edited often? [yes: inline; rarely: behind a pill menu].
- Admin: Settings > General uses all three (seen 2026-11-16). Modal: store address and currency formatting, Save disabled until dirty. Inline with the page save bar: backup region, units, time zone, order ID prefix and suffix, order processing radios and checkbox. Sub-page: store contact (its own route under `/settings/general`), Metafields and Brand (link rows, no chevron icon change). Selects are native-looking with a custom popover. Settings > Checkout keeps checkboxes, radios and selects inline; Discounts uses a heading plus one summary line plus a tertiary edit button.
- Shape: inline = field in the card. Modal = summary row plus host modal with Cancel and a primary action. A nested field appears under the checkbox or choice that needs it (`fields.checkbox-dependent`).
- Evidence: observed.

### settings.save-model: where a setting is saved

- Intent: know when a change takes effect; do save or discard.
- Use when: a settings section with edited values. Inline fields: the contextual save bar (host-drawn, see `chrome.save-bar`) appears on the first change and no in-page Save button exists. Switches in a list and the staff recipients list take effect at once. Not when: the question is where the field lives, see `settings.edit-inline-or-modal`.
- Ask: which settings take effect at once? [switches and list adds only]; which wait for the save bar? [every inline field]; confirm when leaving unsaved? [no, blocked with the bar shaking (2026-11-16); earlier reading: yes, see `chrome.discard-confirmation`].
- Admin: Settings sections, seen 2026-11-14. Also (2026-11-16): Checkout, General inline fields, Taxes toggles and Customer accounts switches have no in-page Save button; General is a Submit-free page with the save bar.
- States: a modal's Save stays disabled until a field changes.
- Behaviour: Cancel and Save live in the bar. Modal edits commit on the modal's own primary button. Flow: see `flow.edit-with-save-bar`.
- Copy: in-page "Save" buttons at section ends are removed.
- Evidence: observed.

### settings.value-pill-menu-row: show a value as a pill and edit it from a "..." menu

- Intent: learn one store-wide value at a glance; do open a rarely needed editor.
- Use when: the value is a short label and its editor is advanced (a format, a template). Not when: the merchant edits it often or the row is a plain summary, see `settings.summary-row`; the value is one pick from a list, see `settings.select-card`; the choice of trailing element is open, see `settings.row-trailing-element`.
- Ask: what is the pill value? ; what does the editor change? ; does the editor need a reset to default? [no]; what does the help line say? [one line with a link to the related page].
- Admin: Settings > General "Currency display", seen 2026-11-16.
- Shape: own card, one row. Title, one help line with an inline link ("go to Markets"). At the end a grey pill with the value ("US Dollar (USD $)") and a "..." icon button (More actions).
- Behaviour: the menu has one item ("Change currency formatting") that opens a modal. The row itself is not a click target. Modal: description, four text fields in two columns (HTML and Email, with and without currency), Cancel and a Save that stays disabled until a field changes.
- Copy: "Change currency formatting", "Change how currencies are displayed on your store. {{amount}} and {{amount_no_decimals}} will be replaced with the price of your product."
- Evidence: observed

### settings.address-modal-row: edit a postal address from a summary row

- Intent: learn the address line; do edit the address fields.
- Use when: a record has a multi-field address inside a settings page. Not when: the address is the page's main content, see `form.create-page`; the record has more fields than an address or needs its own URL, use a sub-page row, see `settings.edit-inline-or-modal`; a plain value summary, see `settings.summary-row`.
- Ask: which address fields are required? [all but apartment]; one address or several? [one]; does the row show the country only or the full line? [the country line].
- Admin: Settings > General "Store address" row, seen 2026-11-16. Also: the contact row above it is a link to a sub-page route instead, because it holds more fields.
- Shape: summary row (icon, title, country line, chevron). The click opens a modal titled "Edit store address": Company name, Country/region (select), Address, Apartment suite etc, City, State (select), ZIP code. Cancel and Save, Save disabled until dirty.
- Behaviour: the modal commits on its own Save, no page save bar. The two rows of one card can differ: one opens a modal, one navigates. Choose by field count and need for its own URL.
- Evidence: observed

### settings.checkbox-list-with-help: several independent rules, each a checkbox with a line of help

- Intent: learn which rules are on; do tick or untick each.
- Use when: yes/no rules that are mutually independent and come with a short effect line, grouped in one card, saved with the page save bar. Not when: a rule needs its own state line or a modal, see `settings.summary-row`; a rule that takes effect at once, see `settings.switch-row`; options exclude each other, see `fields.choice-list`; a mode choice is followed by options, see `settings.choice-group-with-sub-checkboxes`.
- Ask: which rules and what does each one do? ; which are on by default? [off, unless recommended]; does a rule depend on another? [no, otherwise state it in the help line]; what does each help line say? [the effect, one line].
- Admin: Settings > Taxes bottom card ("Charge sales tax on shipping", "Charge VAT on digital goods", "Include sales tax in product price and shipping rate"), Settings > Checkout "Show a link for customers to track their order", "Require customers to sign in", "Show tipping options", Settings > General "Automatically archive the order", seen 2026-11-16.
- Shape: card, checkbox rows with a label and one subdued line under it. Rows are separated only by space, no dividers.
- Behaviour: edits go to the page save bar. Checkboxes appear in settings pages that save with a bar; switches appear where the change is immediate (see `settings.save-model`).
- Evidence: observed

### settings.choice-group-with-sub-checkboxes: pick one mode, then add independent options

- Intent: pick how something works, then tune it.
- Use when: one exclusive choice (radios) is followed by unrelated yes/no options in the same card. Not when: the options belong to one radio, see `fields.checkbox-dependent`; only independent rules, see `settings.checkbox-list-with-help`; only a pick from a long list, see `settings.select-card`.
- Ask: which modes exist and which is the default? [the recommended, labelled "(recommended)"]; which options are independent of the mode? ; does an option depend on a mode? [state it in its help line].
- Admin: Settings > Checkout "Customer contact method" (radios "Phone number or email" with an SMS note, "Email"; then two checkboxes), seen 2026-11-16.
- Shape: group heading + description (with an inline link) + info icon, then one card: radios first (a help line under the first), a gap, then checkbox rows with help lines.
- Behaviour: a checkbox can state the dependency in its help ("Customers can only use email when sign-in is required").
- Evidence: observed

### settings.select-rows-card: a label on the left, a compact select on the right

- Intent: learn and set many small options of one record type.
- Use when: five or more options, each from a short list, where help text would crowd. Not when: each option needs explaining, see `settings.select-card`; one option has a wording to edit, see `settings.select-with-edit-action`.
- Ask: which options and what are the choices of each? ; default of each? [the recommended]; is any option required? [no].
- Admin: Settings > Checkout "Customer information" (Full name: "Only require last name"; Company name: "Don't include"; Address line 2: "Optional"; Shipping address phone number: "Don't include"), seen 2026-11-16.
- Shape: one card, rows with the label at the start and a tonal pill select at the end showing the chosen value and a chevron. No field label above, no help.
- Behaviour: choose from a popover list; the page save bar appears.
- Evidence: observed

### settings.select-with-edit-action: a select plus a link to edit its copy

- Intent: choose where something shows and edit its wording.
- Use when: an option has a placement and a label the merchant may rewrite. Not when: there is nothing to edit, see `fields.select` or `settings.select-card`; many small options, see `settings.select-rows-card`.
- Ask: where can it show? ["Don't show" plus each place]; what wording may be edited? [the label only]; does it repeat per channel? [no].
- Admin: Settings > Checkout marketing options ("Display location" select with "Checkout and sign-in" or "Don't show", plus "Edit checkbox label" and "Edit regions" buttons), seen 2026-11-16.
- Shape: item heading, a labelled select, then tertiary text buttons under it. The same block repeats per channel (email, text, WhatsApp).
- Behaviour: the buttons open modals; the select commits to the save bar.
- Evidence: observed

### settings.long-page-rhythm: keep a long settings page light

- Intent: scan a page with many settings and open only what matters.
- Use when: more than about six groups. Not when: two or three cards, see `settings.page-frame`; the sections are optional and each has an add action, see `settings.collapsible-section`.
- Ask: which groups are common and which advanced? [common open, advanced collapsed at the bottom]; does a group need a link out to an editor? [only for long content].
- Admin: Settings > Checkout, seen 2026-11-16. Also: Settings > Shipping uses the same collapsible blocks.
- Shape: page title, then repeating group: heading (+ info icon + one description) then one card. The list runs: Configurations, Customer contact method, Customer information, Marketing options, Tipping, Abandoned checkouts, Language, then collapsed sections at the end ("Address collection" with a short description, "Add-to-cart limit" with a "Recommended" badge and description).
- Behaviour: rare and advanced options sit in collapsed sections at the bottom; common ones are open cards. Details that need more room link out ("Edit checkout content"). One save bar for the whole page.
- Evidence: observed

### settings.collapsible-section: hide a section's body until it is needed

- Intent: learn what a section is for from its title and one line; do open it.
- Use when: a settings page holds several optional sections, some with their own add action. Not when: the content is one short row, see `settings.summary-row`; the page is simply long with common groups, see `settings.long-page-rhythm`.
- Ask: which sections start open? [only those holding data]; which have an add action? ; what is each section's one subdued line?
- Admin: Settings > Shipping and delivery ("Shipping options" open; "Estimated delivery dates", "Shipping labels", "Packages", "Carrier accounts", "Order routing" collapsed), Settings > Checkout bottom sections, seen 2026-11-16.
- Shape: a full-width header button with title, one subdued line, and a chevron; an action button ("Add package", "Connect account") may sit in the opened body.
- States: the button exposes expanded true or false. A section with data (one package) opens with its rows.
- Behaviour: Flow: see `flow.add-in-modal`.
- Evidence: observed

### settings.config-profile-card: show a named configuration with its state and actions

- Intent: learn which configuration is live and when it was saved; do duplicate, edit or open more actions.
- Use when: one object (a profile) is edited in a full editor elsewhere. Not when: the setting is a single value, see `settings.summary-row`; the row only leads to another tool, see `settings.entry-row-button`.
- Ask: what states does it have? [Active badge, last saved time]; what do Duplicate, Edit and the "..." menu do? ; can there be several profiles? [no, one].
- Admin: Settings > Checkout "Configurations" ("Default Profile" + green Active badge + "Last saved: Jun 4 at 8:22 am EDT"; Duplicate, Edit, "..."), Settings > Customer accounts "Configurations" row with a "Customize" button, seen 2026-11-16.
- Shape: card with name and badge on the first line, subdued line under; at the end two secondary buttons and an icon-only "..." button.
- Behaviour: Edit leaves the settings page for an editor. The "..." holds secondary actions.
- Evidence: observed

### settings.entry-row-button: a feature row whose action is a button, not a chevron

- Intent: learn what a feature is and jump to where it is set up.
- Use when: the row leads to another tool (editor, domain page, theme) rather than a detail view of itself. Not when: the row opens its own editor, see `settings.summary-row`; the rule can just be toggled, see `settings.switch-row`; the row is a named configuration with a state, see `settings.config-profile-card`.
- Ask: where does each button lead? ; what does the button say? ["Manage" or "Customize"]; does the row also need a switch? [no].
- Admin: Settings > Customer accounts (rows "Branding: Branding is customized from your online store theme" with "Customize", "Order actions" with "Manage", "Authentication" with "Manage", "Store credit" with a switch), seen 2026-11-16.
- Shape: card of rows; title, subdued line, and at the end a secondary button ("Customize", "Manage") or a switch. A switch row and a button row can share a card.
- Behaviour: links go to a theme editor, another settings page or the domains page.
- Evidence: observed

### settings.account-url-row: show a public URL and copy it

- Intent: learn where customers reach a feature; do copy the link.
- Use when: a settings group exposes an address merchants paste elsewhere. Not when: a code or id, see `detail.copyable-value`; values to paste into another system, see `onboarding.records-to-copy`.
- Ask: can the merchant change the address? [only then a "Manage" button]; what does the help line say? [where to use the URL]; one URL or several? [one].
- Admin: Settings > Customer accounts "URL" rows (new accounts and legacy accounts), seen 2026-11-16.
- Shape: label "URL", help ("Use this URL anywhere you'd like customers to access customer accounts"), the URL text, a "Copy link" button, and a "Manage" button when the address can be changed (domains).
- Evidence: observed

### settings.provider-card: show a payment provider and what finishing setup unlocks

- Intent: learn which provider is live or pending and what it offers; do complete setup.
- Use when: a provider has a lifecycle (not set up, test mode, active). Not when: a simple method list, see `settings.manual-method-list`; one connected account with actions, see `settings.connected-account-row`.
- Ask: which lifecycle states exist? [not set up, test, active]; what does finishing setup unlock, in three lines? ; what blocks activation? [a disabled "Complete setup" with a banner].
- Admin: Settings > Payments, seen 2026-11-16 on a development store.
- Shape: top warning banner ("Development stores can only process test payments" with a learn-more link). Then group heading with a header action: "Test payment gateway" (one link row: "Payment methods", card image, chevron) and "Shopify Payments" with a disabled "Complete setup" button. The provider card: a subdued price line ("No transaction fees . Card rates starting at ..."), a grey benefit panel (bold claim + three checkmark lines) and a footer row "Available payment methods" with brand logos and "+3".
- States: "Complete setup" is disabled when the store cannot activate it.
- Evidence: observed

### settings.manual-method-list: add and list payment methods the merchant handles

- Intent: learn which manual methods exist; do add one or open one.
- Use when: a section is a user-managed list with a type chosen at creation. Not when: a fixed set of rows, see `settings.summary-row`; a flat list of one-field entries, see `settings.recipients-list`; a small list with dimension fields, see `settings.package-list`.
- Ask: which types can be created? ; what states does a row show? ["Active"]; what does the empty list say? [a dashed card with the add button]; what does a row open? [the record's page].
- Admin: Settings > Payments "Manual payment methods" and "Custom payment methods", seen 2026-11-16.
- Shape: group heading with a one-line description and a tonal "+ Method" button at the right. Card of rows: name, status text "Active", chevron. An empty list is a dashed card with a centred "+ Method" button. Add flow is a modal "Add manual payment method" with one required select "Method *" ("Select a method"); Cancel and Save, Save disabled until chosen.
- Behaviour: the row opens the method's page; the modal only picks the type.
- Evidence: observed

### settings.package-list: list shipping packages with an add modal

- Intent: learn the saved packages; do add or edit one, and set the default.
- Use when: a small saved list with dimension fields. Not when: a long list, see `index.table-rows`; entries of one field, see `settings.recipients-list`; typed records with a page each, see `settings.manual-method-list`.
- Ask: which fields does an entry have and in which units? [size in, weight lb]; which entry is the default? [the first, ticked and disabled]; can entries be edited or only removed? [edited from the "..." menu].
- Admin: Settings > Shipping and delivery > Packages (inside a collapsible section), seen 2026-11-16.
- Shape: list rows with the name and a "..." More actions button; "Add package" button. Modal: segmented choice "Custom package" or "Carrier package", package type choices (Box, Envelope, Soft package), Length / Width / Height number fields with a "Size unit" select (in), Weight with "Weight unit" select (lb), Package name, and a checkbox "Use as default package for all products" with the line "Used to calculate rates at checkout and pre-selected when buying labels". Cancel and "Add package" (disabled until valid).
- States: the default checkbox is ticked and disabled for the first package. Add modal (seen 2026-11-16): the primary is `aria-disabled` until name, length, width and height are valid; the default checkbox is ticked and disabled only for the first package, unticked for the second.
- Behaviour: Weight is optional and saves as "0 lb". Row menu: Edit only on the default row; Edit, Set as default and Delete otherwise. The Edit modal has no type segment and no default checkbox (seen 2026-11-16). Flow: see `flow.add-in-modal`, `flow.delete-from-row-menu`.
- Evidence: observed

### settings.market-shipping-table: list shipping options by market

- Intent: learn which options each market gets; do open a market.
- Use when: a settings table where each row is a record page link and the cell shows a short list ("USPS, DHL Express, Free International Shipping, +1 more"). Not when: sortable data, see `index.table-rows`; a fixed set of places with one status, see `settings.region-list`.
- Ask: what is a row? [a market or group]; what does the second column list? [up to three names then "+N more"]; where does a row lead? [the record's page].
- Admin: Settings > Shipping and delivery "Shipping options", seen 2026-11-16. A button switches back from Markets to shipping profiles.
- Shape: two columns, Market (link) and Options (up to three names then "+N more").
- Evidence: observed

### settings.region-list: list regions with their collecting state

- Intent: learn where tax is collected; do open a region.
- Use when: a fixed set of places with one status each. Not when: records the merchant creates, see `settings.manual-method-list`; each row lists several values, see `settings.market-shipping-table`.
- Ask: what status does a row show? [the collecting value, blank when none]; is search needed? [yes above about ten rows]; where does a row lead? [the region's page].
- Admin: Settings > Taxes and duties, seen 2026-11-16.
- Shape: card with a search field and a sort button, then a two column table: Region (link) and Collecting (an em dash, U+2014, when none). A region page has a title bar "More actions", a "Collect in a new state" button, and "Add override" buttons under product-tax sections.
- Behaviour: each row is a link to `/settings/taxes/<code>`. Search filters in place.
- Evidence: observed

### settings.service-row: link to a provider with its one-line promise

- Intent: learn which service is active and open it.
- Use when: a settings page leads with one managed service. Not when: several apps, see `settings.app-list`; the service has states and actions, see `settings.connected-account-row`.
- Ask: which service and what is its one-line promise? ; where does the link lead? [the service's own page].
- Admin: Settings > Taxes and duties "Shopify Tax: Automatically calculates sales tax at checkout" (link row), seen 2026-11-16.
- Evidence: observed

### settings.user-list: list people with status, security and role

- Intent: learn who has access and what they can do; do open one, add users.
- Use when: a people list with a status and a role. Not when: only notification recipients, see `settings.recipients-list`; machine access, see `settings.access-token-tables`; a few fixed views over the card, see `settings.fixed-view-tabs`.
- Ask: which statuses and roles exist? [Pending, Active]; which columns? [user, status, security, role]; can the merchant import or invite? [Import secondary, Add users primary]; sortable by? [user and status].
- Admin: Settings > Users, seen 2026-11-16. A section sub-nav in the settings sidebar lists Users, Roles, Security.
- Shape: title bar actions "Import" (secondary) and "Add users" (primary). Card with view tabs (All, Active, Pending), search and sort icon buttons, then a table: select checkbox, User (name over email, or email alone for pending), Status (badge: Pending yellow, Active green), Security (icon: shield with a slash in red when no 2FA, a neutral shield otherwise), Role (comma list, truncated with an ellipsis).
- Behaviour: the user cell is a link to the user page. Sorting is limited to User and Status.
- Evidence: observed

### settings.permission-tree: show or edit permissions grouped by area

- Intent: learn what a role can do; do grant or remove a permission.
- Use when: dozens of boolean permissions in a hierarchy. Not when: a handful, see `settings.checkbox-list-with-help`.
- Ask: which areas and which permissions depend on which? ; editable or read-only? [editable on the role page, read-only on a user]; is the role name and description required? [name yes, description no].
- Admin: Settings > Users > Roles > one role; one user page lists the role's permissions read-only, seen 2026-11-16.
- Shape: role header card (Name with a counter "45/255", Description "0/255", Role category select). Then a searchable list of area buttons (Home 1/1, Orders 18/21, Drafts 9/9, ..., Settings 14/14) each with a granted count that expands to rows. Rows: a checkbox with a label; dependent permissions are indented one level (Edit orders > Apply discounts; Fulfill and ship > Buy shipping labels); sub-headings ("Returns and refunds") group rows. In read mode each row shows a check (granted) or a ban icon (not granted) instead of a checkbox.
- States: a permission whose parent is off is greyed. A role in use by a locked account renders every control disabled.
- Behaviour: groups expand independently, many open at once. A scoped checkbox ("Restrict permissions to assigned company locations") explains its reach in a line under it.
- Evidence: observed

### settings.access-token-tables: list machine access with its token

- Intent: learn which service accounts and API clients can reach the store; do open or revoke one.
- Use when: non-human access with a name, an access summary and a token tail. Not when: people, see `settings.user-list`.
- Ask: which kinds of clients are listed? ; which columns? [name, access, token tail]; can the merchant revoke one? [yes, from its page].
- Admin: Settings > Users > Security, seen 2026-11-16.
- Shape: stacked index tables, each with its own view bar and columns (Name, Access, Access token; Partner API client, Permissions, Access token), token shown as "App automation token ending in 12a6ae". A separate action "Remove code requirement" sits in a collaborator section.
- Evidence: observed

### settings.location-list: list locations with status, and pick the default

- Intent: learn the locations and which is the default; do open or add one.
- Use when: a few physical places. Not when: many records with filters in the body of the app, see `index.page-frame`; one location's own page, see `settings.record-page-with-status-rows`.
- Ask: which columns and statuses? [name, status]; is there a default entry and who picks it? [a select card below the table]; is there a limit to show? ["Using N of M ... available on your plan"].
- Admin: Settings > Locations, seen 2026-11-16.
- Shape: group heading "All locations" with the usage line "Using 2 of 200 active locations available on your plan" and a "+ Location" button. A card with a compact view bar (All, search and filter, column toggle) and a table: Location, POS Subscription, Status. Under it a "Default location" card: row with pin icon, name, address and an up-down chevron. Below: "Point of Sale subscriptions" (an app row with "Open"), then app and custom fulfilment locations.
- Behaviour: the default card is a select, not a modal: it opens a listbox of locations (name over address, a check on the current one) and the pick applies.
- Evidence: observed

### settings.record-page-with-status-rows: a settings record page with rows that go deeper

- Intent: edit one place and reach its related setups.
- Use when: one settings record has a name, an address and several linked capabilities. Not when: the record is mainly data, see `detail.page-frame`; the page is a list of groups, see `settings.page-frame`; the record is a named profile edited elsewhere, see `settings.config-profile-card`.
- Ask: which linked setups get a row? ; what states do the pills show? [On or Off]; which badges sit in the title? [Active]; which actions go in the "..." menu? [deactivate, delete, last].
- Admin: Settings > Locations > one location, seen 2026-11-16.
- Shape: title with badges (Active green, "POS Pro" blue) and a title bar with a "..." More actions button. Card 1: Name field, Address summary row (opens its editor), a checkbox group ("Physical storefront", "Use inventory at this location to fulfill online orders"). Card 2 "Shipping": rows "Pickup in store" and "Local delivery" each with an On or Off pill and a chevron, linking to their own pages. A "Point of Sale" group with a switch and a "POS Pro" row.
- Behaviour: a pill with a chevron says state and leads on. A pill alone only says state.
- Evidence: observed

### settings.row-trailing-element: pick what ends a settings row

- Intent: decide whether a row ends in a badge, a pill, a menu, a chevron or a button.
- Use when: composing a list of settings rows. The neighbours: chevron, see `settings.summary-row`; pill plus "...", see `settings.value-pill-menu-row`; button, see `settings.entry-row-button`; switch, see `settings.switch-row`; state pill plus chevron, see `settings.record-page-with-status-rows`. Chevron: the whole row opens a deeper page or modal (Store address, a manual payment method). Pill or badge plus chevron: the row carries a state and opens detail (Pickup in store "On/Off", "Active"). Pill plus "...": the value is shown but its editor is advanced (Currency display). Secondary button: the action leaves the page for another tool (Customize, Manage, View release notes). Switch: the rule is immediate. Not when: no action exists, then show only text.
- Ask: does the row open detail, leave the page, edit advanced, or act at once? [open detail: chevron]; does it carry a state? [no, then a plain chevron].
- Admin: Settings > General, Payments, Customer accounts, Locations, seen 2026-11-16.
- Evidence: observed

### settings.destructive-placement: where destructive actions live in settings

- Intent: decide where to put deactivate or delete.
- Use when: any destructive settings action. Put it in the page's "..." menu in the title bar; confirm in a modal that names the record. Not when: the action is reversible, then use no confirmation and a toast. Row-level removal inside a card uses the row "..." menu (see `overlay.row-menu`). No page showed a red button in the body.
- Ask: what is destroyed and can it be undone? [reversible: no confirmation and a toast]; which record does the confirmation name? [the record's name].
- Admin: Settings > Locations, Packages ("..." on a package row), seen 2026-11-16. Also: Settings > Apps > View details puts "Uninstall app" in the page header as an outlined red-text button, not at the page foot and not in the "..." menu (seen 2026-11-16).
- States: see `actions.destructive`.
- Evidence: observed

### settings.switch-with-dependent-fields: turn a mode on and reveal its fields

- Intent: do switch a mode on or off; do edit the values it needs.
- Use when: one switch owns a few fields that mean nothing when it is off. Not when: the switch stands alone, see `settings.switch-row`.
- Ask: what shows when off [fields stay visible, label greyed]? Which limits [100 characters for the password, 5,000 for the message]?
- Admin: Online Store > Preferences > Store access (`/online_store/preferences`), seen 2026-11-16.
- Shape: section heading outside the card. Card row "Private mode" with info icon, description with a link, switch at the right. A cyan info banner explains the state. A grey inset panel holds "Password" and "Message to your visitors" with counters "6 of 100 characters used" and "0 of 5,000 characters used" under each field. A divider, then a second independent switch row.
- States: when off, the dependent labels turn grey.
- Copy: "Your online store is in development. To let visitors access your store, give them the password."
- Evidence: observed.

### settings.option-switch-card: toggle capabilities of a record with one switch per row

- Intent: do enable or disable independent capabilities of a record.
- Use when: each option is on or off and applies when saved with the record. Not when: one rule changes live, see `settings.switch-row`.
- Ask: Which options default on? [active-draft status, translations, storefronts API access].
- Admin: Add metaobject definition > "Metaobject options" (heading with info icon), seen 2026-11-16.
- Shape: a heading with an info icon over a card of rows divided by hairlines: label at left, switch at right. Rows: Active-draft status, Translations, Publish entries as web pages, Storefronts API access, Customer Account API access, Filter or group data in Analytics. A following "Field options" card has rows with a value ("Display name: Auto-generated") and "Fields used as filters" with an "Add fields" action.
- States: locked options show a dimmed switch.
- Behaviour: changes are held until the page Save.
- Evidence: observed.

### settings.inherited-overrides: show what a child inherits and let it be overridden

- Intent: learn which settings differ from the parent; do customize one or revert it.
- Use when: a record inherits defaults from a parent. Not when: values are always set per record, see `settings.summary-row`.
- Ask: Which settings can be overridden? [shipping, currency, catalogs, discounts, online store, checkout, domain, taxes, returns]. Does a parent label show? [yes, "Parent market"].
- Admin: Markets > one market (`/markets/<id>`), seen 2026-11-16.
- Shape: heading "Customized": a card of rows (icon, label, value chip-select, minus circle to revert) with an inline promo strip at its foot. Heading "Inherited": flat muted rows: icon, label, store icon, arrow, inherited value, plus circle to customize. Aside: a mini graph with the parent and a "Parent market" row; "More settings for <name>" list of link rows with chevron and a help line.
- Behaviour: plus moves the row to Customized; minus moves it back.
- Copy: "Store default", "Customized", "Inherited".
- Evidence: observed.

### settings.autonomy-radios: choose how much an automation may do alone

- Intent: do set the level of approval an automation needs.
- Use when: the choice is one of a few levels with consequences. Not when: it is a binary rule, see `settings.switch-row`.
- Ask: Which levels? [always ask, manage approved, full autonomy]. Default? [always ask].
- Admin: Growth > Autopilot > Permissions (`/growth/autopilot`), seen 2026-11-16.
- Shape: heading "Permissions" over radios, each with a line of help ("Autopilot prepares changes; you approve every edit and new campaign.").
- Evidence: observed.

### settings.template-list-grouped: pick one of many message templates

- Intent: learn which messages the store sends and when; open one to edit.
- Use when: a long fixed set of templates split by topic. Not when: the merchant adds their own items, see `settings.recipients-list`.
- Ask: How are templates grouped? [by lifecycle: Order processing, Local pick up, Gift cards, Payments, Shipping updated, Returns]. Is there a toggle per template? [no, rows only open the editor].
- Admin: Settings > Notifications > Customer notifications (`/settings/notifications/customer`), seen 2026-11-16.
- Shape: breadcrumb page, header actions "Customize email templates" and "Customer notification settings", then one group heading and one card of rows per group; each row is a name with a "Sent when ..." help line and opens the template page.
- Behaviour: whole row is the link; no pagination.
- Copy: "Sent when a customer places an order", "Sent when you mark an order as fulfilled".
- Evidence: observed.

### settings.notification-hub-rows: link to sub-areas with an icon, title and help

- Intent: reach the kinds of notifications; set the sender address.
- Use when: a settings page is a hub of 3 or fewer destinations. Not when: the rows show a value, see `settings.summary-row`.
- Ask: Which destinations? [Customer, Staff, Fulfillment request, Webhooks]. Is the sender address editable here? [yes, a plain input in its own card, no verification badge seen].
- Admin: Settings > Notifications (`/settings/notifications`), seen 2026-11-16.
- Shape: section "Sender email" with help and a card holding one full-width input; below, a card of rows (leading icon, title, help, trailing chevron) and a separate card for Webhooks.
- Copy: "The email your store uses to send and receive emails from your customers".
- Evidence: observed.

### settings.signing-secret-card: show a secret, copy it, rotate it

- Intent: learn the secret that proves messages come from the store; copy it; create a new one.
- Use when: a credential is shown to the merchant and can be rotated. Not when: a token is listed per app, see `settings.access-token-tables`.
- Ask: Hidden by default? [yes, "Show secret"]. Rotation friction? [a modal with a warning and a required checkbox].
- Admin: Settings > Notifications > Webhooks (`/settings/notifications/webhooks`), seen 2026-11-16.
- Shape: section "Signing secret" with help; card with "Current secret", buttons "Show secret" and "Copy secret", then a note on usage ("No webhook subscriptions on this page use this secret yet."); action "Create new secret".
- States: Create new secret opens a modal: warning that waiting notifications may still use the previous secret, a checkbox "I'm ready to use the new secret for future webhook subscriptions" that enables the confirm.
- Copy: "Connected services use this secret to check that notifications come from your store."
- Evidence: observed.

### settings.installed-apps-table: list installed apps with activity and a row menu

- Intent: learn which apps are installed and when they were last active; open, inspect, get support or uninstall.
- Use when: the merchant manages third-party apps. Not when: you list your own app's tools, see `settings.app-list`.
- Ask: Which actions per row? [Open app, View details, Get support only for public apps, Uninstall]. Search and sort? [both, as icon buttons].
- Admin: Settings > Apps (`/settings/apps`), seen 2026-11-16. Header actions "Develop apps" (outlined) and "Shopify App Store" (dark).
- Shape: one card; a pill "Installed" selected, search and sort icon buttons top right; grey header band App | Activity | actions; rows with a 32px icon (grey placeholder when none), name, "By X" or "Public app by X", optional price line "$1,699.00 USD every year", activity ("Yesterday", "1 hour ago"), and a "..." button labelled "More actions for <app>".
- States: the Uninstall item is red; it opens a small dialog "Uninstall <app>?" with Cancel and Uninstall (pill 75x28, 13px), see `overlay.confirm-destructive`.
- Behaviour: "..." opens a popover of about 107px; items are links except Uninstall.
- Evidence: measured.

### settings.app-access-detail: show what one app can read and do

- Intent: learn an app's security posture, permissions, activity, data access and install history; uninstall it.
- Use when: auditing one connected app. Not when: managing staff permissions, see `settings.permission-tree`.
- Ask: Which security checks are shown? [Enforced IP restrictions, Expiring access tokens]. Is activity per area shown? [yes, with request counts for 30 days].
- Admin: Settings > Apps > View details (`/settings/apps/app_installations/app/<handle>`), seen 2026-11-16.
- Shape: breadcrumb "Apps"; header actions View activity, Uninstall app (red text), Open app (dark); yellow banner for unlisted apps; sections "Security" (rows with red x or green check icon, title, help, right value), "Access and permissions" (table Area | View | Edit | Activity; check circles; dotted-underlined area names; activity "Yesterday", "None last 30 days"; expandable "4 requests, Last: Nov 15, 2026"), "Privacy" (data categories under Customers and Staff and contributors, plus a confirmation line), "App history" (installed by, time, date).
- Copy: "Allows access to store from trusted servers", "Shopify has confirmed this app meets data handling and privacy requirements".
- Evidence: observed.

### settings.legacy-feature-notice: gate a deprecated capability behind a switch

- Intent: learn that the old way is closed to new use and where the new way lives; opt in to the old one.
- Use when: a capability is retired for new merchants. Not when: a feature is merely unavailable, see `settings.coming-soon-item`.
- Ask: Is the old path still allowed? [only for existing items, behind "Allow ... development"].
- Admin: Settings > Apps > Develop apps (`/settings/apps/development`), seen 2026-11-16.
- Shape: breadcrumb Apps / App development; a primary card "Build apps in Dev Dashboard" with Learn more; a second card "Build legacy custom apps" with a deprecation paragraph, help, and a button "Allow legacy custom app development"; a legal line with a link.
- Evidence: observed.

### settings.domain-list: list domains with primary and connection state

- Intent: learn which domains reach the store and which is primary; add one.
- Use when: the merchant has one or more domains. Not when: you list regions, see `settings.region-list`.
- Ask: Which add paths? [Buy new domain, Connect existing, Transfer domain].
- Admin: Settings > Domains (`/settings/domains`), seen 2026-11-16.
- Shape: header actions for the three add paths; table Domain | Status | Actions; the domain name with a "Primary" badge and a "Connected" badge in Status.
- Evidence: observed.

### settings.language-list-with-app-promo: list store languages and promote a helper app

- Intent: learn which languages are published; add one.
- Use when: managing store languages. Not when: you set one language preference, see `settings.select-rows-card`.
- Ask: Which badges? [Default, Published]. Is a translation app promoted? [yes, a card with rating and Install].
- Admin: Settings > Languages (`/settings/languages`), seen 2026-11-16.
- Shape: header with a promo line ("Adding translations to your store improves cross-border conversion by an average of 13%") and primary "Add language"; table Language | Status | Domains | Actions with bulk select; app promo card below with name, rating 4.4, description and Install; footer note "To change your account language, manage account."
- Evidence: observed.

### settings.policy-list-with-status: show which policies exist and which are required

- Intent: learn which written policies and rules are set; open one.
- Use when: a fixed set of documents with a state each. Not when: items are user-created, see `index.*`.
- Ask: Which tags? [Required, Recommended]. Status wording? ["No policy set"].
- Admin: Settings > Policies (`/settings/legal`), seen 2026-11-16.
- Shape: card "Return and cancellation rules" with a "+ Rule" button and a row "Default rules" with badge "No rules set"; card "Written policies" with a "..." menu ("Get past policies") and rows: name, optional "Required" tag, grey status badge "No policy set", chevron.
- Evidence: observed.

### settings.recommendation-rows-with-automation: recommend setup steps and offer to automate them

- Intent: learn which compliance steps are missing; turn on automation or add each one.
- Use when: a compliance area with recommended and legally required steps. Not when: the steps are required to launch, see `onboarding.*`.
- Ask: Which tags? [Recommended, "Page required in <regions>"]. Is there a master automation switch? [yes, a "Turn on" button with a status line].
- Admin: Settings > Customer privacy (`/settings/privacy`), seen 2026-11-16.
- Shape: card "Privacy settings": status line "Your privacy settings are not automated" with button "Turn on" and a responsibility note with links; rows (Privacy policy, Cookie banner, Data sharing opt out page) with a "Recommended" tag and one line of help; a row for an opt-out service with "Enabled" and a "Disable" button; then "Marketing settings" rows and "Data storage hosting location".
- Copy: "It's your responsibility to ensure you comply with your privacy obligations."
- Evidence: observed.

### settings.resource-count-list: list resource types with a count to open each

- Intent: learn where custom data exists; open a resource's definitions.
- Use when: the same capability applies to many resource types. Not when: items are records, see `index.*`.
- Ask: Which resources and in what order? [Products, Variants, Collections, Customers, Orders, Draft orders, Companies, Company locations, Locations, Transfers, Pages, Blogs, Blog posts, Markets, Shop]. Show zeros? [yes].
- Admin: Settings > Metafields and metaobjects (`/settings/custom_data`), seen 2026-11-16.
- Shape: section "Metafield definitions" with help and "Learn more"; a card of rows: resource name left, count right, each a link. Below, section "Metaobject definitions" with "Add definition" and a table Definition name | Added by | Entries with search.
- Evidence: observed.
