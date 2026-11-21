# Polaris web components

How each entry is composed with Shopify's web components (`s-*`, [reference](https://shopify.dev/docs/api/app-home/latest/web-components)). One line per entry id: the composition, then `custom:` what the components cannot do and has to be built. Search this file for the entry id; do not read it whole. An entry with no line has no known composition yet.

## Before swapping a component in

- The hosts are `display: contents`; click the inner shadow element.
- `s-choice-list` renders its options in its shadow root: listen on the list, never on `s-choice`.
- `s-table` takes only `s-link`, `s-internal-link` or `s-checkbox` as row click target and spreads free width over every column.
- No `::part`, no public custom property: styling inside is fragile. The components' tones follow the admin theme, your own tokens do not.

## actions

- `actions.hierarchy`: `s-button` variants `primary`, `secondary`, `tertiary`, `auto`; `s-section` headers; custom: none.
- `actions.button-primary`: `s-button variant="primary"`; custom: none.
- `actions.button-secondary`: `s-button` (default variant); custom: none.
- `actions.button-tertiary`: `s-button variant="tertiary"` with `icon`, `accessibilityLabel`; custom: none.
- `actions.link-action`: `s-button variant="plain"` or `s-link`; custom: none.
- `actions.destructive`: `s-menu` item with `tone="critical"`; custom: none.
- `actions.disclosure-menu`: `s-menu` + `s-button commandFor`; custom: none.
- `actions.split-button`: two `s-button`s in a `s-button-group`; custom: none.
- `actions.button-sizes`: `s-button size`; custom: none.
- `actions.menu-item`: `s-menu` items; custom: none.
- `actions.clickable-row`: Polaris `IndexTable.Row`; custom: none.
- `actions.text-link`: `s-link`; custom: none.
- `actions.chip`: `s-clickable-chip`; custom: none.
- `actions.focus-ring`: `--p-color-border-focus`; custom: none.
- `actions.cursor-rules`: none.
- `actions.tooltip-look`: `s-tooltip`; custom: none.
- `actions.popover-animation`: `s-popover`; custom: none.

## chrome

- `chrome.title-bar`: App Bridge `ui-title-bar` with a breadcrumb link and buttons; custom: none (host draws it). official: one primary action per page, others secondary, labels {verb}+{noun}; page title short with one purpose.
- `chrome.more-actions-menu`: App Bridge title bar secondary actions; custom: none.
- `chrome.save-bar`: `ui-save-bar` element, a `form[data-save-bar]`, or `shopify.saveBar`; custom: none. official: data-save-bar on the form; Built for Shopify 4.1.5 requires the contextual save bar where reasonable, and Save or Discard before leaving.
- `chrome.discard-confirmation`: `ui-save-bar` with `discardconfirmation`; custom: none.
- `chrome.modal`: `ui-modal` with `ui-title-bar` for the title and buttons; custom: none.
- `chrome.modal-scroll`: `ui-modal`; custom: none.
- `chrome.sidebar`: App Bridge `ui-nav-menu`; custom: none.
- `chrome.sidebar-collapsed`: host only; custom: none.
- `chrome.sidebar-app-entries`: App Bridge `ui-nav-menu`; custom: none. official: s-app-nav: short noun items, no emoji, app name points at the app home with no redirect item.
- `chrome.shortcuts-dialog`: host only; custom: none.
- `chrome.toast-host`: `shopify.toast.show(message, { duration, isError, action })`; custom: none. official: toast: three words or fewer, success only.
- `chrome.sidekick-bar`: host only; custom: none.
- `chrome.mobile-frame`: host only; custom: none. App screens use Polaris responsive layout.
- `chrome.top-bar`: host only; custom: none.
- `chrome.scroll-areas`: Polaris `s-table`, `s-modal`; custom: none.
- `chrome.app-window`: App Bridge app window component; custom: none.
- `chrome.search-palette`: host only; custom: none.
- `chrome.alerts-popover`: host only; custom: none.
- `chrome.account-menu`: host only; custom: none.

## copy

- `copy.button-label`: `s-button`, `s-page` `primary-action` and `secondary-actions` slots; custom: none.
- `copy.page-title`: `s-page heading`, `s-section heading` and `subheading`; custom: none.
- `copy.help-text`: `s-text-field details`, `s-section subheading`; custom: none.
- `copy.placeholder`: `placeholder` on `s-text-field`, `s-search-field`; custom: none.
- `copy.error-message`: `error` on the field, `s-banner tone=critical`; custom: none.
- `copy.empty-state-text`: `s-empty-state` with `graphic`, `subheading`, `primary-action`, `secondary-actions`; custom: none.
- `copy.destructive-confirmation`: `s-modal` with a critical `s-button`; custom: none.
- `copy.banner-text`: `s-banner` with `tone`, `heading`, `dismissible`; custom: none.
- `copy.toast-text`: `shopify.toast.show`; custom: none.
- `copy.dates-times`: `Intl.DateTimeFormat`; custom: none.
- `copy.numbers-money`: `Intl.NumberFormat`; custom: none.
- `copy.capitalization`: text only; custom: none.
- `copy.link-text`: `s-link`; custom: none.
- `copy.lists`: `s-unordered-list`, `s-ordered-list`, `s-menu`; custom: none.
- `copy.truncation`: CSS ellipsis, `s-menu`; custom: none.

## data

- `data.metric-tile`: `s-section` link with Polaris text and a small inline SVG sparkline; custom: the sparkline and the dotted heading.
- `data.metrics-strip`: custom, there is no Polaris equivalent; the admin builds it from `s-metrics-bar`. official: metrics card composition: s-section, s-grid, s-clickable href, s-heading, s-text, s-badge trend, s-divider.
- `data.metrics-strip-condensed`: custom; same cells as the full bar.
- `data.metric-definition`: `s-tooltip` on a dotted heading; custom: the dotted underline.
- `data.stat-figure`: `s-section` with heading and text, `s-badge`; custom: none beyond the info icon.
- `data.period-pill`: `s-button` with `s-popover` and a choice list; custom: the calendar grid if a custom range is offered.
- `data.period-radio-menu`: `s-popover` > `s-box` > `s-choice-list` > `s-choice` with a details slot; custom: the trigger cell.
- `data.compare-picker`: `s-button` with `s-popover` and a choice list.
- `data.overview-grid`: `s-grid` with `s-section` cards and the entries below.
- `data.report-page`: `s-page` with a back link, one `s-section` card, the chart and table entries.
- `data.line-chart`: custom SVG (Polaris has no chart; the admin uses Polaris Viz).
- `data.chart-tooltip`: custom.
- `data.breakdown-card`: `s-section` with rows; custom: the bar and logo row.
- `data.donut`: custom SVG.
- `data.period-table`: `s-table` in the report card; custom: the two-line comparison block.
- `data.report-table`: see the `index` family.
- `data.chart-empty`: Polaris text inside the card.
- `data.experiment-results`: `s-grid` of `s-section`, a custom grid for the metric rows, `s-badge`; custom: trend chip and variant rows.
- `data.attribution-controls`: Polaris Select/Popover list with descriptions.
- `data.live-metrics`: Polaris Card grid.

## detail

- `detail.page-frame`: `s-page` with the `aside` slot; main sections as `s-section` with a card; aside as plain sections. Custom: none. official: details template: s-page, s-section (heading, subheading, accessory, supplemental, actions), aside sections as sidebar, breadcrumb back, footer help.
- `detail.title-block`: `s-heading` large in a stack with `s-badge`, then a subdued `s-text`. Custom: none.
- `detail.main-section`: `s-section` with a heading and a card. Custom: a flush table card (no padding) under a heading.
- `detail.aside-section`: stacked plain sections split by `s-divider`. Custom: a helper that takes a list of titled sections.
- `detail.facts-list`: `s-text` lines under a heading, `s-chip` for chips. Custom: fact helpers.
- `detail.summary-values`: aside section plus `s-text`; tooltip on the label. Custom: metric panels when several values share one card.
- `detail.copyable-value`: `s-button` with the copy icon and a tooltip. Custom: the copied state (Polaris has none).
- `detail.timeline`: heading plus stacked rows. Custom: marker, dot and track.
- `detail.payment-rows`: rows in a card. Custom: none.
- `detail.banner-in-body`: `s-banner` with a tone and an action slot. Custom: none. Other tones are in `refs/chrome/notes.md`.
- `detail.title-actions`: App Bridge title bar secondary actions. Custom: none; the host draws the bar.
- `detail.more-actions`: App Bridge actions menu. Custom: none.
- `detail.back`: App Bridge title bar back link. Custom: none. official: back button to the parent page on every sub-page (Built for Shopify 4.1.1).
- `detail.readonly`: as `detail.page-frame`. Custom: none.
- `detail.editable`: as `form.create-page`. Custom: none. official: details template: form fields in sections, data-save-bar on the form, s-modal to confirm destructive actions.
- `detail.rule-state`: aside section plus `s-link`. Custom: none.
- `detail.variant-table`: `Card`, `IndexTable` with `TextField` cells; custom: inline editable cells.
- `detail.status-card-header`: heading with icon, `s-button` group, `s-menu`. Custom: the icon tile.
- `detail.line-item-row`: row with `s-thumbnail`, text, `s-badge` or chip for quantity. Custom: none.
- `detail.aside-edit-affordance`: `s-section` heading with `s-icon-button`. Custom: none.
- `detail.payment-link-rows`: rows with `s-link` buttons in a card. Custom: none.
- `detail.read-only-recovery`: banner `success` with a code box. Custom: none.
- `detail.stat-strip`: grid of `s-stack` columns with `s-tooltip` or popover. Custom: none. See `data.metric-definition`.
- `detail.last-record-card`: titled section with actions, card. Custom: none.
- `detail.destructive-in-more-actions`: `s-menu` with groups. Custom: none. See `detail.more-actions`.
- `detail.timeline-comment-composer`: avatar, text area and icon buttons from Polaris in one custom card; custom: the two-part card and the editor. Drop the icon buttons whose feature we do not have, keep the avatar and the footer.
- `detail.timeline-comment`: avatar, text and a menu button in a card; custom: the card inside the timeline.
- `detail.media-file-editor`: custom full-page layout; Polaris fields inside dark cards.

## feedback

- `feedback.banner`: `s-banner` with `tone` and `heading`, optional `dismissible`; custom: none. official: s-banner: info is dismissible and low priority, success only for delayed or persistent feedback, warning sparingly, critical with troubleshooting; one banner visible at a time on the homepage.
- `feedback.toast-when`: `shopify.toast.show`; custom: none. official: toast for short non-critical success only, three words or fewer, no errors except persistent ones; shopify.toast.show.
- `feedback.copy-confirmation`: `s-button` icon with a copied state; custom: Polaris has no copied state, so swap the icon.
- `feedback.tooltip`: Polaris `s-tooltip` through `interestFor`; custom: dark theme wrapper for the dark look.
- `feedback.badge`: `s-badge` with `tone`; custom: none. official: s-badge: tone follows the status (green positive, yellow paused or incomplete, orange in progress, red blocked or error); one severity signal per row; categories use a neutral chip.
- `feedback.field-error`: `s-text-field` `error`; custom: Polaris draws the error only inside its own fields, so a custom field needs the same line. official: inline error directly under the field, red, shown after focus leaves the field; focus moves to the message and the input references it with aria-describedby.
- `feedback.help-text`: `s-text-field` `details`; custom: none.
- `feedback.screen-reader-text`: `aria-label` on the control; custom: a visually hidden span when text must be announced. official: accessibilityLabel on icon-only buttons and on sections without a visible heading.
- `feedback.loading`: `s-spinner`, `s-button` `loading`; custom: none. official: no flicker, repeated load in and out or large shift (Built for Shopify 4.1.1); CLS 0.1 or less, LCP 2.5 s or less, INP 200 ms or less (2.1).
- `feedback.progress`: `s-icon`, `s-stack`; custom: none.
- `feedback.not-found`: `s-grid` or `s-stack` with an illustration and text; custom: none.
- `feedback.empty-state`: Polaris empty state composition; custom: none. official: s-empty-state with graphic, subheading, primary-action and secondary-actions slots.
- `feedback.no-results`: `s-stack` with illustration and text; custom: none.
- `feedback.empty-value`: text with subdued tone; custom: none.
- `feedback.no-hover-shift`: Polaris components; custom: use outline or overlay, never size.
- `feedback.status-colors`: `s-badge tone`, `s-banner tone`; custom: none.

## fields

- `fields.anatomy`: `s-text-field`, `s-number-field`, `s-money-field`, `s-select`; custom: none.
- `fields.text`: `s-text-field` with `details`; custom: none.
- `fields.textarea`: `s-text-area`; custom: none.
- `fields.number-suffix`: `s-number-field` with `suffix`; custom: none.
- `fields.money`: `s-money-field`; custom: none.
- `fields.select`: `s-select` with `details`; custom: none.
- `fields.choice-list`: `s-choice-list` with `s-choice`; custom: none.
- `fields.checkbox-details`: `s-checkbox` with `details`, or `s-choice-list multiple`; custom: none.
- `fields.checkbox-dependent`: field nested in the choice's content; custom: none.
- `fields.switch`: `s-switch`; custom: none.
- `fields.search`: `s-search-field` with `s-clickable-chip` for picks; custom: none.
- `fields.focus`: Polaris draws it; custom fields reproduce it.
- `fields.keyboard-focus`: Polaris draws it; custom: none.
- `fields.error`: `error` property on the Polaris field; custom: a custom field needs the same line.
- `fields.help-text`: `details` property; custom: none.
- `fields.help-tooltip`: `s-tooltip` on an icon activator; custom: the text is drawn from an attribute so a phone table does not read it as a heading.
- `fields.width`: `s-grid` columns; custom: none.
- `fields.customer-combobox`: `s-search-field` or combobox with popover. Custom: the create row.
- `fields.type-picker`: Polaris Popover with a search field and a grouped list; custom: group headings.
- `fields.link-picker`: Polaris Autocomplete or Combobox; custom: grouped results.
- `fields.code-editor`: `s-text-field` for the subject; custom: a code editor (CodeMirror in the admin).
- `fields.type-picker-categorized`: `s-select` with `s-option-group`, or a custom popover listbox; custom: group headers if the select cannot.

## flow

- `flow.create-from-unsaved-page`: Page with a title bar, Banner tone critical, field error, Toast, save bar (`chrome.save-bar`).
- `flow.edit-with-unsaved-guard`: save bar with leave guard (`chrome.save-bar`).
- `flow.change-status-with-confirm`: menu action, confirm modal with a primary (not critical) button, Toast.
- `flow.duplicate-record`: title bar secondary action, create page prefilled.
- `flow.delete-record-with-confirm`: critical confirm modal (`overlay.confirm-destructive`).
- `flow.bulk-action-on-index`: IndexTable bulk actions, confirm modal.
- `flow.product-draft-lifecycle`: create page, status select in the side column.
- `flow.return-to-list`: keep list state in the URL (`index.url-state`).

## form

- `form.create-page`: `s-page` with cards in `s-section`s and an aside. Custom: none.
- `form.type-first-modal`: App Bridge modal (host-owned frame) opened from the primary button with `commandfor`. Custom: none.
- `form.summary-aside`: plain aside sections. Custom: none.
- `form.save-bar`: App Bridge save bar; the app only reports dirty state. Custom: none.
  . official: data-save-bar on the form; Built for Shopify 4.1.5 requires the contextual save bar where reasonable.
- `form.validation-banner`: `s-banner` critical with a list. Custom: none.
- `form.field-error`: Polaris `error` property. Custom: a line for custom fields (tag picker, pickers) that Polaris does not draw.
- `form.error-timing`: validate on Save in the update function; never on open. Custom: none.
  . official: show the error after keyboard focus leaves the field, not while typing.
- `form.field-layout`: stacks of `s-text-field` and friends with `gap`. Custom: none.
- `form.schedule`: `s-button` activators with a popover, `s-date-picker`, text field and combobox. Custom: the row and the time list.
- `form.reveal-by-checkbox`: `s-checkbox` plus a conditional `s-number-field`. Custom: none.
- `form.choice-with-help`: `s-select` with a computed `details`. Custom: none.
- `form.choice-list-details`: `s-choice-list` with `details`; `multiple` for checkboxes. Custom: a wrapper for the recommended label and follow-up fields.
- `form.method-toggle`: `s-button-group` segmented. Custom: none.
- `form.code-generator`: label slot plus an `s-link`. Custom: none.
- `form.resource-picker`: `s-text-field` plus `s-button`; App Bridge resource picker. Custom: none.
- `form.eligibility-card`: `s-section` card with `s-choice-list`. Custom: none.
- `form.tags`: combobox with `s-chip` removable. Custom: tag picker with suggestions and keyboard.
- `form.preview`: a bordered container with a heading. Custom: the window frame.
- `form.chip-reveal-fields`: Polaris `Card` with `TextField`s and a footer of toggle `Button`s; custom: pressed pill chip.
- `form.inventory-by-location`: `Card`, `Switch`, rows of `TextField type=number`; custom: none.
- `form.organization-card`: `Select`, `Combobox` with `Tag`s; custom: none.
- `form.media-dropzone`: Polaris `DropZone`; custom: none.
- `form.rich-text`: custom editor; Polaris has none.
- `form.line-item-editor`: `Card`, `Combobox`, `IndexTable`; custom: totals card.
- `form.collection-builder`: custom.
- `form.task-page`: page layout with aside, `s-button` primary. Custom: none. See `form.summary-aside`.
- `form.line-item-stepper`: `s-number-field` with suffix. Custom: the "/ max" suffix.
- `form.query-editor`: custom code editor in a card. Custom: editor, autocomplete, templates panel (not opened).
- `form.draggable-field-list`: Polaris Card with rows; custom: drag handle and sortable list.
- `form.tree-list-editor`: Polaris Card, rows; custom: sortable tree.
- `form.content-editor-page`: Polaris Layout with two columns; custom: rich text.
- `form.visibility-with-date`: Polaris ChoiceList, DatePicker field, TextField; custom: icon toggle.
- `form.seo-listing-editor`: Polaris Card, TextField with character count.
- `form.excerpt-card`: Polaris Card with an edit icon button.
- `form.key-from-name`: `s-text-field` with a help `details`; custom: none.
- `form.repeatable-row-with-options`: `s-section`, `s-text-field`, `s-checkbox`, `s-select`, `s-button`; custom: drag-sort rows.

## index

- `index.page-frame`: App Bridge title bar and actions; `s-section` for the filter bar; `s-table` for the rows; custom: the toolbar, bulk bar and pagination pill below. official: resource index template: s-page, s-section, s-empty-state or s-table, s-badge, footer help; metrics card recommended.
- `index.view-menu`: `s-popover` with a menu of radio rows; custom: the pill activator.
- `index.search-and-filter`: custom; Polaris has no token field. Keep the textbox, tokens and popovers as one unit.
- `index.filter-tokens`: custom; see `index.filter-popovers` for what opens from a token.
- `index.filter-popovers`: `s-popover` with choice rows; custom: caret anchoring and the Enter hint.
- `index.display-options`: `s-popover` with `s-button` trigger; custom: the drag-sortable column rows.
- `index.sortable-heading`: `s-table` header with a button; custom: the arrow with reserved space.
- `index.table-rows`: `s-table` with a clickable row; custom: row click handling. official: index table composition: s-table, s-table-row clickDelegate, s-table-header listSlot, s-checkbox, s-badge; no primary buttons in tables, one severity signal per row, row actions in the last cell.
- `index.secondary-line`: two `s-text` lines in the title cell.
- `index.source-badges`: custom, composed from `s-badge`-like pills and `s-thumbnail`.
- `index.bulk-bar`: `s-table` selection; custom: the bar over the header. official: index table composition: no bulk slot, so the selected count and bulk buttons replace search and sort in the s-grid slot=filters; destructive bulk actions confirmed in s-modal.
- `index.pagination`: two `s-button` icon buttons in a pill; custom: the floating pill. official: index table composition: paginate, hasPreviousPage, hasNextPage, onPreviousPage, onNextPage (previous and next buttons only, no count).
- `index.metrics-strip`: `s-metrics-bar` (the admin's own); custom: a flat column version. official: metrics card composition: s-section, s-grid, s-clickable href, s-heading, s-text, s-badge trend, s-divider.
- `index.no-results`: centred `s-stack` in the table slot; custom: the empty block.
- `index.empty-first-run`: custom empty page in the table slot (it replaces the table). official: s-empty-state with graphic, subheading, primary-action and secondary-actions slots; buttons invoke intents; shown only when no record exists.
- `index.url-state`: route model with a query codec per page.
- `index.resource-list`: `s-section`, `s-text-field`, `s-popover`, `s-clickable-chip`, `s-checkbox`, `s-select`, `s-clickable`, `s-avatar`, `s-thumbnail`, `s-icon`, `s-modal`; custom: none.
- `index.thumbnail-title-cell`: `IndexTable` with `Thumbnail` and `Badge`; custom: none.
- `index.live-theme-card`: custom card with image and overlay; Polaris `s-button`.
- `index.file-library`: Polaris IndexTable with thumbnail cell, view bar; custom: drag-over overlay.
- `index.graph-view-toggle`: Polaris IndexTable with tabs; custom: graph.
- `index.report-library`: Polaris IndexTable.
- `index.settings-table-header-help`: `s-table` with tooltips on headers; custom: none.

## navigation

- `navigation.back-link`: App Bridge title bar; the host draws the circle and the breadcrumb. official: breadcrumbs or a Back button on every sub-page (Built for Shopify 4.1.1).
- `navigation.prev-next`: App Bridge title bar pagination (the host draws it).
- `navigation.app-nav`: App Bridge navigation links; the app never draws them. official: s-app-nav (required for primary navigation by Built for Shopify 4.1.4); items nouns, seven and above under View more, sub-pages highlight the parent.
- `navigation.settings-sidebar`: `s-section` and links in a column; custom: the nav panel, the divider and the phone behaviour.
- `navigation.settings-link-list`: `s-section` with `s-clickable` rows and dividers; custom: the full-width hover. official: interstitial nav composition: s-section padding=none, s-box padding=small-400, s-clickable rows with s-grid, s-heading, s-paragraph, s-icon chevron-right, s-divider in an s-box paddingInline=small-100.
- `navigation.views-vs-tabs`: official: tabs only sparingly when app nav is not enough; a tab click changes only content below it, tabs never wrap or move; custom: none.
- `navigation.url-state`: one route model, one codec in and out.
- `navigation.push-vs-replace`: the router's push or replace; custom: none.
- `navigation.scroll-reset`: one command on every route change.
- `navigation.external-link`: App Bridge link with the target; `s-link` in the page.
- `navigation.app-launcher-list`: `s-section` with padding none and clickable rows; custom: none.

## onboarding

- `onboarding.home-page`: `s-page` with an empty heading, centred `s-stack`, the entries below. official: homepage template: s-page with primary-action and secondary-actions slots, one s-section per card (heading, subheading, supplemental, secondary-actions), s-banner (one visible at a time), s-divider rows; compositions setup guide, callout card, media card, footer help.
- `onboarding.setup-guide`: `s-section` with `s-heading`, `s-progress`, a list of `s-clickable` rows; custom: the one-open-at-a-time accordion. official: setup guide composition: s-section, s-grid, s-heading, s-paragraph, s-checkbox per step, s-button, s-box, s-divider, s-image; step actions use href, a toast shows when a step completes.
- `onboarding.setup-step-media`: modal (see `chrome`), `video` with poster inside a media panel.
- `onboarding.home-feed-card`: `s-section` or `s-clickable` card with `s-box` media; custom: the inset media panel. official: callout card (s-section, s-grid, s-heading, s-paragraph, s-button, s-box, s-image, dismiss s-button with accessibilityLabel) or media card (s-box border, s-clickable, s-image, s-divider, s-heading, s-button).
- `onboarding.call-to-book`: as the feed card.
- `onboarding.contact-row`: `s-text` with `s-link`. official: support CTA placed in an app nav item, a page footer link or a floating action button, consistently and unobtrusively.
- `onboarding.learning-index`: `s-grid` of feed cards; custom: the inset media panel.
- `onboarding.guide-page`: `s-page` with a main column and `s-aside`-style sections; custom: the scene media and sticky aside.
- `onboarding.guide-media`: coded animation in a media panel.
- `onboarding.setup-modal-flow`: modal frame is host-owned (see `chrome`); content with `s-text-field`, `s-choice-list`, `s-banner`.
- `onboarding.setup-offer-choice`: `s-banner` info, `s-section` cards with `s-badge` and `s-button`.
- `onboarding.dns-steps-card`: `s-page` with back, `s-section` with a list of steps, `s-table`, `s-badge`.
- `onboarding.records-to-copy`: `s-table` with `s-clickable` icon buttons.
- `onboarding.numbered-steps`: `s-ordered-list` or text rows.
- `onboarding.illustrated-action-card`: `s-section` with media and `s-button`s.
- `onboarding.info-strip`: `s-icon`, `s-text` with `s-tooltip`.
- `onboarding.reference-links`: `s-grid` of `s-clickable` cards with an icon.
- `onboarding.plan-picker`: `s-page` with `s-section` cards; custom: the discrete slider.
- `onboarding.interval-toggle`: Polaris `s-press-button` group; custom: a controlled version for a model-driven value.
- `onboarding.plan-summary`: `s-section` with a list.
- `onboarding.plan-comparison`: `s-table` with `s-icon`.
- `onboarding.upgrade-prompt`: `s-banner` plus a secondary action.
- `onboarding.connect-account`: `s-button` with an external link. official: account connection composition: s-section, s-stack, s-grid, s-heading, s-text, s-button, s-modal with s-banner for disconnect; toast after connect.
- `onboarding.callout-card`: `s-section`, `s-grid`, `s-stack`, `s-heading`, `s-paragraph`, `s-button`, `s-box`, `s-image`; custom: none.
- `onboarding.app-card`: `s-clickable`, `s-grid`, `s-thumbnail`, `s-box`, `s-heading`, `s-paragraph`, `s-stack`, `s-button`; custom: none.
- `onboarding.media-card`: `s-grid`, `s-box`, `s-clickable`, `s-image`, `s-divider`, `s-heading`, `s-button`, `s-modal`; custom: none.
- `onboarding.promotion`: dismissible `s-section` or `s-banner`; custom: none.
- `onboarding.first-use-hero-with-templates`: `s-page` with an empty-state block and an `s-button` pair; custom: illustration asset.
- `onboarding.news-cards`: `s-section` cards in a two-column grid; custom: none.
- `onboarding.recommended-card`: `s-section` with a media panel and `s-button`; custom: preview media.
- `onboarding.blocked-feature-page`: Polaris Banner above sections.
- `onboarding.feature-hero-banner`: Polaris Card or Banner with actions.
- `onboarding.eligibility-offer`: Polaris Card, custom illustration.

## overlay

- `overlay.modal-vs-inline-vs-page`: `ui-modal` for the short task; a page route for the long one; custom: none.
- `overlay.modal-edit`: `ui-modal`, `s-text-field`, `s-button`; custom: none.
- `overlay.confirm-destructive`: `ui-modal` with a destructive primary button; custom: none. official: s-modal confirming a destructive action (delete, disconnect, reset) with a critical primary and Cancel; Modal API.
- `overlay.actions-popover`: `s-popover` or `s-menu` with `s-button` items; custom: none.
- `overlay.row-menu`: `s-button` with an icon and `s-popover`; custom: none.
- `overlay.picker-modal`: `shopify.resourcePicker({ type })`; custom: none. official: resource list composition in a modal: s-text-field search, s-checkbox rows, Resource Picker API for products.
- `overlay.view-all-modal`: `ui-modal` with a list; custom: none.
- `overlay.popover-placement`: `s-popover` with its trigger; custom: none.
- `overlay.manage-publishing`: Polaris `Modal` with a two-column body and `Switch`; custom: left rail.
- `overlay.full-frame-edit-modal`: host modal with page-style body (see `chrome.modal`). Custom: summary aside.
- `overlay.product-picker-search`: `s-modal` with search field and checkbox tree. Custom: the tree and count.
- `overlay.custom-item-modal`: `s-modal` with fields. Custom: none.
- `overlay.import-file`: `s-modal` with `s-drop-zone`; custom: none.
- `overlay.create-by-name-modal`: `s-modal`, `s-banner`, `s-text-field` with `maxLength`; custom: none.
- `overlay.policy-editor-modal`: `s-modal`, `s-switch`; custom: rich-text editor.

## settings

- `settings.page-frame`: `s-page` with `s-section` per group; custom: the left list and column are the app shell. official: settings template: one s-section per group (heading, subheading), data-save-bar form, modal for destructive resets, toast on save; compositions account connection, footer help, interstitial nav.
- `settings.group-heading`: `s-section heading=...`; custom: none.
- `settings.summary-row`: `s-section padding=none` with `s-clickable` rows in `s-stack`; custom: none.
- `settings.select-card`: `s-select` with `details`; custom: none.
- `settings.switch-row`: `s-switch` in a row; custom: none.
- `settings.threshold-fields`: `s-grid` of `s-number-field` and `s-money-field`; custom: none.
- `settings.recipients-list`: `s-button` in the heading slot, `s-modal`; custom: none.
- `settings.connected-account-row`: `s-badge tone=success`, `s-button variant=tertiary icon=menu-horizontal` with `s-menu`; custom: none. official: account connection composition: s-section, s-grid, s-heading, s-text, s-button (critical tone to disconnect), s-modal with s-banner; terms text under the row; toast after connect or disconnect.
- `settings.app-list`: `s-section padding=none`, `s-thumbnail`, `s-menu`; custom: none.
- `settings.logo-collection`: `s-section` row + `s-modal`; custom: the logo grid inside the modal.
- `settings.plan-and-usage`: `s-section`, `s-heading`, `s-badge`, `s-progress-bar` if available; custom: the usage bar otherwise.
- `settings.fixed-view-tabs`: Polaris tabs composition; custom: none known.
- `settings.footer-note`: `s-text` with `s-link`; custom: none. official: footer help composition: s-stack alignItems=center, s-text, s-link.
- `settings.coming-soon-item`: `s-button` in the row; custom: none.
- `settings.edit-inline-or-modal`: as above; custom: none.
- `settings.save-model`: App Bridge save bar; custom: none.
- `settings.switch-with-dependent-fields`: `s-section`, `s-switch`, `s-banner`, `s-text-field` with a max length counter; custom: inset panel.
- `settings.option-switch-card`: Polaris Card with rows and switches.
- `settings.inherited-overrides`: Polaris Card sections and rows; custom: inheritance rows.
- `settings.autonomy-radios`: Polaris ChoiceList with descriptions.
- `settings.template-list-grouped`: `s-section` heading plus `s-clickable` rows; custom: none.
- `settings.notification-hub-rows`: `s-section`, `s-text-field`, `s-clickable` rows; custom: none.
- `settings.signing-secret-card`: `s-section`, `s-button`, `s-checkbox`, a modal; custom: none.
- `settings.installed-apps-table`: `s-table`, `s-menu`; custom: none.
- `settings.app-access-detail`: `s-section`, `s-table`, `s-icon`; custom: none.
- `settings.legacy-feature-notice`: `s-section`, `s-banner` or text, `s-button`; custom: none.
- `settings.domain-list`: `s-table`, `s-badge`; custom: none.
- `settings.language-list-with-app-promo`: `s-table`, `s-badge`; custom: none.
- `settings.policy-list-with-status`: `s-section`, `s-badge`, `s-clickable`; custom: none.
- `settings.recommendation-rows-with-automation`: `s-section`, `s-badge`, `s-button`; custom: none.
- `settings.resource-count-list`: `s-section`, `s-table`; custom: none.
