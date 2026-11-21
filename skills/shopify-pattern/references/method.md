# Research and verification method

Each rule exists because skipping it cost a review round.

## Inventory

List every page, section and element (field, toggle, list, banner, help, button, link, picker, preview, icon). Write each one's intent before looking at any reference.

## Research a missing intent

Search for the intent, not the look. Compare at least two admin places before writing the entry; what differs is the `Use when` line. Order: catalog neighbours, the whole admin (indexes, details, create forms, every Settings page, Analytics, Markets, Content), Shopify's own apps (Checkout Blocks, Flow, Search & Discovery, Forms, Email, Inbox), then shopify.dev ([app design](https://shopify.dev/docs/apps/design), [web components](https://shopify.dev/docs/api/app-home/latest/web-components)).

Easy to miss: a row with icon and chevron opening a modal instead of a card; one summary line instead of a section; a select with help instead of long radios; a badge and "..." menu instead of three buttons; inline help instead of a banner; plainer copy.

## Reach the admin

The reference is the dev store named in `project.md` (`/orders`, `/discounts`, `/settings`). Never a production store.

1. Open it with the session's browser tool, in a profile that is already signed in.
2. "Unavailable" is a claim only a failed call proves. Make the call first and report its error text. Never write "browser unavailable" without one.
3. A login page means the profile is signed out: stop, say so, never type credentials. No browser tool in the session: say exactly that.

## Record

- The values that define the pattern go in a [value sheet](sheets.md), measured with `scripts/probe.js`: it is what later passes compare against. `scripts/outline.js` finds the parts when they are not known yet.
- Every state: rest, hover, focus, open, selected, empty, loading, error, disabled.
- Behaviour, in the entry: push or replace per control; the back arrow's `href`; where state lives (URL, storage, nowhere); what closes each popover and modal.
- A state that cannot be captured is said in the sheet's `adminSteps`, with the nearest substitute.
- Parallel agents: one admin tab per agent hits the browser's tab limit; measure in small waves.

**Admin writes.** Read only, with one exception: a record named `zz pattern test` may be created in the dev store when a state needs it (modal result, toast, empty after delete) and must be deleted in the same pass. Touch no other record. Never send, install, buy or confirm a destructive modal on anything else. Leave other forms with Discard. Do not stop to ask about this.

## Verify

1. **Compare** each element against its sheet, to 0 differences.
2. **States:** bounding boxes before and after hover and open must not shift.
3. **Keyboard:** Tab, Enter, Escape, arrows; focus ring on keyboard only.
4. **Controls:** click each one once; a control with no effect is a bug unless it is a native select. Real mouse coordinates only.
5. **Flows:** fill a modal, save, discard, follow links, go back.
6. **Variants:** every variant `project.md` lists that changes the screen.
7. **Widths:** 1440, 1920, phone.
8. **Look:** screenshot both sides at one width, by eye, last.

## Traps

- A hidden browser tab does not repaint, hover or take pointer clicks: `element.click()` and `focus()` in an expression still work.
- The admin's content security policy blocks plain HTTP: nothing can be posted from the admin page to a local server.
- A menu item that ignores `click()` often reacts to the full sequence `pointerdown`, `mousedown`, `pointerup`, `mouseup`, `click`.
- Whole pixels: a tab at a fractional zoom reports borders such as 0.7; the probe rounds them.
