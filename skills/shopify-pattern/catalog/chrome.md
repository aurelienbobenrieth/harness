# Chrome

The merchant uses the admin frame around the app: navigation, title bar, save bar, modal, toast and Sidekick. The host owns all of it. An app screen asks for it through App Bridge and never draws it.

### chrome.title-bar: have a page title with its actions

- Intent: learn where I am and what the page's main actions are; do a page-level action or go back.
- Use when: any page. The host draws one row for the title and actions. Not when: the action only matters inside a section, see `form.*` and `detail.*` section actions; the actions are many and secondary, see `chrome.more-actions-menu`.
- Ask: what is the page's one primary action? [one verb plus noun, or none]; which secondary actions? [at most two, the rest in "More actions"]; a back link? [only on detail pages]; a badge next to the title? [none].
- Admin: Orders (index) and an order (detail), seen 2026-11-14. Also: top-level pages show no back arrow and no breadcrumb. Embedded app title bars show the app icon before the name (Flow, Checkout Blocks, Messaging, seen 2026-11-16).
- Shape: one 28-high row at y 16 inside the page panel, content inset 16 from the panel's left edge.
  - Index: 20px icon, h1 13px/28px 500, optional picker pill. Right side: secondary buttons, then one primary, gap 6-8.
  - Detail: back circle (28x28, white, secondary shadow, chevron-left 20) plus breadcrumb. Right side: secondary buttons, "More actions" (chevron-down, padding 4 6 4 12), prev/next 28x28 pair.
  - Buttons 28 high, radius 9999, 12px/16px 500, padding 6 12. Primary bg rgb(16,16,16), white text. Secondary bg #fff with a 1px ring shadow. Tertiary icon button transparent, icon rgb(96,96,96). Disabled text rgb(166,166,166).
- States: button background and shadow transition `.4s cubic-bezier(.2,.8,0,1)`.
- Behaviour: the back circle is a link to the parent list. Badges next to the title sit 8 after the h1.
- Evidence: measured, https://shopify.dev/docs/apps/design/navigation

### chrome.more-actions-menu: reach secondary page actions

- Intent: do a less common page action; find an action by name.
- Use when: the title bar has more actions than fit as buttons. Not when: the actions belong to one row or section, see `overlay.actions-popover`.
- Admin: Domains verification page and detail pages, "More actions", seen 2026-11-14. Also: in embedded apps (Flow, Checkout Blocks, Messaging) the "..." More actions button is always the last action (seen 2026-11-16).
- Shape: popover radius 16, items 32 high with radius 12, padding 4 8 4 4, text 13/20. Group labels 12/18 rgb(96,96,96). An optional "Search actions" field sits on top.
- States: see `actions.disclosure-menu`, `actions.menu-item`.
- Behaviour: the button has a chevron-down; click opens, Escape and outside click close.
- Evidence: measured.

### chrome.save-bar: save or discard unsaved edits

- Intent: learn that edits are not saved yet; do Save or Discard.
- Use when: a form or settings page has a draft the merchant has not saved. Not when: the change applies at once (a toggle that saves itself, a modal with its own Save), see `overlay.modal-edit`; the question is which settings save at once, see `settings.save-model`.
- Ask: which edits count as a draft? [every inline field]; what does the label say? ["Unsaved changes"]; confirm on discard or on leaving? [no since the 2026-11-16 observation, see Behaviour; the earlier answer was yes, see `chrome.discard-confirmation`].
- Admin: Discount create and Settings pages, seen 2026-11-14.
- Shape: dark pill centred in the title bar row, y 12, 277x36, bg rgb(10,10,10), radius 9999, padding 4 4 4 12. Label "Unsaved <thing>" in light text. Discard (bg rgba(255,255,255,.12), text rgb(238,238,238)) and Save (bg rgb(252,252,252), text rgb(18,18,18)); both 28 high, 500, padding 6 12, gap 4. The breadcrumb and header actions stay visible on both sides.
- States: button transition `opacity .1s, transform .1s`. On a phone the bar covers the title bar and its buttons become round: Discard (cross) and Save (check) at either end. Measured 2026-11-16: Discard 73x28, bg rgba(255,255,255,.12); Save 55x28, bg rgb(252,252,252). No loading spinner on Save was visible 50 ms after the click; a loading state is not captured.
- Behaviour: appears as soon as the draft differs. Settings save only from here, never from an in-page Save button. Leaving with a dirty draft is blocked with no prompt, and Discard asks nothing (2026-11-16, see `chrome.discard-confirmation`). Older reading, before 2026-11-16: the admin asks about leaving. Seen 2026-11-16: Discard reverts at once with no confirmation; clicking another settings link while dirty is blocked and the bar shakes (x +56 px and back in 150 ms); the bar shows above an open modal. The label depends on the page: "Unsaved discount", "Unsaved product", "Unsaved changes". Save stays enabled when validation fails. A dirty Back arrow, sidebar link and browser Back are blocked with no modal (see the flow below). Flow: see `flow.edit-with-save-bar`.
- Copy: label "Unsaved changes" style, buttons "Discard" and "Save".
- Evidence: measured, https://shopify.dev/docs/apps/launch/built-for-shopify/requirements

### chrome.discard-confirmation: confirm before dropping a draft

- Intent: learn that Discard or leaving loses edits; do keep editing or discard.
- Use when: the save bar declares a discard confirmation, or the merchant leaves a dirty page. Not when: the page has no draft, see `chrome.save-bar`.
- Admin: save bar `discardConfirmation` (App Bridge). Older reading: the admin asks before leaving a dirty settings tab. Observed 2026-11-16: it asks nothing, see Behaviour.
- Shape: the host's confirm modal (see `chrome.modal`) opened from Discard (older reading; on 2026-11-16 Discard on an existing record opened no modal).
- Behaviour: App Bridge exposes a `discardconfirmation` flag on the bar. Observed 2026-11-16: Discard reverts at once with no confirmation, on a settings page and on an existing record. A dirty page blocks the Back arrow, sidebar links and browser Back with no modal: the URL stays and the save bar animates (shakes). Flow: see `flow.edit-with-save-bar`, `flow.edit-with-unsaved-guard`.
- Evidence: docs, `https://shopify.dev/docs/api/app-home/apis/save-bar`.

### chrome.modal: open a host modal from the app

- Intent: do a focused task or confirm an action in a dialog over the admin.
- Use when: the app asks `ui-modal` to open. Not when: the choice is between modal, inline and sub-page, see `overlay.modal-vs-inline-vs-page`; for a settings value, see `settings.edit-inline-or-modal`.
- Ask: what is the modal's one task? ; what does the primary button say? [the action, as a verb]; size? [base]; does closing discard input? [yes, Cancel and Escape].
- Admin: App Bridge modal (`s-modal`) and admin-native dialogs such as confirm delete and connect domain, seen 2026-11-14.
- Shape: native `dialog`, centred in the viewport, radius 24, bg #fff, padding 0.
  - Sizes: small 380, base 620, large 980, large-100 980 at full height. Max height 100svh - 60.
  - Header 60 (padding 16/16/16/20), title h2 15px/22px 500. Close button 28x28, bg rgb(247,247,247) with the secondary shadow, 20px x icon. Footer 56 (padding 12/16/16), buttons right-aligned, gap 8. Content padding 4px 20px; `padding="none"` gives 0. No header or footer dividers.
  - Backdrop about 50% black, fades in over 200ms. The `::backdrop` itself is transparent; the dim is a separate layer.
  - Height follows content (180 for one field, 337 with a banner and an offer card). The field's 3px focus halo stays inside the 20px body inset.
- States: enter from opacity 0, translateY(12px), scale(.96), blur(2px) over 150ms `cubic-bezier(0.2, 0.8, 0, 1)`; exit 100ms. Disabled primary: bg rgba(0,0,0,.13), white text. A checking primary shows a spinner, grey, disabled.
- Behaviour: Escape closes; clicking the backdrop closes; Enter runs the primary action when it is enabled; focus returns to the opener. The modal opens at its final size, with no jump while the app reports its height. On a phone it fills the screen as a sheet with a pinned footer. A flow can grow the same modal between steps, or navigate to a full page. Flow: see `flow.add-in-modal`.
- Copy: title is a noun phrase or the action ("Delete domain"); the primary names the action.
- Evidence: measured.

### chrome.modal-scroll: keep a long modal inside the viewport

- Intent: read or fill content taller than the modal.
- Use when: content passes the max height. Not when: it fits; do not add an inner scroll.
- Admin: App Bridge modal, seen 2026-11-14.
- Shape: max height 100svh - 60; the content area scrolls while header and footer stay. The modal fills the screen as a sheet on a phone.
- Behaviour: the fade gradient above the footer was not captured, so its values are unknown.
- Evidence: observed.

### chrome.sidebar: move between admin sections

- Intent: learn where I am; open another section or an app.
- Use when: always on desktop; the host draws it. Not when: moving between pages inside the app, see `navigation.*`.
- Admin: admin navigation, seen 2026-11-14.
- Shape: dark frame bg rgb(10,10,10); rail 220 wide, items at x 12, 198 wide. Page panel `#AppFrameMain`: bg #fff, radius 16, inset 4 from the frame top, bottom and right.
  - Item 30 tall, padding 1/4/1/8, radius 12, 450 13/20, text rgb(220). Hover fill ::before 192x29, radius 13, rgba(255,255,255,.06), opacity 150ms. Selected fill rgba(255,255,255,.11) with inset glow and a 1px rgba(0,0,0,.1) ring, text rgb(252) 500.
  - Search is a pill button 220x36 ("Ctrl K"), hover fill .29, text 166 to 220.
  - Section heading is a 24px button, padding 4/3/4/8, radius 8, label 500 12/16 rgb(166), with a chevron. Settings is weight 400.
- Behaviour: the frame stays; the app does not draw it.
- Evidence: measured (rail values, 2026-11-14).

### chrome.sidebar-collapsed: shrink the navigation to icons

- Intent: get more page width; still reach every section.
- Use when: the merchant toggles with the collapse button or Ctrl/Cmd+B. Not when: phone, see `chrome.mobile-frame`.
- Admin: navigation collapsed, seen 2026-11-14.
- Shape: rail 60 wide. Items 32x30 at x 14, icon centred; hover and selected pills 32x29 radius 13 with the same fills. Section headings become a 16x1 separator rgba(255,255,255,.11) above an icon button.
  - Hover flyout (popover): x = rail + 5, top = item top, bg rgb(10,10,10), radius 16, menu padding 4px 8px, gap 2, links 28 high, padding 5px 8px, radius 10, 450 13/18 rgb(238). First link is the section, then its sub-items. The Apps flyout lists the apps with icons.
  - Collapse button 32x30, opacity .7, hover pill rgba(255,255,255,.11). When collapsed the logo becomes the expand button.
- States: width and main margin transition 250ms `cubic-bezier(0.2, 0.8, 0, 1)`; flyout opacity and transform 250ms `cubic-bezier(0.19, 0.91, 0.38, 1)`.
- Behaviour: Ctrl/Cmd+B toggles and is persisted in localStorage; the app frame forwards the key. Tooltips read "Collapse navigation [CTRL][B]" and "Expand navigation [CTRL][B]".
- Copy: the key hint is a `kbd` chip, 500 10/16, padding 2/4, radius 5, bg rgb(47,47,47), text rgb(170).
- Evidence: measured.

### chrome.sidebar-app-entries: show the app's own links in the nav

- Intent: reach the app's pages from the admin navigation.
- Use when: the app registers navigation links. Not when: the page needs tabs inside the page, see `navigation.*`.
- Ask: which pages get a link? [one per top-level page, none for settings sub-pages]; in what order? [most used first]; what does each label say? [the page's noun].
- Admin: Apps section of the navigation, seen 2026-11-14.
- Shape: the app appears as an item under Apps; its links are sub-items. Collapsed, the Apps flyout lists the apps with icons.
- Behaviour: the selected sub-item fill follows the current page. The mock's app sub-nav links rendered underlined in one screenshot (open gap).
- Evidence: observed, https://shopify.dev/docs/apps/launch/built-for-shopify/requirements

### chrome.shortcuts-dialog: look up keyboard shortcuts

- Intent: learn the admin's keys.
- Use when: the merchant presses "?". Not when: the app has its own shortcuts, put them in the page.
- Admin: "Keyboard Shortcuts" modal, seen 2026-11-14.
- Shape: large modal, footer hidden. Four sections in three columns; each navigation list takes a whole column. Key sequences are written with spaces.
- Behaviour: Ctrl/Cmd+K opens the admin search; S, F, O A and the like are the admin's own and the mock ignores them. The mock lists the General section only.
- Evidence: observed.

### chrome.toast-host: confirm a quick result at the page bottom

- Intent: learn that an action finished and need no follow up.
- Use when: the app calls `shopify.toast.show`. Not when: copying (confirm in place, `feedback.copy-confirmation`), a field error, or a result the merchant must read, see `feedback.banner`.
- Admin: bottom-centre dark pill. Not captured in the admin on 2026-11-14.
- Shape: dark pill at the bottom centre of the page, with an optional action and close. Tones exist in the App Bridge protocol.
- States: shown, then leaving (200ms exit in the mock).
- Behaviour: expires after a duration the app sets; the action and close are clickable. Flow: see `flow.add-in-modal`.
- Evidence: docs (toast listed as not captured), https://shopify.dev/docs/apps/design/user-experience/alerts
- Docs differ: toasts display at the top center of the app screen, where this entry has the bottom centre, https://shopify.dev/docs/apps/design/user-experience/alerts.

### chrome.sidekick-bar: offer Sidekick at the page bottom

- Intent: ask Sidekick for help; open the Sidekick panel.
- Use when: the host draws it; apps do not. Not when: the app wants its own helper, put it in the page content.
- Admin: bottom bar of the page panel, seen 2026-11-14.
- Shape: floating, centred on the main column, bar bottom 16 above the viewport. 376x50, radius 28, bg #fff, padding 13. Border ring 1px rgba(0,0,0,.08) and shadow `0 10px 24px rgba(0,0,0,.08)`.
  - Left: character 24x24. Input 13px/20px, placeholder "Work with Sidekick" rgb(117,117,117), rotating with a .5s blur cross-fade.
  - Right: plus and mic buttons 24x24 radius 9999, color rgb(96,96,96); a 1x16 divider rgb(221,221,221); "Open Sidekick" panel button 24x24.
  - Behind it: expandable layer bg rgb(247,247,247), radius 28 28 0 0, height 28 hidden; a "0 tasks running" tab grows above it (12/18 500, height transition .3s).
- States: hover on a button bg rgba(0,0,0,.08), color rgb(10,10,10), .2s; no hover change on the bar. Focus on the input: no ring, no size change; the bar expands only while typing.
- Behaviour: Ctrl/Cmd+"." toggles Sidekick. On a phone the bar is replaced by a floating Sidekick button.
- Evidence: measured.

### chrome.mobile-frame: use the admin on a phone

- Intent: reach navigation and the page on a small screen.
- Use when: the viewport is phone size. Not when: desktop, see `chrome.sidebar`.
- Admin: admin at 390 wide, seen 2026-11-14.
- Shape: two floating buttons replace the rail and the Sidekick bar: Menu opens the navigation drawer, Sidekick opens Sidekick. The save bar covers the title bar. Modals fill the screen as a sheet. A navigation rail shows between 768 and 799.98 wide in the mock.
- Behaviour: the page never scrolls horizontally; content wraps. Phone Settings opens a list of sections, each row a page of its own (16px icon, label, chevron at the far edge, no selection fill), with a round back button above the title.
- Evidence: observed.

### chrome.top-bar: show the logo and search of the frame

- Intent: learn which admin I am in; find anything in the admin.
- Use when: always; host-owned. Not when: the app needs its own search, see `index.*`.
- Admin: the Shopify logo heads the rail; it becomes the expand button when the rail is collapsed. Search is the 220x36 pill. Seen 2026-11-14 (these measured values were taken before the 2026-11-16 crawl). At the measured viewport (1281px wide) the live admin has no top bar: the logo, Search icon, Alerts bell and account avatar sit in the 60px left rail, and page actions sit in each page's header row. Seen 2026-11-16.
- Behaviour: Ctrl/Cmd+K opens the admin search; the mock ignores it.
- Evidence: observed.

### chrome.scroll-areas: scroll the page without losing the frame

- Intent: read content longer than the viewport.
- Use when: any long content. Not when: avoid nested scroll areas.
- Admin: page panel, modals and tables, seen 2026-11-14.
- Shape: the page panel scrolls under a fixed frame. A modal's content scrolls inside it (see `chrome.modal-scroll`). A wide table scrolls inside its own area, never the page.
- Behaviour: the page never scrolls horizontally.
- Evidence: observed.

### chrome.app-window: open a full-viewport workspace

- Intent: do a focused task that needs the whole canvas, such as a complex editor, image editing or a preview.
- Use when: full-viewport use clearly improves the task. Not when: a modal or a normal page fits, see `overlay.modal-vs-inline-vs-page`.
- Admin: Shopify dev docs > App design > App structure > App window (`https://shopify.dev/docs/apps/design/app-structure`), seen 2026-11-16.
- Shape: the app window's top bar shows the primary navigation.
- Behaviour: launch it only after the merchant clicks a button that signals the full canvas. Never launch it, or full-screen, from the app nav (App Store requirement). Do not repeat primary actions in the top bar. Prompt to save unsaved changes on exit and avoid other interruptions.
- Evidence: docs, https://shopify.dev/docs/apps/design/app-structure

### chrome.search-palette: find anything in the admin and jump to it

- Intent: find a record, setting, app or page by name; filter by kind; act without leaving the keyboard.
- Use when: the merchant knows what they want. Not when: they want to filter one list, see `index.filter-popovers`.
- Ask: not applicable, host-owned.
- Admin: the Search icon in the rail, or Ctrl/Cmd+K, seen 2026-11-16.
- Shape: dialog about 710 wide at the top third with a search field and a filter icon at its right; below it quick-filter chips (Apps, Customers, Orders, Products, Sales channels); empty state "Find anything in <store>"; footer "Open" with an Enter key cap. Typing shows facet chips with counts (Apps 712, Reports 39, Settings 37, Navigation 14, Draft orders 2) and grouped results: title plus a help line, each group ending "Show 20 more"; footer actions "Search App Store \"ord\"", "Ask Sidekick" (Ctrl+Enter), "Search in App Store" (Ctrl+Shift+Enter), "Open" (Enter).
- Behaviour: Esc closes; Enter opens the highlighted result; the search input takes focus on open.
- Evidence: observed.

### chrome.alerts-popover: read store and account alerts

- Intent: learn what needs attention; mark alerts read.
- Use when: always; host-owned. Not when: the app needs its own notices, see `feedback.*`.
- Admin: the bell at the foot of the rail, aria-label "Alerts Feed - N unread alerts", seen 2026-11-16.
- Shape: popover beside the rail titled "Alerts" with "View unread only" and "Mark all as read"; empty state "Alerts about your store and account will show here".
- Evidence: observed.

### chrome.account-menu: switch store, get help, log out

- Intent: change store; open help; leave.
- Use when: always; host-owned.
- Admin: the avatar at the foot of the rail, seen 2026-11-16.
- Shape: menu about 277 wide: store list (rows with a "dev" tag for dev stores) with "Create store", the user's name and email, "Help Center", "Log out".
- Evidence: observed.
