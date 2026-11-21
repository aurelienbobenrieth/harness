# Navigation

The merchant wants to move between places and come back to where they were.

### navigation.back-link: go back from a record to its list

- Intent: learn where the page sits; do return to the list.
- Use when: the page is one record opened from a list (Order, Discount). Not when: the page is top level (an index, Home); draw no back arrow and no breadcrumb, see `navigation.app-nav`. The same control seen from a detail page, with the title-bar context, is `detail.back`; read both.
- Admin: Order, Discount, Abandoned checkout title bar, seen 2026-11-14.
- Shape: first item of the title bar row (28 high, y 16): a 28x28 circle, padding 4, white bg with the secondary-button shadow, chevron-left 20. It is an `a` labelled with the list name. After it, gap 8, a breadcrumb: list icon 20, list name 13/20 500, "/", then the record name as h1 13/28 500 (it appears once the big body title scrolls away).
- States: a tooltip shows 4 below the trigger, centred (dark pill, bg rgb(26,26,26), radius 10, text 13/20), after about 0.5 to 0.9 s.
- Behaviour: back is a plain link to the bare list URL (`/discounts`, `/orders`). It does NOT carry the list's filters, sort or page; the arrow resets the view. Browser Back (history) returns to the list with its URL state. Observed 2026-11-16: with a dirty page the Back arrow, sidebar links and browser Back are blocked with no modal; the URL stays and the save bar animates; see `flow.edit-with-unsaved-guard`. Flow: see `flow.edit-with-unsaved-guard`, `flow.return-to-list`.
- Copy: the aria-label is the list's name ("Discounts").
- Evidence: measured, https://shopify.dev/docs/apps/launch/built-for-shopify/requirements

### navigation.prev-next: step to the neighbouring record

- Intent: learn there are neighbours in the list; do open the previous or next record without going back.
- Use when: the records have a stable order from a list (Orders, Discounts). Not when: the records have no list order (a top-level page, a single record), draw nothing.
- Ask: step through which list? [the list it was opened from, with its filters and sort].
- Admin: Order, Discount and Abandoned checkout title bar, far right, seen 2026-11-14.
- Shape: two 28x28 buttons side by side (padding 4), chevron-up and chevron-down, after the "More actions" button. Labels "Go to previous page" and "Go to next page".
- States: disabled rgb(166,166,166); enabled rgb(16,16,16).
- Behaviour: keyboard J and K. Tooltips show the key.
- Copy: "Go to previous page", "Go to next page".
- Evidence: measured.

### navigation.app-nav: move between the app's top-level pages

- Intent: learn which page is open; do open another page of the app.
- Use when: the page is one of the app's sections. Not when: the target is a sub-page of a settings area, see `navigation.settings-sidebar`; the target is outside the app, see `navigation.external-link`.
- Ask: which pages are top level? [the few the merchant visits weekly, named as nouns]; which opens first? [the page that shows the most urgent work].
- Admin: left navigation of the admin frame, seen 2026-11-14; the dark frame is 220 wide (60 when collapsed to icons).
- Shape: the host draws the app's links under the app name. A top-level page shows no back arrow and no breadcrumb, only the title.
- Behaviour: a link navigates in the same frame, no reload. A modified click (Cmd, Ctrl, Shift) opens a new tab; a middle click does too. A new page opens at its top, see `navigation.scroll-reset`.
- Evidence: observed, https://shopify.dev/docs/apps/design/navigation, https://shopify.dev/docs/apps/launch/built-for-shopify/requirements

### navigation.settings-sidebar: move between settings sections

- Intent: learn which section is open; do open another one.
- Use when: an area has many settings sections (Settings > General, Plan, Billing). Not when: the sections are a few peers on one page, use `navigation.views-vs-tabs`; the settings page is a list of destinations with a line each, see `navigation.settings-link-list`; the sections are the app's own top-level pages, see `navigation.app-nav`.
- Ask: which sections? [one per topic the merchant configures]; how are they grouped? [by area, labelled when more than five]; which opens first? [the first section].
- Admin: Settings sub-navigation, seen 2026-11-14. Also: Users has a nested sub-nav (Users, Roles, Security) that appears in the settings sidebar under the org item; store settings follow below.
- Shape: nav items 28 high, 30 pitch, padding 0 6 0 16, radius 8, 13px/450; selected weight 500 with a fill. Group header 12px/500 subdued. One 16 gap between groups, whether labelled or not (the admin's gaps sit between 16 and 25). Content column: max 784, centred, 32 side gutters (at a 1169 viewport, main 849). Page title h1 26/32 500; title box to the first section heading box 32.
- States: selected item has the fill and 500 weight.
- Behaviour: a section is a URL. On a phone one page shows at a time: the list of sections when none is open, else the section under a back button to that list. Leaving a section with unsaved edits should ask first (the admin asks).
- Copy: group headers name the product or area ("Store", "Account").
- Evidence: measured.

### navigation.settings-link-list: open a settings sub-page from a list of links

- Intent: learn which sub-pages exist; do open one.
- Use when: a settings page is mostly a list of destinations, each with a name and a subdued line. Not when: the rows hold a setting to change in place, see `settings.*`; the destinations are peers on one page, see `navigation.views-vs-tabs`; the destinations are many sections with a sidebar, see `navigation.settings-sidebar`.
- Ask: which destinations? [one per sub-page]; what does the line under each say? [what it holds]; any static row with no link? [none]; any end action pill? [none].
- Admin: Settings > General summary rows, seen 2026-11-14.
- Shape: a card with no padding (radius 20); rows sit straight in it, split by dividers. Row padding 12 16 (first row 16 16 12). Leading icon 16 (margin 2) at an 18 inset; text at a 48 inset; title 13/400 rgb(16,16,16) and a subdued line 13/400 rgb(74,74,74); trailing chevron 16 rgb(96,96,96).
- States: a clickable row fills its whole width on hover.
- Behaviour: the whole row is the link; a static row (no destination) has no hover and no chevron. A pill action at the end (24 high, radius 9999, bg #ebebeb, 12/500, "View release notes") is a separate target.
- Copy: title is the destination; the second line says what it holds.
- Evidence: measured, https://shopify.dev/docs/api/app-home/latest/patterns/compositions/interstitial-nav

### navigation.views-vs-tabs: choose between slices on a page and places

- Intent: learn which of two mechanisms to use.
- Use when: deciding how to split content. A saved slice of the same list is a view pill, see `index.view-menu` (the admin dropped saved-view tabs in 2026). Sections of settings are a sidebar, see `navigation.settings-sidebar`. Tabs remain only for a few peer panels of one page that are not slices of a list.
- Ask: is the split a saved slice of one list, a set of settings sections, or a few peer panels? [a view pill for slices, a sidebar for sections, tabs for peers].
- Admin: Orders, Discounts (view pill, no tabs), Settings (sidebar), seen 2026-11-14.
- Shape: the view pill is 51x28 in the filter bar; a tab bar is not part of the 2026 index.
- Behaviour: every choice is a URL. A view writes `savedViewId` and `query`; a settings section is a path.
- Evidence: observed, https://shopify.dev/docs/apps/design/navigation

### navigation.url-state: make any place reachable by a link

- Intent: do share, reload or bookmark a page and land on the same view.
- Use when: any page whose view the merchant chooses (list state, a section, a period). Not when: transient UI (open popover, selection, a modal in progress).
- Admin: every index and detail, seen 2026-11-14.
- Shape: path for the place, query for the view; see `index.url-state` for the index keys. A key at its default is left out. A detail page uses `/<list>/<id>`.
- Behaviour: opening the URL directly rebuilds the whole view. A deep link also restores a no-results state.
- Evidence: measured.

### navigation.push-vs-replace: decide what a change does to history

- Intent: do press Back and land where the merchant expects.
- Use when: a view change. A deliberate choice (a view, a sort, a filter pick, a page) pushes a history entry. Typing, or filling in a default the URL omitted, replaces the entry. Not when: leaving a finished flow for a result page; replace, so Back does not re-enter the flow.
- Admin: Orders, browser Back returns to `/orders` with the same view; seen 2026-11-14.
- Behaviour: opening a row and pressing Back returns to the list as it was. A flow that finishes replaces the URL, so Back does not return into it.
- Evidence: observed.

### navigation.scroll-reset: start a new page at its top

- Intent: do arrive on a page and see its top.
- Use when: any navigation to a new page, and Back and Forward. Not when: a hash link, which lands on its section and moves focus there.
- Admin: Orders scrolled, an order opened, then Back: the list is at its top; measured 2026-11-15 (noted in the app's code comment).
- Behaviour: the admin scrolls to the top on Back and Forward as well, so the app takes over the browser's scroll restoration.
- Evidence: observed.

### navigation.external-link: leave the app for Shopify or another site

- Intent: learn the link leaves this page; do open the Shopify admin place or a site.
- Use when: the target is outside the app (an admin page for the same record, a guide). Not when: the target is another app page, see `navigation.app-nav`.
- Ask: where does each link lead? [the matching Shopify admin page]; link or secondary button? [a link in an aside, a secondary action in the title bar].
- Admin: the admin's own jump words are plain ("View order"); the admin writes links in blue in aside sections (customer name, "View map").
- Shape: a link or a secondary title-bar action; a link inside an aside is blue 13/20.
- States: see `actions.text-link`.
- Behaviour: a modified click (Cmd, Ctrl, Shift) or a middle click opens a new tab, as on every admin link.
- Copy: "View order", not "Open order in Shopify Admin".
- Evidence: observed.

### navigation.app-launcher-list: split an app into a few sub-areas on its home

- Intent: learn what the app contains; do open one area.
- Use when: the app has two to four unrelated areas and no data to lead with. Not when: the app has one main list, see `index.*`; there are many areas, use the host sidebar sub-items.
- Ask: which areas [Blocks, Functions]? One-line description each [yes]?
- Admin: Apps > Checkout Blocks (`/apps/checkout-blocks`), seen 2026-11-16.
- Shape: h2 "Customize blocks and functions", one card of rows. Row: small icon, title, subdued description, chevron-right. Under the card, centred: a "Learn more" link sentence about which features the Shopify plan includes.
- Behaviour: the whole row is the link. The title bar holds only the "..." menu, no primary action.
- Evidence: observed.
