# Actions

The merchant wants to trigger something: buttons, links, menus and their states.

### actions.hierarchy: place one primary and rank the other actions of a page

- Intent: learn which action a page expects; do the main thing or a lesser one.
- Use when: any page or card with more than one action. Not when: a single action (just a secondary button, see `actions.button-secondary`).
- Ask: Which single action is primary on each page? [create on an index, none on a record until it is dirty, "Save" on a form]. Which actions go in More actions? [rare, destructive and print/flow items].
- Admin: Orders, Products, one order, one product (`/orders`, `/products`, `/orders/<id>`, `/products/<id>`), seen 2026-11-16. Also: Settings rows (links, no buttons).
- Shape: title bar right-aligned, ordered left to right as secondaries then the primary at the far end. Index: Export/Import/View as (secondary), More actions (disclosure), then primary (Create order, Add product). Record: Refund, Edit, More actions, prev/next group; no primary in the bar (the order's primary, Create shipping label, sits in the fulfilment card beside a split secondary); product has View as, Preview, Share, More actions. Card header: tertiary icon buttons (Add note, Edit customer). Card body: plain link actions (View map). Card footer or inline: secondary/primary 28px. Rank by fill: primary dark, secondary white fill with rim, tertiary transparent, plain blue text.
- States: see each button entry.
- Behaviour: one primary per page; destructive actions leave the bar for the More actions menu; the primary appears (Save) only when the record is dirty.
- Copy: "Create order", "Add product", "More actions", "Create shipping label", "Mark as fulfilled".
- Evidence: measured

### actions.button-primary: trigger the page's main action

- Intent: do the one action the page exists for.
- Use when: it is the most likely next step, one per page. Not when: it is destructive or optional, see `actions.button-secondary`; the action is rare, see `actions.disclosure-menu`.
- Ask: Label as verb plus noun? [yes]. Disabled until valid or errors on submit? [disabled while nothing to save].
- Admin: Orders (Create order), Products (Add product), one order (Create shipping label, Post comment), seen 2026-11-16.
- Shape: 28px high, radius 9999px, padding 6px 12px, 12px/500, bg #101010, text #fff, two radial white highlights, 4-layer drop shadow, inset glow.
- States: hover bg #0A0A0A text #DDD; pressed scale(.97); keyboard focus 2px solid #5083F0 outline; disabled bg rgba(0,0,0,.13) text #fff, no shadow, cursor auto; loading not seen.
- Behaviour: may be an anchor (Create order is `<a>`) or a button; transitions 0.4s cubic-bezier(.2,.8,0,1); no size change in any state.
- Copy: "Create order", "Add product", "Post".
- Evidence: measured

### actions.button-secondary: trigger a supporting action

- Intent: do an action that is not the main one.
- Use when: several actions compete in a bar or card. Not when: it is the main action, see `actions.button-primary`; it is low emphasis inside a dense row, see `actions.button-tertiary`.
- Admin: Orders (Export), Products (Import, Export, View as), one order (Refund, Edit), seen 2026-11-16.
- Shape: 28px, radius 9999px, padding 6px 12px, 12px/500, text #101010. Button is transparent; a `.fill` span is #fff; a `.decoration` span carries rim `0 0 0 1px rgba(0,0,0,.07)` plus three soft shadows.
- States: hover fill #F7F7F7; keyboard focus ring on the decoration, 2px solid #5083F0; pressed scale(.97); disabled bg rgba(0,0,0,.03), text #A6A6A6, cursor auto; expanded (menu open) takes the pressed look.
- Behaviour: no size change on hover or focus.
- Copy: "Export", "Import", "Refund", "Edit", "Preview", "Share".
- Evidence: measured

### actions.button-tertiary: low-emphasis or icon-only action with a tooltip

- Intent: do a small action beside a title without visual weight.
- Use when: card-header actions (Add note, Edit customer, Manage tags) or "Discard". Not when: the action needs to stand out, see `actions.button-secondary`; the action is a text link inside the body, see `actions.link-action`.
- Ask: Icon only or labelled? [icon only in a card header, with tooltip and aria-label].
- Admin: one order (Add note, Edit customer, Edit shipping address), Orders (Display options), one product (Manage publishing), seen 2026-11-16.
- Shape: 28x28 icon-only (padding 4px), radius 9999px, transparent bg, icon and text #606060; text tertiary padding `4px 12px 4px 6px`.
- States: hover and focus bg rgba(0,0,0,.08) and colour #4A4A4A; keyboard focus outline 2px solid #5083F0 on the button; pressed scale(.97); tooltip on hover.
- Behaviour: icon-only buttons carry an `aria-label` that doubles as the tooltip text, see `actions.tooltip-look`.
- Evidence: measured

### actions.link-action: link-style action inside a card

- Intent: open a related view or edit a value from within a card.
- Use when: the action is small, inline in a card body (View map, View conversion details, View details). Not when: it is a card-header action, see `actions.button-tertiary`; it is a link in running text, see `actions.text-link`.
- Admin: one order, one product, seen 2026-11-16.
- Shape: plain variant, 20px high, padding `0 2px`, 13px/400, text #1650D0, no underline at rest. Icon-only plain variants are 20x20 (Edit tags, Edit collections, Learn more).
- States: hover #1347B9 with underline; keyboard focus underline plus outline 2px solid #5083F0 with a negative offset and 4px radius; pressed opacity .4; disabled not seen.
- Behaviour: anchor or button depending on target.
- Evidence: measured

### actions.destructive: put a destructive action behind More actions as a red item

- Intent: delete or cancel without inviting a mis-click.
- Use when: delete, archive-like or cancel actions on a record. Not when: the destructive button is the confirm button of a modal, use the critical button variant (secondary-critical hover rgba(255,208,204), pressed rgba(252,181,177), from the stylesheet, not seen on screen).
- Ask: Confirm in a modal? [yes for delete product, no for Archive].
- Admin: one product (More actions > Delete product), one order (Cancel order, not red), seen 2026-11-16.
- Shape: menu item with `critical` class: text and icon #CE1F18; otherwise the standard 32px item.
- States: hover bg #F7F7F7, text stays red, icon does not change; keyboard focus 2px solid #5083F0.
- Behaviour: sits after neutral items in the same section; opens a confirmation modal.
- Copy: "Delete product".
- Evidence: measured

### actions.disclosure-menu: a button that opens a menu

- Intent: reach rarely used actions.
- Use when: more than two lesser actions. Not when: the lesser action is one, use a secondary button; the choice is a value, see `fields.*` selects.
- Admin: "More actions" on index and record pages; "Showing orders at All locations", seen 2026-11-16.
- Shape: secondary button with padding `4px 6px 4px 12px` and a caret icon; popover bg #fff, radius 16px, width 193 to 196px, list padding `3px 4px 4px`, opens under the button aligned right.
- States: `aria-expanded` false/true; expanded button takes the pressed fill; popover transition opacity and transform 0.25s cubic-bezier(.19,.91,.38,1), transform-origin top right.
- Behaviour: Escape closes; items activate on click or Enter.
- Evidence: measured

### actions.split-button: a main action with a caret for its variants

- Intent: do the usual action or pick a related one.
- Use when: one action has a few variants (Mark as fulfilled and its options). Not when: unrelated actions, see `actions.disclosure-menu`; paired prev/next, see below.
- Admin: one order, fulfilment card; pagination arrows use the same group shape, seen 2026-11-16.
- Shape: label button 115.5x28, radii `9999px 0 0 9999px`; caret 28x28 radii `0 9999px 9999px 0` (aria-label "More fulfillment options"); both bg #EBEBEB; seam between them.
- States: as secondary; disabled half (Backward) bg rgba(0,0,0,.03) text #A6A6A6.
- Behaviour: the caret opens a menu; the label runs the default.
- Evidence: observed (computed values dumped, not each state)

### actions.button-sizes: heights by context

- Intent: learn which size to use where.
- Use when: choosing a size. Not when: n/a.
- Admin: Orders, order, product, seen 2026-11-16.
- Shape: 28 in title bar, card headers, modals, pagination; 24 in the table bulk bar and rich-text toolbar; 20 for plain link actions; 32 for table cell buttons (View customer). Font 12px/500 in buttons, 13px in links.
- Behaviour: size never changes with state.
- Evidence: measured

### actions.menu-item: one entry in an action list

- Intent: pick one action from a list.
- Use when: a popover list. Not when: the choice is a stored value, see `fields.*`.
- Admin: Orders and product More actions menus, seen 2026-11-16.
- Shape: 32px high, padding `4px 8px 4px 4px`, radius 12px, 13.33px/400, icon then label; sections divided.
- States: hover and focus bg #F7F7F7; keyboard focus adds 2px solid #5083F0; pressed bg rgba(0,0,0,.13); disabled #A6A6A6; critical #CE1F18; icon #606060 rest, #4A4A4A hover, #101010 pressed. Selected with check, help line: not seen.
- Behaviour: cursor pointer; Enter activates; arrow keys move (not tested).
- Copy: "Duplicate", "View activity", "Archive", "Print order page".
- Evidence: observed (all listed states except pressed and selected were read from rules or computed)

### actions.clickable-row: a table or settings row that opens its record

- Intent: open a record from its row.
- Use when: rows of a list. Not when: the row is an editor, see `settings.summary-row`.
- Admin: Orders table; Settings > Notifications, seen 2026-11-16.
- Shape: table row is `display: contents`; hover colours its cells #F7F7F7; cursor pointer on cells; nested buttons keep their own pointer and open overlays; Settings row: whole 752x40 grid pointer but only the 20px label is the anchor.
- States: hover #F7F7F7 (table); settings hover unmeasured; focus on the link.
- Behaviour: the order-number link opens the record; checkbox and cell buttons do not.
- Evidence: observed

### actions.text-link: a link in text, in a table, or bold

- Intent: navigate from text.
- Use when: a link in prose (#1650D0, no underline) or table (#101010, underline on hover). Not when: it is an action, see `actions.link-action`.
- Admin: order (customer name, email), Orders table (order number), line-item (product, bold 500), seen 2026-11-16.
- States: hover underline; table link keeps its colour; keyboard focus is the UA outline on plain anchors. Visited and external-link icon not measured.
- Evidence: observed

### actions.chip: a removable or clickable tag and the view pill

- Intent: show a value you can open or remove; switch view.
- Use when: tags/collections on a record (removable chip, 20px, radius 8px, bg rgba(0,0,0,.05); hover .08; remove button opacity 0 at rest). Not when: optional fields, see `form.chip-reveal-fields` (28px radius 8px pills); a view switch (28px pill, hover rgba(0,0,0,.08)).
- Admin: product (collections, tags, Disclosures), Orders view pill "All", seen 2026-11-16.
- States: see values; clickable tag hover and the remove reveal are not measured.
- Evidence: observed

### actions.focus-ring: how keyboard focus shows

- Intent: see where keyboard focus is.
- Use when: all controls. Not when: n/a.
- Admin: all pages, seen 2026-11-16.
- Shape: outline 2px solid rgba(80,131,240,1); offset 1px by default, 2px for unchecked checkbox and radio, negative for plain buttons and sort headers (-4px); radius 9999px on pills, 4px on plain.
- Behaviour: `:focus-visible` only; a mouse click shows nothing, Tab does.
- Evidence: measured

### actions.cursor-rules: which cursor each control shows

- Intent: tell clickable from inert.
- Use when: all controls. Not when: n/a.
- Admin: all pages, seen 2026-11-16.
- Shape: pointer on buttons, links, clickable cells, chips, menu items, checkbox labels, switches; auto on disabled buttons (not not-allowed); default on nav list items and inert slim buttons.
- Evidence: observed

### actions.pressed-feedback: how pressing is shown

- Intent: feel the press.
- Use when: any admin-next button. Not when: plain buttons, which dim (opacity .4); menu items, which darken (rgba(0,0,0,.13)).
- Admin: all pages, from the stylesheets, seen 2026-11-16.
- Shape: `transform: scale(.97)` on the button and its fill; `::after` counter-scales so the hit area stays.
- Evidence: observed (rules read, `:active` not forced)

### actions.tooltip-look: how a tooltip looks and times

- Intent: learn what an icon button does.
- Use when: icon-only buttons. Not when: a term needs a definition, see `fields.help-tooltip`.
- Admin: order icon buttons, seen 2026-11-16.
- Shape: bg #1A1A1A, text #EEE, 13px, padding 4px 8px, radius 10px, max-width 250px; above, centred, 4px gap.
- States: opacity and transform 0.25s cubic-bezier(.19,.91,.38,1) from scale(.95).
- Behaviour: no delay measured (timers throttled), none to hide; keyboard focus untested.
- Evidence: observed

### actions.popover-animation: how a popover opens

- Intent: n/a (motion).
- Use when: any menu popover. Not when: a modal (scale .98 to 1, CSS only).
- Admin: More actions menus, seen 2026-11-16.
- Shape: opacity and transform 0.25s cubic-bezier(.19,.91,.38,1); origin top right (e.g. `196px 0`); bg #fff, radius 16px.
- Evidence: observed
