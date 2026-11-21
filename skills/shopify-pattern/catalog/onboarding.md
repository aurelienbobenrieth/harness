# Onboarding

The merchant wants to get started, learn how something works, connect an outside account, or move to a better plan.

### onboarding.home-page: land on the app's home and know what to do next

- Intent: learn where the store stands and what comes next; do start the next task.
- Use when: the screen is the app's landing page. Not when: the merchant wants numbers and trends, see `data.overview-grid`. The landing page can lead with several first-use shapes: required steps to track, see `onboarding.setup-guide`; one announcement, see `onboarding.callout-card`; one suggestion with a picture, see `onboarding.home-feed-card`; a booked call, see `onboarding.call-to-book`; a quiet help line, see `onboarding.contact-row`; a promotion, see `onboarding.promotion`; an empty list, see `feedback.empty-state`.
- Ask: what does the page lead with? [one next action]; first-use shape: setup guide, callout card or empty state? [setup guide when steps must be done before the app works]; numbers on the home page? [no, they belong to analytics]; a help line? [yes, at the page bottom]; a feed of suggestions? [one card].
- Admin: Home (`/`), seen 2026-11-14. In 2026 it is Sidekick-first: a store preview card, a centred H1, a prompt box, one suggestion pill, then a "Home feed". No dashboard metric cards and no setup guide card any more (metric cards moved to Analytics). Also: "Questions? <phone>" at the top right.
- Shape: main column x 355 to 1291 (936 wide at 1440), bg #fff. Store preview button 320x183 at y 98 with a "Private" chip 73x28. "Launch your online store" pill 320x28. H1 28px/33.6px 500, letter-spacing -0.7px, centred, max 600 wide, 3 lines. 32 from the H1 to the prompt box (592x60, 13/20). Suggestion pill 138x36 ("Fulfill orders 44"): padding 6 6 6 12, radius 999px, bg #fff, label 13px 550, count chip 33x24. 72 from the pill to the feed.
- States: a failure shows a critical banner (radius 20). Empty, error and loading were not shown by the store; the feed simply has fewer cards.
- Behaviour: the title bar shows the app alone (icon plus app name in App Bridge); the page has no h1 of its own besides the greeting. The greeting carries one colour, with its trailing "!" in every locale.
- Copy: "Good evening!" style greeting; French keeps the "!" ("Bonsoir !").
- Evidence: measured, https://shopify.dev/docs/api/app-home/latest/patterns/templates/homepage, https://shopify.dev/docs/apps/design/user-experience/app-home-page
- Docs differ: the template is a column of section cards with no greeting or prompt box, https://shopify.dev/docs/api/app-home/latest/patterns/templates/homepage.

### onboarding.setup-guide: finish required setup in steps

- Intent: learn which setup steps remain and how far along the merchant is; do open a step and act.
- Use when: a few ordered steps must be done before the app works. Not when: the merchant needs one task in a focused modal, see `onboarding.setup-modal-flow`; or only a tip, see `onboarding.info-strip`; one announcement or first action without progress, see `onboarding.callout-card`; one suggestion with a picture, see `onboarding.home-feed-card`; steps on an outside account with records to copy, see `onboarding.dns-steps-card`; an offer, see `onboarding.promotion`; nothing is required yet, see `feedback.empty-state`.
- Ask: which steps, in what order? ; what does each step's action do? [opens a link or the feature]; may the merchant dismiss the guide? [yes, once all steps are done]; how is progress worded? ["1 of 3"]; does completing a step show a toast? [yes].
- Admin: none today. Home had a setup guide card in earlier admins, but none renders on the 2026-11-14 store. Nearest: the domain verification step list (`onboarding.dns-steps-card`). Admin: none, the Shopify app setup-guide pattern stays; none; checked Flow, Checkout Blocks, Messaging on 2026-11-16 (no setup guide, progress or dismiss; they use a hero empty state, `onboarding.first-use-hero-with-templates`, or recommended cards, `onboarding.recommended-card`).
- Shape: a card (radius 20, card shadow `rgba(0,0,0,.24) 0 0 2px 0, rgba(0,0,0,.02) 0 2px 12px 0, ...`). Header: title, progress, a collapse control and a dismiss control. Steps open one at a time. Step row follows the verification list: 16px status icon (dashed circle pending, check done), title 13/20, pending titles rgb(166,166,166), active icon rgb(16,16,16), steps 32 apart when collapsed.
- States: expanded (one step open, body indented under the title), collapsed (header only), all steps done (the guide closes), step info icon hidden when the step's extension is already live.
- Behaviour: opening a step closes the others; re-clicking the open step does nothing (by design). Collapse, expand and dismiss work.
- Copy: steps start with a verb ("Enable checkout extension", "Set up Coupon protection"); progress "1 of 3".
- Evidence: observed, https://shopify.dev/docs/api/app-home/latest/patterns/compositions/setup-guide
- Docs differ: the guide shows a checkbox, heading, description, illustration and action per step, progress reads "0 out of 3 steps completed", and a toast follows each completed step, https://shopify.dev/docs/api/app-home/latest/patterns/compositions/setup-guide.

### onboarding.setup-step-media: show how to do a step with a short video

- Intent: learn how to perform a step; do watch, then go and do it.
- Use when: a setup step needs a visual walk-through in another admin screen. Not when: the step is a form, see `onboarding.setup-modal-flow`; a looping picture without controls, see `onboarding.guide-media`.
- Ask: which steps get a video? ; how long is it? [a short loop]; what does the poster show? [the first frame].
- Admin: none found for step media. The nearest shapes are the Home feed card media panel (`onboarding.home-feed-card`) and the verification hero strip (`onboarding.illustrated-action-card`). The admin has no video, poster or player controls on any visited surface; images are static SVG or PNG.
- Shape: a modal opened from the step, with the video framed as a media panel (light grey, radius 12) above the instructions. Controls only if the clip is longer than a loop.
- States: poster until play.
- Behaviour: opens from the step's action; Escape closes and focus returns to the opener.
- Copy: "Enable checkout extension", "Enable theme extension".
- Evidence: observed.

### onboarding.home-feed-card: offer one next action with a picture

- Intent: learn about one suggestion; do act on it in one click.
- Use when: a suggestion or a guide deserves a picture, a title, one line and one or two pill actions. Not when: it must show progress, see `onboarding.setup-guide`; one message that should stand out on the page, see `onboarding.callout-card`; the picture is a previewed item with its own actions, see `onboarding.media-card`; a card with art in an action row of a setup, see `onboarding.illustrated-action-card`.
- Ask: what is the one suggestion? ; what does the action do? [one click to the feature]; may it be dismissed? [yes]; how many cards in the feed? [one].
- Admin: Home > "Home feed" (`ul[aria-label="Home feed"]`), seen 2026-11-14. Also: used as the model for guide cards (`onboarding.learning-index`).
- Shape: card 300x344, radius 20, bg #fff, shadow `rgba(0,0,0,.24) 0 0 2px 0, rgba(0,0,0,.02) 0 2px 12px 0, rgba(0,0,0,.02) 0 4px 16px 0, ...`, gap 16 between cards, inner padding 7. Media panel 286x140 (about 2.04:1), radius 12, bg rgb(245,246,247), an illustration made of UI fragments (a pill with shadow `rgba(0,0,0,.14) 2px 3px 5px 0, rgba(0,0,0,.08) 1px 1px 2px 0`), not a photo. Text block padding 12 12 0, gap 6. Title h3 15px/18.75px 500, padding 4 0 0 4. Body 13px/17.875px rgb(112,112,112). Media bottom to title 8, title to body 5. Action row padding 0 12 12, gap 12; secondary pill buttons 28 high, 12/16 500, padding 6 12, radius 9999px. Dismiss: 24x24 icon button, 16 from the top and right, icon 20px.
- States: hover is the surface hover (no lift). Card transition: `height .35s cubic-bezier(.34,1.8,.64,1), transform .42s cubic-bezier(.2,.8,0,1)`.
- Behaviour: the whole card is `role=button` with a pointer cursor; the action buttons keep their own clicks. Dismiss hides the card.
- Copy: short title, one subdued sentence, a verb on the button.
- Evidence: measured, https://shopify.dev/docs/api/app-home/latest/patterns/compositions/callout-card, https://shopify.dev/docs/api/app-home/latest/patterns/compositions/media-card

### onboarding.call-to-book: offer a call with a person

- Intent: learn that help is available; do book a call.
- Use when: the app offers live onboarding help from its landing page. Not when: the merchant just needs a way to ask a question, see `onboarding.contact-row`.
- Ask: who takes the call and how is a slot booked? ; what does the button open? [a booking modal]; may it be dismissed? [yes, once booked].
- Admin: none for booking. Use the Home feed card (`onboarding.home-feed-card`) with its pill actions.
- Shape: one feed card (300x344, media 286x140 radius 12, title 15/18.75 500, body 13/17.875 subdued, secondary pills) placed in a `ul[aria-label="Home feed"]`, 72 below the guide.
- States: none captured.
- Behaviour: media and text open the booking modal; Escape closes and focus returns to the opener.
- Copy: a verb on the button ("Book a call").
- Evidence: observed.

### onboarding.contact-row: let the merchant ask a question in place

- Intent: learn where to ask; do reach support.
- Use when: a quiet help line belongs on the page. Not when: a booked call is offered, see `onboarding.call-to-book`; the pointer ends a settings section, see `settings.footer-note`.
- Ask: which contact does it show? [email or phone]; on which pages? [the landing page].
- Admin: Home top right "Questions? <phone>", seen 2026-11-14.
- Shape: one line, 12px/18px, rgb(74,74,74), the contact as an underlined 600 dark link (neutral, not blue).
- States: none.
- Behaviour: the link opens the mail client or the phone, so a sweep shows no in-page effect.
- Copy: "Questions? <contact>" and French "Des questions ?".
- Evidence: observed, https://shopify.dev/docs/apps/design/user-experience/app-home-page

### onboarding.learning-index: pick a guide from a library

- Intent: learn which guides exist and how long each takes; do open one.
- Use when: several guides each deserve a picture and a short pitch. Not when: reading one guide, see `onboarding.guide-page`; a handful of outside links, see `onboarding.reference-links`; comparing options row by row, see `onboarding.plan-comparison`.
- Ask: which guides exist and in what order? ; what does a card's meta line say? [reading time]; is the first guide featured? [yes]; a secondary action in the title bar? [none].
- Admin: none dedicated. In 2026 help goes through Sidekick and no in-admin learning panel was found. The Home feed card is the nearest (`onboarding.home-feed-card`).
- Shape: an h1 26/32 500 with a subdued 13/20 subtitle (lead plus guide count). A group heading 15/22 500 ("Feature guides"). A grid of feed cards (padding 7, media radius 12 rgb(245,246,247), h3 15/18.75 500, body 13/17.875 rgb(112,112,112), a 12/16 subdued meta line at the bottom). Cards carry no "Guide 1" index; order stays. A featured card for the first guide: white card radius 20 with the feed shadow, media panel on the left, an info badge, title 20/28 500, body 13/20, a primary pill; no gradient, no lift.
- States: hover is the admin surface hover; keyboard focus ring fully visible at 2x.
- Behaviour: the whole card is clickable. A secondary action ("Compare apps") sits in the title bar, not floating in the page.
- Copy: "<App name> resources" style h1; counts in the subtitle ("6 guides"), not in an eyebrow.
- Evidence: measured.

### onboarding.guide-page: read one guide step by step

- Intent: learn how a feature works, one step at a time; do jump to a step, go to the next guide or open the feature.
- Use when: a guide has several steps each with a picture. Not when: the steps are actions on a connected account, see `onboarding.dns-steps-card`; a short list of instructions in a card, see `onboarding.numbered-steps`.
- Ask: how many steps and what picture does each carry? ; is there a next guide? [yes, a pager]; what does the aside list? ["In this guide", "All guides"].
- Admin: Settings > Domains > verification page for the card and steps; Home feed card for media-on-top. No admin guide page exists.
- Shape: h1 26/32 500 rgb(16,16,16), subtitle 13/20 rgb(74,74,74) ("3 min read · 4 steps"). Main column 760, aside 280, gap 48. One card per step: scene on top as a media panel (inset 7, radius 12, about 1.2x scale so UI text reads), then "Step 1 of 4" 12/18 subdued, title 15/22 500, body 13/20, bullets 13/20. A source pill on the scene (12/18 500, radius 8, bottom left; hidden on a phone). Aside, sticky, plain sections with hairlines: "In this guide" (numbered step links) and "All guides" (current marked `aria-current`). A pager at the end: Previous and Next cards (13/20 subdued label, 15 500 title); none on the first or last.
- States: reduced motion shows each scene's rest frame.
- Behaviour: a step link scrolls in place (step top 16px below the top), writes `#step` into the URL and moves the active marker; browser back returns to the step. A hash on load scrolls to it (the mock host drops the hash from an admin URL, so it opens at the top there). An unknown chapter goes to the library.
- Copy: "Step 1 of 4", "In this guide", "All guides".
- Evidence: measured.

### onboarding.guide-media: show an animated illustration in a card

- Intent: learn a step from a looping picture.
- Use when: guide content is an animation rather than a photo or video. Not when: a real video with controls is needed, see `onboarding.setup-step-media`.
- Admin: none: the admin has only static SVG or PNG media, no video, poster or player controls. Keep the feed card framing: radius 12 inside a radius-20 card, light grey panel (rgb(245,246,247)).
- Shape: the scene fills the media panel (286x140 in a feed card; larger on a guide step). Covers on the index are the first scene scaled.
- States: reduced motion shows the rest frame. Add controls only for a clip longer than a loop.
- Behaviour: no controls, loops by itself.
- Evidence: observed.

### onboarding.setup-modal-flow: do a multi-step task in a focused modal

- Intent: learn where you are in a short flow; do answer each step and finish.
- Use when: a task takes a few questions or choices and should dim the page. Not when: the steps are long-running actions on a connected account, see `onboarding.dns-steps-card`; or the list stays on the page, see `onboarding.setup-guide`; one short edit, see `settings.summary-row`.
- Ask: how many steps and what does each ask? ; what is the last action? [the same modal shows the result]; can a step be skipped? [no]; which choice is recommended? [marked "(recommended)"].
- Admin: Settings > Domains > "Connect existing domain" modal (`/settings/domains/connect`), seen 2026-11-14.
- Shape: `dialog` 620 wide, centred, height follows content (180 for one field, 337 with a banner and an offer). Radius 24, bg #fff, padding 0, shadow `rgba(0,0,0,.06) 0 2px 3px -1px, rgba(0,0,0,.06) 0 4px 6px -2px, rgba(0,0,0,.06) 0 8px 12px -4px, rgba(0,0,0,.06) 0 16px 24px -6px, ...`. Backdrop about 50% black. Header: h2 15px/22px 500 at inset 20 left, 19 top; close button 28x28 at 16/16 (circle, bg rgb(247,247,247), 20px x). No header divider. Body inset 20: label 13/20, control 580x30 radius 12. Footer: no divider, buttons right-aligned at inset 20, gap 8: Cancel (secondary, 28 high) and Next (primary).
- States: loading (Next shows a spinner, grey, disabled). Disabled primary bg rgba(0,0,0,.13), white text. Result: the same modal grows with an info banner and an offer card (see `onboarding.setup-offer-choice`), Next stays disabled. A registered domain leaves the modal and goes to a full page (see `onboarding.dns-steps-card`). Validation: a critical banner with "Check your answer" above the step.
- Behaviour: the 3px field focus halo stays inside the 20px body inset. Next or Enter advances. The modal lives at a URL over its parent page and closing returns to the parent (not exercised).
- Copy: step titles 15/22; description 13/20 subdued; labels write "(recommended)" in lowercase after an option ("Strong blocking (recommended)"); choices with details are one sentence each; checkbox with details reveals its field 4 below, indented 24.
- Evidence: measured.

### onboarding.setup-offer-choice: compare two ways to proceed

- Intent: learn the options (a call, or self-service) and their cost; do pick one.
- Use when: a flow starts with a choice between a recommended path and an alternative. Not when: one offer only, as an inline card in the modal; the paths are plans with prices, see `onboarding.plan-picker`.
- Ask: which path is recommended? ; what does each cost? ; what does each button do? [the primary commits].
- Admin: the offer card inside the connect-domain modal, seen 2026-11-14.
- Shape: card 580x73, radius 20, padding 16, no shadow, a light outline. Name 13/20 500, price line 13/20 with a subdued second part, a primary button ("Buy") at the right. Above it an info banner 580x52, radius 20, bg rgb(210,246,254), text rgb(0,44,56), 20px blue info icon at 24 from the left, text 13/20.
- States: none beyond the flow's.
- Behaviour: the primary button commits; the other card is a secondary.
- Copy: "Domain available for purchase" (banner); the 2 minutes in the card text, the meta says "Self-service".
- Evidence: measured.

### onboarding.dns-steps-card: complete steps on a connected account, with records to copy

- Intent: learn which steps are done and pending and what to change at the provider; do copy the values and confirm.
- Use when: setup depends on an outside system (DNS) and needs waiting and rechecks. Not when: a short in-modal choice flow, see `onboarding.setup-modal-flow`; steps inside the app only, see `onboarding.setup-guide`; only a login to a provider, see `onboarding.connect-account`.
- Ask: which steps, in what order, and which are waiting on the outside system? ; what does the primary recheck? ; which values does the merchant copy? [see `onboarding.records-to-copy`]; which provider logins are offered?
- Admin: Settings > Domains > verification page (`/settings/domains/verifications/<id>`), seen 2026-11-14.
- Shape: title bar: a back circle to Domains and a breadcrumb "Domains / shop.example.com"; right: "Log in to Cloudflare" (external-link icon, secondary) and "More actions". Body h1 26/32 500 with a "Needs setup" info badge, meta "Managed by Cloudflare" 13/20 at y 98. One card 784 wide (y 147, radius 20, card shadow). A hero strip 784x172, bg rgb(247,247,247), padding 0 16 12, an illustration (logos 70x70 in white circles, arrows 30x31) with a Sidekick prompt bar and a "Help set up domain" button 133x28. Steps list: icon at x 486, text at x 512. Step icon 16x16 (dashed circle pending, check done). Step title 13/20 400, pending titles rgb(166,166,166), pending icon rgb(74,74,74), active rgb(16,16,16), 32 apart collapsed. The active step body is indented to x 525 with numbered sub-steps 13/20 and underlined inline links. Provider row: a bordered box about 480 wide, 28x28 logo, name 13/20, "Log in" secondary 58x28 at the right. A 20px record icon button at the top right of the active step. Primary "I updated DNS records" 151x28 (bg rgb(16,16,16), white, 12/16 500, padding 6 12) right-aligned under the table, 16 below it.
- States: steps: open, pending, done. Records table loading: a 20px spinner plus "Loading items…" in place of rows. The records table is `onboarding.records-to-copy`.
- Behaviour: the primary rechecks the records (not pressed in the capture). The back circle is a link to the list.
- Copy: "Configure DNS records on <provider>", "DNS propagation", "TLS certificate provisioning", "I updated DNS records".
- Evidence: measured.

### onboarding.records-to-copy: copy values into another system

- Intent: learn exactly what to type at a provider; do copy each value.
- Use when: the merchant must paste names or values elsewhere. Not when: one value in a code block, see the `fields` family; one public URL, see `settings.account-url-row`.
- Ask: which values does the merchant paste and which columns show them? [type, name, current, update to]; copy per cell or per row? [per cell]; bulk select? [no].
- Admin: the DNS records table on the domain verification page, seen 2026-11-14.
- Shape: table 639 wide at x 513, radius 12 border. Header row 36 high, bg rgb(247,247,247), cells padding 8 6, 12px/20px 500 rgb(74,74,74): Type, Name, Current values, an arrow, Update to. A checkbox column appears for bulk ("0 selected"). Rows 33 high, TR bg #fff, cells 13/20: Type "CNAME", Name, Current value "(empty)" subdued, a 20px arrow-right icon, Update-to value 13/20 500, truncated with an ellipsis. Copy button per value: 28x28 icon button, padding 4, radius 9999, at the cell end, `aria-label="Copy updated CNAME value"`.
- States: after a click the icon swaps in place to a 20px check (seen at 250 ms; how long it stays was not timed). No toast.
- Behaviour: the copy button copies that cell only.
- Copy: "(empty)", "Copy updated CNAME value".
- Evidence: measured.

### onboarding.numbered-steps: tell the merchant what to do in order

- Intent: learn the order of a few actions.
- Use when: a short list (2 to 4) of instructions sits inside a card or modal. Not when: each step has state and a body, see `onboarding.dns-steps-card`.
- Admin: numbered sub-steps in the verification card ("1. Log in to Cloudflare and open DNS management for ..."), plain "1." text 13/20 indented 39px from the status icon. Inline links are underlined in text colour; standalone links are blue rgb(22,80,208). Seen 2026-11-14.
- Shape: plain numbers, not circles.
- States: none.
- Behaviour: none.
- Copy: imperative sentences.
- Evidence: observed.

### onboarding.illustrated-action-card: introduce a setup with a picture and actions

- Intent: learn what a feature setup is; do start it or open it.
- Use when: a card needs artwork, a short pitch and actions. Not when: a library of guides, see `onboarding.learning-index`; or a suggestion with a feed look, see `onboarding.home-feed-card`; one announcement with dismiss, see `onboarding.callout-card`; a previewed item, see `onboarding.media-card`.
- Ask: what is the artwork? ; which actions and what does each open? ; may it be dismissed? [yes].
- Admin: the verification card hero strip (784x172, bg rgb(247,247,247), padding 0 16 12, clipped by the card's 20 radius at the top) and the Home feed card. Seen 2026-11-14.
- Shape: artwork panel, title, description, actions.
- States: hover is the surface hover.
- Behaviour: a click on the art or text opens; the actions keep their own clicks.
- Copy: title plus one subdued sentence.
- Evidence: measured.

### onboarding.info-strip: state a fact or tip in one line

- Intent: learn one short fact; do hover for more.
- Use when: a compact note with an icon and a title, with the detail on hover. Not when: it must be acted on or dismissed, use a banner (`feedback` family); it is a plan or promotion message, see `onboarding.promotion`; steps to follow, see `onboarding.setup-guide`.
- Ask: what is the fact? ; what does hover add? [one detail sentence].
- Admin: none as a separate pattern. Nearest is the dotted definition label (`data.metric-definition`) and the info banner (radius 20, bg rgb(210,246,254), text rgb(0,44,56), 20px icon) in the domain modal. Admin: none. Also: Messaging home opens with a cyan info banner (SMS availability notice) above the filters, no dismiss (`/apps/shopify-messaging/landing`); Online Store preferences puts a cyan banner inside the settings card (`/online_store/preferences`), seen 2026-11-16.
- Shape: icon, title, hover description.
- States: hover and focus show the description.
- Behaviour: no action.
- Copy: a noun phrase title, not a sentence.
- Evidence: observed.

### onboarding.reference-links: send the merchant to reference pages

- Intent: learn where to read more; do open an outside page.
- Use when: a row of outside references each has a site icon. Not when: guides inside the app, see `onboarding.learning-index`.
- Ask: which references and what does each label say? ; how many? [three].
- Admin: none found. Admin: none, compose link rows with icons. Also: Checkout Blocks places a centred "Learn more" sentence under its launcher card; Flow News cards use a grey "Learn more" pill (seen 2026-11-16).
- Shape: a row of link cards, each with its site's icon; three columns when the container is at least 900px wide, one column below.
- States: none captured.
- Behaviour: each card opens its URL.
- Evidence: observed (no reference row seen).

### onboarding.plan-picker: choose and change a plan

- Intent: learn what each plan costs and includes; do choose a plan and a billing interval.
- Use when: the merchant must pick between plans in the app (this entry absorbed the former plan comparison entry of settings; nearest admin analogs are the Plan page list rows and the report table). Not when: only the current plan is shown, see `onboarding.plan-summary` or `settings.plan-and-usage`; comparing features without prices, see `onboarding.plan-comparison`; a gated feature needs a nudge, see `onboarding.upgrade-prompt`.
- Ask: which plans and which price drives the choice? ; billing intervals and the default? [monthly, with a yearly toggle]; a usage slider or fixed tiers? [fixed tiers]; a trial banner? [yes when a trial exists]; what does the free plan show? [a disabled yearly option when not eligible].
- Admin: none captured. The store is a development store, so `/settings/subscribe/select-plan` redirects to `/settings/organization-account/` and the Plan page has no "Change plan" action (2026-11-14). Admin: none; compose it from admin values.
- Shape: an interval toggle (see `onboarding.interval-toggle`), a plan name 15/22 500 (admin Plan row h2), a price 29px/36px 500 (admin bill amount), a discrete slider with stops, benefit lists with check or minus Polaris icons, partner logos.
- States: trial, billing attention, a missing average order warning, a no-order-charges info, a free plan row with a disabled yearly option when the store is not Plus (see the home inventory for the data conditions); the slider stop labels must not wrap at 390 ("Unlimited" fell to a second line).
- Behaviour: the breadcrumb returns to Settings and back works (`/settings?tab=billing` to `/billing` and back).
- Copy: "Monthly", "Yearly".
- Evidence: observed.

### onboarding.interval-toggle: switch between two billing intervals

- Intent: learn which interval prices show; do switch.
- Use when: two to three exclusive options change a view (Monthly or Yearly). Not when: the options are filters for an index, see the `index` family; a fixed set of views of a card, see `settings.fixed-view-tabs`.
- Ask: which intervals? [monthly, yearly]; which is selected first? [monthly].
- Admin: the segmented control on Discount create, seen 2026-11-14.
- Shape: joined pills 28 high, 12px/16px 500. Pressed bg rgb(208,208,208) with an inset shadow; rest bg rgb(235,235,235).
- States: pressed and rest. Polaris `s-press-button` toggles itself on click, which a controlled interval cannot follow.
- Behaviour: re-clicking the selected option has no effect (by design).
- Copy: "Monthly", "Yearly".
- Evidence: observed.

### onboarding.plan-summary: see the current plan and app subscriptions

- Intent: learn which plan is active and what is billed; do manage it.
- Use when: showing the plan the merchant is on. Not when: choosing one, see `onboarding.plan-picker`; the section also shows usage and a billing cycle inside Settings, see `settings.plan-and-usage` (the stronger, measured twin; this entry is the app-page variant).
- Ask: what shows per app row? [name, price line, renewal]; is a billing cycle shown? [only on billing]; a manage action? [a link to the plan page].
- Admin: Settings > Plan (`/settings/plan`) and Billing (`/settings/billing`, redirects to `/settings/organization-billing`), seen 2026-11-14. Also: inside an app, none of Flow, Checkout Blocks, Messaging shows plan or usage (checked 2026-11-16); Checkout Blocks only adds a footer line "Learn more about which features ... are available on your Shopify plan" (`/apps/checkout-blocks`).
- Shape: settings frame: nav 239 wide (x 61 to 300), content x 468, width 784, h1 26/32 500. Section heading 15/22 500, card 16 below. Card: `section`, bg #fff, radius 20, padding 16, card shadow, `role=list` of `listitem` rows. Plan row 784x54: plan name h2 15/22 500, "Development store" 13/20 subdued. App row 784x70: 24x24 icon (radius about 6), text at icon x + 36: name 13/20 400, a price line 12px/18px 400 subdued ("$1,699.00 yearly. Renews ..."). Next section heading 32 under the card. Footer line 12px/18px with underlined links. Billing card: amount "$0.00" plus "USD" as h2 29px/36px 500, a "View current charges" link, "Running total · Oct 26, 2026 - Nov 25, 2026" 13/20 subdued, hairline, a full-width row "Add payment method" (48 high, 13/20 500, 20px icon). Bills table sits under tabs (`button[role=tab]` 28 high, padding 4 12, radius 9999, 12px/18px 500; selected bg rgba(0,0,0,.13); overflow in "More views").
- States: none captured.
- Behaviour: Billing keeps tabs because its set is fixed.
- Copy: "Add payment method".
- Evidence: measured.

### onboarding.plan-comparison: compare plans or apps feature by feature

- Intent: learn which option includes what.
- Use when: a table compares options row by row. Not when: choosing a plan with prices, see `onboarding.plan-picker`; picking a guide from a library, see `onboarding.learning-index`.
- Ask: which options are compared and which rows? ; what marks a row? [a check or a minus]; where does it open from? [a link in the library].
- Admin: none captured for plans. Plan comparison tables elsewhere use check or dash marks, so follow them; the analytics table is the nearest data table (`data.period-table`). Admin: none; checked Flow, Checkout Blocks, Messaging on 2026-11-16 (none shows plan or usage in the app; Checkout Blocks only adds a footer line "Learn more about which features ... are available on your Shopify plan", `/apps/checkout-blocks`).
- Shape: a table of "Included" or "Not included" rows with a check icon or a neutral minus icon, the label kept for screen readers. Breadcrumb back to the library. Row labels are sentence case ("Works with headless", "Safari and iOS").
- States: none.
- Behaviour: a deep link `/app-comparison` and back returns to `/resources`.
- Copy: sentence case, no shorthand.
- Evidence: observed.

### onboarding.upgrade-prompt: say a feature needs a better plan

- Intent: learn why something is limited; do upgrade.
- Use when: a feature is gated by plan or by a free tier. Not when: the merchant is choosing among plans, see `onboarding.plan-picker`; a general offer or paid feature teaser, see `onboarding.promotion`; the limit is a usage count, see `settings.plan-and-usage`.
- Ask: which feature is gated and what does the upgrade unlock? ; banner tone? [info, warning when blocked]; where does the action go? [billing]; may it be dismissed? [no].
- Admin: none captured for upgrade prompts. Use a banner under the title block with its action in the banner's action slot; the page's title bar holds the page-level action. Checked Flow, Checkout Blocks, Messaging on 2026-11-16: none shows a plan prompt in the app; Checkout Blocks only adds a footer line "Learn more about which features ... are available on your Shopify plan" (`/apps/checkout-blocks`).
- Shape: banner (warning or info) under the title block, radius 20; the "Upgrade" action sits in the title bar's `secondary-actions`, not floating.
- States: freemium, not configured, and high-risk variants differ by banner tone and text.
- Behaviour: the action goes to billing.
- Copy: "Upgrade".
- Evidence: observed (no upgrade prompt seen).

### onboarding.connect-account: log in to a provider to finish setup

- Intent: learn which provider holds the settings; do open its login.
- Use when: a setup step happens in an outside account (DNS provider). Not when: the merchant only needs to paste values, see `onboarding.records-to-copy`; the account is already connected and has states, see `settings.connected-account-row`; the whole setup is stepwise, see `onboarding.dns-steps-card`.
- Ask: which provider and where does the login open? [a new tab]; where does the button sit? [the title bar, plus a row in the active step].
- Admin: the domain verification page, seen 2026-11-14: the title bar "Log in to <provider>" (external-link icon, secondary) and a provider row inside the active step.
- Shape: title-bar secondary button with an external-link icon. In the step: a bordered box about 480 wide, provider logo 28x28, name 13/20, "Log in" secondary button 58x28 at the right. Meta "Managed by Cloudflare" under the h1.
- States: none captured.
- Behaviour: opens the provider in a new tab.
- Copy: "Log in to Cloudflare", "Log in".
- Evidence: measured, https://shopify.dev/docs/api/app-home/latest/patterns/compositions/account-connection

### onboarding.callout-card: announce a feature or a first action

- Intent: learn about a new feature or opportunity; act on it or dismiss it.
- Use when: one message should stand out without blocking, on the homepage. Not when: the card is one of a feed with a picture and one action, see `onboarding.home-feed-card`; not when several setup steps need tracking, see `onboarding.setup-guide`; not when it is an offer or paid feature teaser, see `onboarding.promotion`; not when it recommends another app, see `onboarding.app-card`.
- Ask: what is the message and the one action? ; one primary and one secondary button? [yes]; a picture? [optional, beside the text]; dismissible? [yes, with a toast "Card dismissed"]; when does it disappear? [after the merchant engages].
- Admin: Shopify dev docs > API > App Home > Patterns > Compositions > Callout card (`https://shopify.dev/docs/api/app-home/latest/patterns/compositions/callout-card`), seen 2026-11-16.
- Shape: a section with a heading, one paragraph, a primary and a secondary button, and an illustration in a clipped box beside them. A dismiss button sits in the header beside the heading. Columns stack on small screens.
- Behaviour: use sparingly; remove the card after the merchant engages; buttons carry `href`; dismissing shows a toast.
- Copy: "Ready to create your custom puzzle?" with "Upload image" and "Browse templates"; "New: AI-powered puzzle suggestions" with "Try it now" and "Learn more"; dismiss label "Dismiss card"; toast "Card dismissed".
- Evidence: docs, https://shopify.dev/docs/api/app-home/latest/patterns/compositions/callout-card

### onboarding.app-card: recommend another app

- Intent: learn about a related app; install it.
- Use when: a complementary app or integration helps the merchant's task. Not when: the offer is a plan upgrade, see `onboarding.upgrade-prompt`; the app is installed and listed, see `settings.app-list`.
- Ask: which app and why does it help? ; what is its price line? ["Free"]; does it install from the card? [a link to the App Store].
- Admin: Shopify dev docs > API > App Home > Patterns > Compositions > App card (`https://shopify.dev/docs/api/app-home/latest/patterns/compositions/app-card`), seen 2026-11-16.
- Shape: the whole card is one link; a grid holds the app icon thumbnail, then name, price and a one-line description, then an install button.
- Behaviour: `href` on the card and the button to the App Store; the Navigation API handles navigation. A featured tile is a single link with no nested button (homepage template).
- Copy: "Shopify Planet", "Free", "Offer carbon-neutral shipping and showcase your commitment."; button label "Install Shopify Planet".
- Evidence: docs, https://shopify.dev/docs/api/app-home/latest/patterns/compositions/app-card

### onboarding.media-card: show a picture with its actions

- Intent: preview a template, tutorial or item visually; act on it.
- Use when: a visual helps the merchant decide. Not when: the card only offers one next action, see `onboarding.home-feed-card`; the art introduces a setup, see `onboarding.illustrated-action-card`.
- Ask: which item does the card preview? ; which actions? [View, Edit, Delete]; does delete confirm? [yes, a modal naming the item].
- Admin: Shopify dev docs > API > App Home > Patterns > Compositions > Media card (`https://shopify.dev/docs/api/app-home/latest/patterns/compositions/media-card`), seen 2026-11-16.
- Shape: a bordered, rounded, clipped box. A tappable image on top, a divider, then a footer grid with the title and an action button (View, Edit, Delete, or icon buttons).
- Behaviour: the image is a clickable target; delete confirms in a modal; copy-link shows a toast; edit can open Shopify's editor through the Intents API; share opens the native sheet on mobile. Icon buttons carry an `accessibilityLabel`; images carry descriptive `alt`.
- Copy: "4-Pieces", "View", "Delete template?", "Link copied to clipboard".
- Evidence: docs, https://shopify.dev/docs/api/app-home/latest/patterns/compositions/media-card

### onboarding.promotion: promote without pressure

- Intent: learn about an offer or a paid feature; dismiss it.
- Use when: the app shows a promotion or a plan-gated feature. Not when: the message is setup help, see `onboarding.setup-guide`; the feature is blocked and needs an upgrade now, see `onboarding.upgrade-prompt`; one announcement of a new feature, see `onboarding.callout-card`.
- Ask: what is offered and to whom? ; where does it sit? [the bottom of the home page]; may it be dismissed? [yes, never shown again to that user].
- Admin: Shopify dev docs > App design > User experience > Alerts > Promotion (`https://shopify.dev/docs/apps/design/user-experience/alerts`), seen 2026-11-16.
- Shape: a dismissible container at the bottom of the app home page, or a dedicated promotional page. Paid-tier features show in a visually disabled state with subdued caption text explaining the upgrade.
- Behaviour: after dismissal it never shows again to the same user. Do not repeat one marketing message on every page. Do not mix a primary call to action with unrelated marketing or support requests.
- Copy: no fake reviews, false special offers or countdown timers; do not oversell or overpromise.
- Evidence: docs, https://shopify.dev/docs/apps/design/user-experience/alerts

### onboarding.first-use-hero-with-templates: invite the first creation from an empty app

- Intent: learn what the app automates; do start from a template or from scratch.
- Use when: the app's main list is empty and the work is a build (a workflow, a rule, a message). Not when: required setup must be finished first, see `onboarding.setup-guide`; the first record is one simple form, use the list empty state.
- Ask: which two actions to offer [Browse templates (secondary), Create (primary)]? Repeat them in the title bar [yes]? What sits under the hero [News cards, then Featured templates]?
- Admin: Apps > Flow (`/apps/flow`), seen 2026-11-16. Also: Messaging home shows recommended cards instead of a hero.
- Shape: title bar with the app icon and name, actions Browse templates, Import (white pills), Create workflow (black pill), "..." menu. Body: centred illustration, h2, one sentence, then the same Browse templates (grey pill) and Create workflow (black pill). Below the hero: a "News" section and a "Featured templates" section, each with a link at the right ("See all posts", "See all templates").
- States: with workflows the hero goes away (not captured).
- Behaviour: no dismiss. The hero is the empty state itself, so it needs no memory. The layout moves a few pixels for about 2 s while the app frame loads.
- Copy: "Get more work done in less time". "Turn your tasks into automated workflows so you can get back to business."
- Evidence: observed.

### onboarding.news-cards: tell the merchant what changed in the app

- Intent: learn about new app behaviour; do open the article.
- Use when: the app ships changes merchants must know and has a changelog. Not when: the message is one fact tied to the page, see `onboarding.info-strip`; it needs action now, use a banner.
- Ask: how many posts to show [two]? Where does "Learn more" go [help doc or changelog]?
- Admin: Apps > Flow, below the empty hero (`/apps/flow`), seen 2026-11-16.
- Shape: section heading "News" with a "See all posts" link at the right; two equal cards side by side. Each card: date, bold title, body paragraph, grey pill "Learn more" at the bottom left.
- Behaviour: no dismiss and no unread state seen.
- Copy: "Copy and paste multiple steps at once"; "Staff now need permissions to test and turn on workflows".
- Evidence: observed.

### onboarding.recommended-card: suggest a ready-made next step

- Intent: learn the best next action for this store; do preview it.
- Use when: the app can prepare a campaign or setup for the store and the merchant only reviews it. Not when: several equal steps with progress, see `onboarding.setup-guide`; a plain promotion with no preview, see `onboarding.upgrade-prompt`.
- Ask: how many recommendations [one featured, then half-width tiles]? Primary action [Preview]?
- Admin: Apps > Messaging (`/apps/shopify-messaging/landing`), seen 2026-11-16.
- Shape: card titled "Recommended for you" under the KPI strip. Inside, a grey media panel (stack of previews) over a title, a body and one grey pill "Preview". More half-width cards follow ("Welcome new subscribers with an offer", "Expand your audience with email and SMS").
- Copy: "Launch your BFCM email campaign in minutes". "Prebuilt email series with optimized delivery and personalized products, ready for you to review before sending."
- Evidence: observed.

### onboarding.blocked-feature-page: say a feature cannot run yet and list what blocks it

- Intent: learn why a feature is idle; do fix the blocker.
- Use when: a feature page exists but a store prerequisite is missing. Not when: a plan upgrade is needed, see `onboarding.upgrade-prompt`.
- Admin: Growth > Autopilot, seen 2026-11-16.
- Shape: top banner "Complete your store setup to use Autopilot" with a sentence listing the missing steps inline and a button "Set up with Sidekick". Below, the page shows its normal sections (Summary, Activity, Configuration) in a waiting state with live status lines ("Autopilot is analyzing your store's catalog, pricing, profit margins, and sales history").
- Evidence: observed.

### onboarding.feature-hero-banner: announce a feature with a dismissible hero on the overview

- Intent: do start a feature from the section overview.
- Use when: the section has a flagship feature not yet used. Not when: a quiet tip is enough, see `onboarding.promotion`.
- Admin: Growth overview (`/growth`), seen 2026-11-16.
- Shape: a card at the top: heading "Run your marketing on autopilot", one sentence, buttons "Get started" and "Learn more", a "Dismiss" control.
- Evidence: observed.

### onboarding.eligibility-offer: show an offer with a hero, a card illustration and a waitlist

- Intent: learn what a financial product offers; do join a waitlist.
- Use when: a product is gated by eligibility. Not when: the merchant can subscribe now, see `onboarding.plan-picker`.
- Ask: What happens after the click? [waitlist]. Footnote kept? [yes, numbered].
- Admin: Finance > Credit (`/credit`), seen 2026-11-16.
- Shape: title; one large card in two columns: left headline "Up to 3% cashback and two convenient ways to pay", paragraph with a footnote marker, an inset bordered card with eligibility text and a black pill "Join waitlist"; right a green gradient credit card illustration. Below: numbered footnote and a legal line with links.
- Evidence: observed.
