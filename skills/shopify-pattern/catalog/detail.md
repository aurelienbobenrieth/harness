# Detail

The merchant reads one record, learns its state and facts, and acts on it.

### detail.page-frame: read one record on a two-column page

- Intent: learn what the record is and what happened to it; do the next action on it.
- Use when: a single existing record (order, abandoned checkout, discount) has a page of its own and the merchant reads it. Not when: the page is a list, see `index.page-frame`; the merchant edits the record's fields, see `detail.editable`; the system owns the record and nothing is editable, see `detail.readonly`; the record is a person or account with headline totals, add `detail.stat-strip`; the page is a form to create a record, see `form.create-page`.
- Ask: what is the record's name and status in the title? [name, one status badge]; main sections? [facts first, then the events or related rows]; what goes in the aside? [who, where and how the record relates to others]; which actions in the title bar? [one or two secondary, the rest in More actions]; does it have a timeline? [yes, if events exist], see `detail.timeline`; previous and next record? [yes, when opened from a list], see `navigation.prev-next`.
- Admin: Orders > an order (`/orders/<id>`), Abandoned checkouts > one checkout, Discounts > one discount (`/discounts/<id>`), seen 2026-11-14.
- Shape: title bar (host), then a body in two columns. Main column x 196, width 760. Aside x 1004, width 280. Gap 48. Body starts y 64 (nav collapsed to its 60px rail; add 160 with the nav open). Main column holds banners, then sections each with a heading above a card. Aside holds plain sections split by hairlines.
- Behaviour: the aside holds facts about the record, never its primary content.
- Evidence: measured, https://shopify.dev/docs/api/app-home/latest/patterns/templates/details

### detail.title-block: name the record, show its status, say when

- Intent: learn which record this is, its state and when it started.
- Use when: the top of a detail page body. Not when: you mean the title bar row (back, breadcrumb, actions); the host draws it, see `detail.back` and `detail.title-actions`.
- Ask: which status badges? [one, from the record's state]; is there a meta line? [date and source; leave it out when the record has none]; a banner under it? [only for a special record], see `detail.banner-in-body`.
- Admin: Order, Abandoned checkout and Discount detail, seen 2026-11-14. The big title lives in the page body, not in the title bar.
- Shape: h1 26px/32px, weight 500, rgb(16,16,16). Badges inline after it, gap 8 (Paid neutral, Unfulfilled attention, Expired on discounts has no tone). One meta line under the title: 13px/20px 400, grey (about rgb(74,74,74)). Title bottom to meta 2, meta bottom to first banner 13, block padding-bottom 12.
- States: the record name also appears in the title bar breadcrumb, but only once the big title scrolls away.
- Copy: the meta line writes the long date, "July 22, 2026 at 9:38 am from Online Store". Tables write the short form, "Nov 12 at 11:50 AM". A year shows only when it is not this year. The Discount detail has no meta line; do not invent one.
- Evidence: measured.
- Note: the body title stays although the embedded title bar already names the record: the admin shows both.

### detail.main-section: a titled card in the main column

- Intent: read one group of rows about the record; act inside it when it has an action.
- Use when: the main column needs a section (line items, totals, events, a table of related rows). Not when: the content is a short fact about the record, see `detail.aside-section`; the card is one stage of a workflow with a state and a next step, see `detail.status-card-header`.
- Ask: what is the section called? [the noun the merchant uses]; what does it hold? [rows, a table or events]; does it have an action? [none].
- Admin: Order > "Unfulfilled" section, Order > payment card, seen 2026-11-14.
- Shape: heading outside and above the card, 15px/22px weight 500, sometimes with a 28x28 coloured icon tile (radius 8; "Unfulfilled" tile bg rgb(255,228,92), icon rgb(87,65,0)). Heading to card top 15. Card: bg white, radius 20, padding 16, shadow `rgba(0,0,0,.24) 0 0 2px 0, rgba(0,0,0,.02) 0 2px 12px 0, rgba(0,0,0,.02) 0 4px 16px 0, rgba(0,0,0,.02) 0 4px 48px 0`. Card bottom to next heading 35. Inside, rows split by hairlines. A nested footer panel has bg rgb(247,247,247) and radius 0 0 12 12.
- Copy: the heading is the only title; the card has no title band. A subdued description goes under the heading, outside the card.
- Evidence: measured, `sheets/detail.timeline.json`.

### detail.aside-section: facts about the record without cards

- Intent: learn who, where and how the record relates to others; open or copy each.
- Use when: the right column of a detail page. Not when: the page is a form with a live summary, see `form.summary-aside`; the content needs a card, see `detail.main-section`; the question is which control edits a block, see `detail.aside-edit-affordance`.
- Ask: which facts go in the aside? [who, where, tags, source]; which are editable? [none]; which can be copied? [ids, codes, emails], see `detail.copyable-value`.
- Admin: Order aside (customer, address, tags, conversion), Abandoned checkout aside, Discount aside, seen 2026-11-14. Since 2026 the aside has no cards.
- Shape: aside top padding 6. Each section has a heading 13px/20px 500 in a 28px row, with an optional 28x28 icon button at the right ("Add note" plus, "..." edit, pencil "Manage tags"). Heading to content 32, content to hairline 16, hairline to next heading text about 20 to 21. Hairline about rgb(235,235,235). Content is 13px/20px: blue links (name, email, "View map"), plain lines for an address. A conversion summary uses rows of a 20px icon plus text, row step 28.
- States: copy icon buttons (20 to 28) appear on hover at the right of a value, see `detail.copyable-value`.
- Evidence: measured.

### detail.facts-list: labelled facts about a record

- Intent: learn a few named facts (token, started, total, codes); do nothing, or copy one.
- Use when: a handful of facts with labels, in an aside section or a card. Not when: the facts are figures to compare over time (an analytics page); the list describes what a configured rule does, see `form.summary-aside`; the facts are headline numbers with definitions, see `detail.summary-values`.
- Ask: which facts? [the three or four the merchant looks up most]; what reads for a missing value? ["None"]; which can be copied? [ids and codes].
- Admin: Discount aside "Type", "Details"; Order aside "Customer", seen 2026-11-14. The admin has no 4-column facts card on detail pages.
- Shape: a section heading (13/20 500), then 13/20 lines. A list of details is bulleted: bullet indent 24, row step 24. A value with an icon is a 20px icon row. A missing value reads as a short word ("None", "Not captured"), never blank.
- Behaviour: a count and its list can share one section: the codes, then "3 failed attempts" only when the count is above zero.
- Evidence: observed.

### detail.summary-values: headline values with their definitions

- Intent: learn one or a few figures that belong to the record, and what each means.
- Use when: the record has a few metrics that fit the aside. Not when: the figures are the page, so an analytics page with its own metrics, see `data.*`; the numbers are a row of totals under the title of a person or account, see `detail.stat-strip`; the facts are labelled text, not figures, see `detail.facts-list`.
- Ask: which figures? [one to three]; what does each one mean? [one-sentence definition]; over which period? [the record's lifetime].
- Admin: Discount aside > "Performance" section (13/20 500 heading, value, definition), seen 2026-11-14.
- Shape: an aside section whose content is the value, then a subdued definition. A hover or focus definition on the label is allowed. No card.
- Evidence: observed.

### detail.copyable-value: copy an id, code or address

- Intent: grab a value (code, token, email, address) to paste elsewhere; do copy it.
- Use when: the value is something the merchant pastes. Not when: it is long prose.
- Ask: which values can be copied? [ids, codes, emails, addresses].
- Admin: Discount aside top block, Order aside customer and address, seen 2026-11-14.
- Shape: the value, then a 28x28 icon button "Copy to clipboard", colour rgb(96,96,96). In the Discount aside the code is an h3 15px/22px 500 with the button beside it. In other asides the button is 20 to 28 and shows on hover.
- States: after a click the icon turns to a check. Hover and keyboard focus show a tooltip.
- Behaviour: the click copies and the icon changes in place; no toast.
- Evidence: measured.
- Note: a stateless page with no copy message left the value selectable and skipped the button; that is a gap, not a pattern.

### detail.timeline: read what happened on the record

- Intent: learn the order of events; do add a comment or open an event.
- Use when: the record has a history of events. Not when: the history is rows to sort and page, so an index table, see `index.table-rows`; the merchant only keeps one private note, see `detail.aside-edit-affordance`.
- Ask: which events appear? [the ones that change the record's state]; can staff comment? [no], see `detail.timeline-comment-composer`; what does an event open? [nothing]; how are dates grouped? [by day].
- Admin: Order > Timeline (`/orders/<id>`), measured 2026-11-16. Also: Discount and Customer > Timeline; customer entries include "View email" pills.
- Shape: heading "Timeline" 15px/22px 500 outside any card. Under it the composer card when staff can comment (`detail.timeline-comment-composer`). Then, with no card: a 2px track rgb(221,221,221) at x 35 to 37 from the section's left edge, starting at the composer's bottom edge with no gap and running behind everything below. Date group heading h3 12px/18px 400 rgb(74,74,74) at x 68, block padding 16 above and below (24 above from the second group). Event: row 36 high, marker 16x16 at x 28 (radius 4, rgb(221,221,221)) holding an 8x8 dot rgb(16,16,16) radius 3; text 13/20 400 at x 68; time 12px/16px 400 rgb(74,74,74) right-aligned to the section's right edge, never past it. A staff comment is a card, not an event row, see `detail.timeline-comment`.
- States: an expandable event is a button whose text is followed by a 20px caret-down; a sent email adds a "View email" pill 12/16 500 under the text.
- Behaviour: an event with nothing to open is a plain row, not a button. Newest first.
- Copy: full sentences with a period, the actor first ("You added a note to this order."); "Today", "Yesterday", then "November 11".
- Evidence: measured.

### detail.payment-rows: the money of a record as rows

- Intent: learn how an amount was made up; do nothing.
- Use when: the record carries money (order, checkout) as lines and totals. Not when: the figures are metrics, see `detail.summary-values`; the record is a draft or being edited and the merchant adds discounts or shipping, see `detail.payment-link-rows`.
- Ask: which lines make up the total? [items, discounts, shipping, tax]; which currency? [the shop's]; is a paid or due row shown? [yes].
- Admin: Order > payment card, seen 2026-11-14. Also: the paid state is a final row "Paid" after a hairline; an abandoned checkout uses "To be paid by customer"; seen 2026-11-16.
- Shape: a `detail.main-section` card. Line item: thumbnail about 40x40, rounded, light border; title h3 13/20 500; "$749.95 x 1" with the quantity in a grey chip; total right-aligned. Totals: label column, middle detail column (about rgb(74,74,74)), right-aligned amounts. "Total" row weight 600. A hairline, then "Paid". Row pitch 28; label column 120px plus 8.
- Copy: discounts show their codes in the detail column and the amount as a negative.
- Evidence: measured.

### detail.banner-in-body: say why the record is special

- Intent: learn why the record behaves differently (test order, reminder sent, edits blocked); do the banner's action.
- Use when: a fact about the whole record changes what the merchant can do. Not when: a field is invalid, see `form.validation-banner`; the message is about the app, not this record, see `feedback.*`.
- Ask: which special states get a banner? [only those that change what the merchant can do]; what action does each carry? [none].
- Admin: Order (test order, warning), Abandoned checkout (info with an action), seen 2026-11-14. Also: a warning banner can sit inside a card (Customer > Last order placed: "This is a test order. Payment not processed."), seen 2026-11-16; an abandoned checkout uses a success banner with a read-only URL box.
- Shape: top of the main column under the title block, width 760. Warning: height 80 for two lines, radius 20, bg rgb(255,245,197), text rgb(49,37,0). Info with an action: height 138. Heading 13/20 500 with a 20px icon; body 13/20.
- Evidence: measured.

### detail.title-actions: act on the record from the title bar

- Intent: do the usual action on the record (refund, edit, view order); reach the rest from a menu.
- Use when: the record has actions. Not when: the page is a form; its save is the host save bar, see `chrome.save-bar`; the actions are many or risky, see `detail.more-actions` and `detail.destructive-in-more-actions`; the actions face the shopper, see `detail.title-bar-view-as`.
- Ask: which one or two actions does the merchant use most? [the next step on the record]; which go to More actions? [the rest]; any jump to another admin page? [one secondary, "View order"].
- Admin: Order title bar (Refund 64x28, Edit 45x28, More actions 109x28), Discount title bar, seen 2026-11-14. Also: an order shows Refund and Edit pills before "More actions"; an abandoned checkout shows only "Print"; a customer shows only "More actions"; a segment shows Duplicate and "Use segment"; seen 2026-11-16.
- Shape: right of the title bar, gap 8: secondary buttons (28 high, padding 6 12), then "More actions" with a chevron (padding 4 6 4 12), then prev and next. A detail page has no primary button. A jump to another admin page is a secondary.
- States: Measured 2026-11-16: Duplicate, Promote and More actions are 28 high header buttons. States: see `actions.hierarchy`, `actions.button-sizes`.
- Behaviour: Flow: see `flow.duplicate-record`.
- Copy: "View order", not "Open order in Shopify Admin".
- Evidence: measured.
- Note: Delete is a secondary or a More actions item that opens a confirm modal, never a red button under the form.

### detail.more-actions: the rarely used actions menu

- Intent: find and run a less common action; do it.
- Use when: there are more than two or three actions. Not when: one or two suffice, show them as buttons, see `detail.title-actions`; the actions are destructive or irreversible, see `detail.destructive-in-more-actions`.
- Ask: which actions go in the menu? [every action beyond the first two]; how are they grouped? [by purpose; one group when fewer than eight].
- Admin: Order > More actions, seen 2026-11-14. Also: the order menu is grouped with "Print" and "Apps" group headings; the customer menu is flat; seen 2026-11-16.
- Shape: popover 196x441, 4 below the button, right-aligned to it, radius 16, popover shadow. Starts with a "Search actions" field (input 20 high, 13/20). Items are buttons 188x32, padding 4 8 4 4, radius 12, 13/20 400. Groups: Duplicate, View activity, Cancel order, Archive, View order status page; then a "Print" group label (12px/18px 400, rgb(96,96,96), padding 2 12 2 8, 9 above) with its items; then "Apps". List padding 3 4 4.
- States: Measured 2026-11-16: popover radius 16, width about 195, items 32 high, item hover #F7F7F7, Delete in red #CE1F18, opens from the top right. Items render dimmed while the menu animates in (observed 2026-11-16). States: see `actions.disclosure-menu`, `actions.menu-item`, `actions.popover-animation`.
- Behaviour: host-owned; the app declares the actions. Flow: see `flow.change-status-with-confirm`, `flow.delete-record-with-confirm`.
- Evidence: measured.

### detail.back: return from a record to its list

- Intent: leave the record; do go back to the list.
- Use when: any detail page. Not when: you want to restore filters; the merchant uses browser history. The full anatomy, tooltip and wording of the same control are in `navigation.back-link`; read both.
- Admin: back circle in the title bar of every detail page, seen 2026-11-14.
- Shape: `a[aria-label=<Index name>]`, 28x28 circle, padding 4, white with the secondary-button shadow, chevron-left 20. Then the breadcrumb: index icon 20, index name 13/20 500, "/", record name.
- Behaviour: a plain link to the index (`/discounts`, `/orders`, `/checkouts`) without its filters. Browser back returns to the index with its URL state. Observed 2026-11-16: with a dirty page the Back arrow is blocked, with no modal; see `flow.edit-with-unsaved-guard`. Flow: see `flow.edit-with-unsaved-guard`, `flow.return-to-list`.
- Evidence: measured, https://shopify.dev/docs/apps/launch/built-for-shopify/requirements

### detail.readonly: a record the system created, with no form

- Intent: learn what the system recorded; do open related records.
- Use when: the app created the record and the merchant cannot edit it. Not when: the merchant changes its fields, see `detail.editable`; the record is a customer-created checkout with a recovery state, see `detail.read-only-recovery`.
- Ask: which facts and events are shown? [facts first, then events]; which related records open from here? [the parent and the children]; which actions? [secondary jumps only].
- Admin: Order and Abandoned checkout detail: no form, no save bar, facts and events only, seen 2026-11-14.
- Shape: title block, main sections of cards and tables, aside sections. Actions are secondary buttons that jump elsewhere. A missing related record is a plain line ("No order") in the aside, with no empty card.
- States: an unknown id shows the admin 404 page, not an inline banner. No loading or error state was captured; pages load in about one second behind a blank panel.
- Evidence: observed.

### detail.editable: edit the record on its own page

- Intent: change the record's fields; do save or discard.
- Use when: the record is the merchant's own configuration. Not when: the system owns it, see `detail.readonly`; the merchant creates the record, see `form.create-page`.
- Ask: which fields are editable? [all the merchant's own settings]; can the record be deleted? [yes, from More actions with a confirmation]; which states block edits? [none].
- Admin: Discounts > one discount opens the create form filled in, with the summary aside and the save bar, seen 2026-11-14.
- Shape: the page of `form.create-page`, plus the facts of a saved record in the aside (performance) and the status badge in the title block. Banners explaining why edits are blocked sit at the top of the main column.
- Behaviour: Save stays enabled; Save on invalid edits shows the banner and field errors, see `form.validation-banner`. Delete is a title bar action with a confirm modal.
- Evidence: observed, https://shopify.dev/docs/api/app-home/latest/patterns/templates/details

### detail.rule-state: show an automation's state and how to change it

- Intent: learn whether a rule is on and what it does; do open its settings.
- Use when: a detail page describes a rule with a state, its rules and a link to change them. Not when: the merchant switches it here, a settings page, see `settings.*`.
- Ask: which rules are listed? [the ones that decide the outcome]; where does "Change rules" lead? [the rule's settings page]; is a history shown? [yes, as a table].
- Admin: Discount aside sections (13/20 500 heading, lines, a link), seen 2026-11-14.
- Shape: title block with an On or Off badge beside the h1 and a meta line for the lead sentence. Aside section "Rules": rule name, a subdued line under it, a link "Change rules". No title bar gear that repeats the link. A history table sits in a main section with its heading above.
- Evidence: observed.

### detail.variant-table: edit options and variants inside the record

- Intent: learn the variants with their price and stock; do change them inline.
- Use when: a record has option-based sub-records edited together. Not when: the sub-records have their own page, see `index.table-rows`.
- Ask: which fields per variant? [price and stock]; editable inline? [yes]; which options can be added? [as many as the record allows]; bulk edit? [select rows, then one action].
- Admin: Products > a product with options (`/products/<id>`), seen 2026-11-16.
- Shape: Options block (option name, value chips, "Add another option"); then a table card: location filter "All locations", select-all row "Select all 5 on page", columns Variant, Price, Available; each row has a checkbox, an image slot, the name, a price field with $ prefix and an available number; footer "Total inventory across all locations: 50 available".
- States: loading shows "Loading variants...".
- Copy: Add another option, Image is not applied.
- Evidence: observed

### detail.title-bar-view-as: preview a record as the shopper

- Intent: do see the record as customers do and share it.
- Use when: the record has a public face. Not when: internal only, see `detail.title-actions`.
- Ask: which shopper-facing actions? [View as, Preview, Share]; which is primary? [none on a detail page].
- Admin: `/products/<id>` title bar: View as, Preview, Share, More actions, previous and next arrows. The index has View as, Import, Export, More actions, Add product. `/products/new` has none of them. Seen 2026-11-16.
- Shape: secondary buttons in a row, primary on the right, arrows at the end.
- Evidence: observed

### detail.status-card-header: name a group of lines by its state with an icon tile and actions

- Intent: learn the state of a group of lines (Unfulfilled, Paid); do the next step on the group.
- Use when: a main-column card is one stage of a workflow (fulfillment, payment). Not when: the card is a plain titled section, see `detail.main-section`.
- Ask: which states does the group go through? [two or three]; what is the next step in each? [one primary action]; which secondary steps? [in a split button].
- Admin: Order > fulfillment and payment cards, Refund page, Edit order page, seen 2026-11-16.
- Shape: header sits outside and above the card. Left: a coloured icon tile (yellow for unfulfilled, grey for paid), then the state as the heading. Right: "..." icon button, a split button (label plus caret), then one dark primary button. The card below holds a delivery-method row (icon, method, location pill) then line items.
- States: tile colour follows the state. Refund and Edit pages reuse the header with the location pill only.
- Behaviour: "..." opens a one-item or short menu ("Add to batch"); the split caret opens secondary states ("Mark as in progress", "Mark as on hold").
- Copy: "Unfulfilled", "Paid", "Mark as fulfilled", "Create shipping label".
- Evidence: observed.

### detail.line-item-row: show a product line with thumbnail, quantity and total

- Intent: learn what was bought, how many, at what price; do open the product.
- Use when: a card lists purchased lines. Not when: the lines are editable, see `form.line-item-stepper`; the card also totals the money, see `detail.payment-rows`.
- Ask: what does a line show? [picture, name, unit price, quantity, total]; what does the name open? [the product].
- Admin: Order fulfillment card, Customer last-order card, Abandoned checkout card, seen 2026-11-16.
- Shape: thumbnail left, title (link on checkout, plain text on order), then "unit price x [qty chip]" and the line total right-aligned. On a customer page the right side is "x 1" and the total only. Order card rows sit inside the card under a hairline after the method row. Checkout lines sit in an inner bordered box.
- Copy: "$749.95 x 1", "x 1".
- Evidence: observed.

### detail.aside-edit-affordance: pick the edit control for an aside block

- Intent: change one block in the aside (notes, customer, address, tags, store credit).
- Use when: choosing how an aside section is edited. Not when: the section is read-only, see `detail.aside-section`.
- Ask: which aside blocks are editable? [none]; for each, one action or several? [one: pencil, or "+" when empty].
- Admin: Order and Customer asides, seen 2026-11-16.
- Shape: the section heading carries one icon button at its right. "+" for an empty block (Notes). "..." when there are several actions (Customer: Edit contact information, Remove customer). "..." with one action when the edit opens a large modal (Shipping address: Edit shipping address). Pencil for a single inline edit (Store credit, Notes on a customer). Tags use an input with chips inside the field, no button needed. A copy icon button sits at the right of copyable values (email, address).
- Behaviour: "+" and pencil edit in place or open a small modal; "..." always opens a menu first.
- Evidence: observed.

### detail.payment-link-rows: edit money rows from link-style labels

- Intent: add a discount, shipping or tax to an unfinished record; see the total react.
- Use when: the payment card belongs to a draft or an edit. Not when: the record is final, see `detail.payment-rows`.
- Ask: which adjustments can be added? [discount, shipping, tax]; what does each ask for? [type, value, reason].
- Admin: Create order (draft), Edit order, seen 2026-11-16.
- Shape: same rows as `detail.payment-rows`, but the label is a blue link ("Add custom discount", "Edit shipping fees", "Add discount", "Add shipping or delivery") with the amount right-aligned. "Estimated tax" has an info icon and a "Not calculated" value. Footer strip in grey carries one line of guidance ("Add a product to calculate total and view payment options", "Taxes are estimated until you update the order"). Total shows the currency code ("$0.00 USD").
- States: rows are grey and inert until a product exists.
- Behaviour: a discount link opens a modal 595x296 (Type select, value, reason). Shipping and tax open their own popover or modal.
- Evidence: observed.

### detail.read-only-recovery: show an abandoned checkout and its recovery state

- Intent: learn whether the buyer was reminded and what was in the cart; do print or copy the recovery link.
- Use when: a record is customer-created and the merchant only reads it. Not when: edits are allowed, see `detail.editable`; the record is any other system-created one, see `detail.readonly`.
- Ask: which recovery facts? [reminder sent or not, when, recovery link]; which actions? [print, copy the link]; is a notes card editable? [no].
- Admin: Abandoned checkout `/checkouts/ID`, seen 2026-11-16.
- Shape: title is the id, with status pills "Not recovered" (orange) and "Email sent" (green), then country and date. Green banner "Cart recovery email sent" with the sent time and the recovery URL in a read-only grey box. "Checkout details" heading with "From Online Store" at right. Card: line, discount (code in detail column), subtotal, shipping, estimated tax, total, hairline, "To be paid by customer". Only editable thing is a "Notes" card with Save. Title bar has just "Print" and prev/next. Aside: Customer, Contact information (copy icon), Shipping address (copy icon), Billing, Marketing subscriptions.
- Evidence: observed.

### detail.stat-strip: three or four headline stats under the title

- Intent: learn the customer's totals at a glance.
- Use when: a person or account record has headline numbers. Not when: figures belong to a list, see `index.metrics-strip`; one or two figures fit the aside, see `detail.summary-values`.
- Ask: which three or four totals? [the ones the merchant asks about first]; what does each one mean? [one-sentence definition].
- Admin: Customer detail (Amount spent, Orders, Customer since, RFM group), seen 2026-11-16.
- Shape: no card. A row of columns under the title, each a dotted-underline label (opens a definition) over a value. Prev/next arrows sit at the right edge when more stats exist.
- Behaviour: label click opens a definition popover ("Open definition for ...").
- Evidence: observed.

### detail.last-record-card: show the most recent related record in its own section

- Intent: see the latest order of a customer; do open all orders or create one.
- Use when: a record has children and the newest is the most useful. Not when: all children matter, use a table, see `index.table-rows`.
- Ask: which related record? [the newest]; which actions in the header? ["View all" link; create only if the merchant can]; what does the card show? [number, status, total, date].
- Admin: Customer > "Last order placed", seen 2026-11-16.
- Shape: section heading with "View all orders" link and dark primary "Create order". Card: inner banner if special (test order), then order number, payment and fulfillment pills, total right, date and channel, hairline, line items.
- Evidence: observed.

### detail.pinned-metafields: show pinned custom fields or invite a definition

- Intent: read custom fields; do define a new one.
- Use when: the record type supports custom fields. Not when: the app owns the data.
- Ask: which fields are pinned? [none until the merchant pins]; can the merchant define new ones? [yes, "Add definition"].
- Admin: Customer > Metafields, seen 2026-11-16.
- Shape: section heading with "View all" link and "Add definition" pill; card with "No metafields pinned" when empty.
- Evidence: observed.

### detail.destructive-in-more-actions: place merge, erase and delete in the More actions menu

- Intent: reach rare and risky actions without tempting a click.
- Use when: the record has destructive actions. Not when: the action is common, see `detail.title-actions`; the menu holds only everyday actions, see `detail.more-actions`.
- Ask: which actions are destructive? [delete, erase, merge]; what does each confirmation say? [what is lost and that it cannot be undone].
- Admin: Customer More actions (Send account invite, Issue store credit, Merge customer, Request customer data, Erase personal data, Delete customer, then Flow items), Order More actions (Duplicate, View activity, Cancel order, Archive, View order status page, Print group, Apps group), seen 2026-11-16.
- Shape: pill "More actions" with caret. Menu 186 to 196px wide. Items are plain text, no red tone seen; groups are separated and group titles ("Print", "Apps") are small headings. Destructive items sit in the middle or end, after the useful ones. Each opens a confirm modal rather than acting.
- States: Confirmed 2026-11-16: Delete product is a red (#CE1F18) menu item; Cancel order is not red. The "no red tone seen" in Shape is the older reading. States: see `actions.destructive`.
- Behaviour: Flow: see `flow.delete-record-with-confirm`.
- Evidence: observed.

### detail.timeline-comment-composer: add a staff comment at the top of the timeline

- Intent: leave a note for staff on the record.
- Use when: staff discuss a record that has a timeline, or need dated notes with an author. Not when: one private note per record, use the aside Notes block, see `detail.aside-edit-affordance`; the merchant only reads the history, see `detail.timeline`.
- Ask: do staff leave comments? [no]; formatting, mentions, references, attachments? [no: plain text]; can a comment be edited or deleted? [yes, by its author, delete with a confirmation].
- Admin: Order and Customer > Timeline, measured 2026-11-16.
- Shape: one card directly under the "Timeline" heading, the track starting at its bottom edge. Top part 64 high, white, radius 12 12 0 0, padding 12: the staff avatar 40x40 (radius 12) at the left, then the editor at x 64 with the placeholder "Leave a comment..." and no visible label. Footer part 53 high, bg rgb(247,247,247), radius 0 0 12 12, padding 12: 28x28 icon buttons at the left (Add emoji, Mention staff, Reference page, Attach file) and a "Post" pill 49x28 at the right. Under the card, right-aligned, the help "Only you and other staff can see comments" 12px rgb(74,74,74).
- States: "Post" is disabled (bg rgba(0,0,0,0.13), white text) while the editor is empty and turns rgb(16,16,16) with the first character. Focus shows a rich-text toolbar (bold, italic, link, lists) in the admin.
- Behaviour: posting clears the editor and adds the comment as the first entry under "Today", see `detail.timeline-comment`. Nothing navigates and no toast shows.
- Copy: placeholder "Leave a comment..."; button "Post"; help "Only you and other staff can see comments".
- Evidence: measured.

### detail.timeline-comment: read a staff comment in the timeline

- Intent: learn who wrote what and when; do edit or delete it.
- Use when: the timeline holds staff comments. Not when: the entry is a system event, see `detail.timeline`.
- Admin: Order > Timeline, measured 2026-11-16.
- Shape: a card across the section width that covers the track, 72 high for one line, 16 below it: white, radius 20, the card shadow, padding 16. Avatar 40x40 at the left. At x 68 the author's name 13px semibold followed on the same line by the age in small subdued text ("Just now"); the comment 13/20 on the next line. A tertiary "More actions" icon button 28x28 at the top right. No marker and no time column.
- States: the menu holds "Edit comment" and "Delete comment" in the critical colour, items 32 high.
- Behaviour: delete opens a modal "Delete comment" that quotes the comment, with Cancel and a critical "Delete"; the entry then disappears with no toast, see `flow.delete-record-with-confirm`.
- Copy: modal body "Deleting this comment can't be reversed. It will no longer be shown in the timeline."
- Evidence: measured.

### detail.media-file-editor: open one file to rename, describe and edit it

- Intent: learn a file's size, type and usage; do edit its name and alt text, crop, resize, draw.
- Use when: the record is a media file and edits are small. Not when: the file is only picked, see `overlay.picker-modal`.
- Ask: Which edits does the file support? [crop and transform, resize, draw]. Download in the bar? [yes].
- Admin: Content > Files > one file (`/content/files/<id>`), seen 2026-11-16.
- Shape: full-viewport dark page, not a modal. Top bar: back icon, file name, download icon. Left the image on black. Right a column of dark cards: Information (Name input, Alt text textarea, Details "JPG · 1600 × 1600 · 94.26 kB", "Added Apr 9, 2024", Used in "Products (1)"), then collapsed cards "Crop and transform", "Resize", "Draw" each with an icon.
- Behaviour: back icon returns to the list.
- Evidence: observed.
