# Fields

The merchant gives one value: types, picks or flips it, sees what is wrong, and knows what the field means.

### fields.anatomy: space a label, control and help

- Intent: learn what a field asks; do enter the value.
- Use when: any text-like field. Not when: a choice list or checkbox, see `fields.choice-list`, `fields.checkbox-details`.
- Admin: Discount create (`/discounts/new/amount-off-product`), Settings > Checkout (`/settings/checkout`), seen 2026-11-14.
- Shape: label 13px/20 500 rgb(16,16,16). Label bottom to control top: 4. Control bg #fff, radius 12, no CSS border; the edge is a shadow `rgba(0,0,0,.04) 0 2px 3px -1px, rgba(0,0,0,.04) 0 3px 4px -1.5px, rgba(0,0,0,.13) 0 0 0 1px`. Text 13px/20 400, inner padding 0 12 (input padding 5 12). Heights: text 30, select 30-32, number 32, search 30, money 30. Control bottom to help top: 6. Help 12px/18 400 rgb(74,74,74), multi-line keeps 18 line height. Two controls side by side: gap 8. Field followed by another field group: 16.
- Copy: a label row that carries an action link uses weight 400 (Discount code + "Generate random code").
- Evidence: measured.

### fields.text: enter a short text

- Intent: learn what to type; do type it.
- Use when: free text of one line. Not when: several lines, see `fields.textarea`; a value picked from a list, see `fields.select`; the code may be generated, see `form.code-generator`.
- Ask: is it required? [only if the record cannot exist without it]; which help line? [one that adds a fact, else none]; any format rule? [none].
- Admin: Discount create "Discount code", seen 2026-11-14.
- Shape: 728x30 in the measured column. Help "Customers must enter this code at checkout." 6 below.
- Behaviour: a field with an action beside the label puts the link in the label row.
- Evidence: measured.

### fields.textarea: enter several lines

- Intent: learn what to write; do write it.
- Use when: a message or template of more than one line. Not when: one line, see `fields.text`.
- Ask: template reset or test send beside it? [only for message templates]; a character counter? [only when there is a limit]; required? [no].
- Admin: not measured. Seen only as rich-text comment boxes (trix: 13/20, toolbar of 28x28 icon buttons), 2026-11-14.
- Shape: same label and help rules as `fields.anatomy`. Keep the label visible and put variable help in `details`; a short character counter may sit in the field.
- Copy: "Reset template" and "Send test" buttons sit beside the field.
- Evidence: observed.

### fields.number-suffix: enter a number with a unit

- Intent: learn the unit; do type or step a number.
- Use when: a count or percentage. Not when: an amount of money, see `fields.money`.
- Ask: which unit? [the one the value is counted in]; minimum and maximum? [none]; step? [1]; default? [empty].
- Admin: Discount create value field, seen 2026-11-14.
- Shape: 239x32. Suffix (`%`) 13/20 rgb(74,74,74) at the right, 12 before a stepper of two 28x16 buttons (chevron-up and chevron-down 16, rgb(74,74,74), padding 4 4 0 and 0 4 4).
- Evidence: measured.

### fields.money: enter an amount of money

- Intent: learn the currency; do type an amount.
- Use when: a price or threshold. Not when: a percentage, see `fields.number-suffix`.
- Ask: which currency? [the store's]; minimum? [0]; required? [only when the rule needs it].
- Admin: Discount create "Fixed amount", seen 2026-11-14.
- Shape: 150x30, indented under its radio (x + 24). Prefix "$" 13/20 rgb(74,74,74) at 12 from the left, value after 6 (input padding 5 12 5 0). Help "Applies only to selected collections." 12/18, 6 below.
- Copy: show the narrow currency symbol, never the code ("$", not "EUR"); trailing in French.
- Evidence: measured.

### fields.select: pick one value from a list

- Intent: learn the options; do pick one.
- Use when: one pick from a list the merchant does not need to compare. Not when: options need a line of help each, see `fields.choice-list`; two options, see `fields.which-control`.
- Ask: which options, in which order? [shortest list, most common first]; default? [the first option]; help per selection? [only when the choice needs it].
- Admin: Discount create "Purchase type", "Applies to", seen 2026-11-14.
- Shape: 360x30, radius 12, up-down chevron 16-20 at the right (12 inset). Label 500, 4 above. With details: the same 6 gap and help style as text.
- Evidence: measured.

### fields.choice-list: pick one option that each needs explaining

- Intent: learn what each option does; do pick one.
- Use when: few options (2 to 4) that each carry a line of help. Not when: options are self-explanatory (`fields.select`) or the choice is yes/no (`fields.switch`, `fields.checkbox-details`); the help is long, see `form.choice-with-help`; you place it in a form card, see `form.choice-list-details`.
- Ask: which two to four options, each with what help? [one short line]; default? [the recommended one]; follow-up field under which? [only where needed].
- Admin: Settings > Checkout radios, Discount create "Minimum purchase requirements", seen 2026-11-14.
- Shape: group label 13/20 500, 9 above the first radio. Rows 28 high (label padding 4 0). Radio 16x16 checked, 14x14 unchecked, radius 50%. Unchecked shadow `rgba(0,0,0,.04) 0 2px 3px -1px, rgba(0,0,0,.04) 0 3px 4px -1.5px, rgba(0,0,0,.2) 0 0 0 1px`. Checked bg rgb(16,16,16) with a thick black ring look. Details 12px/16 rgb(74,74,74) under the label.
- States: disabled labels rgb(166,166,166). A follow-up input shows under the picked choice (see `fields.checkbox-dependent`).
- Behaviour: the group is a single control that emits `change` with the chosen value; clicks on the inner choice do not fire.
- Copy: a recommendation goes in the label in plain text ("10 hours (recommended)").
- Evidence: measured.

### fields.checkbox-details: tick one option with a line of help

- Intent: learn what ticking does; do tick it.
- Use when: an independent yes/no option, or several that can combine. Not when: a rule that applies at once, see `fields.switch`.
- Ask: ticked by default? [no]; which consequence line? [one tight line]; required to save? [no].
- Admin: Settings > Checkout, seen 2026-11-14.
- Shape: input 16x16 (14x14 unchecked native box). Label 13px/20 400 at checkbox x + 25. Details 12px/18 400 rgb(74,74,74) starting 25 below the label top. Checked: filled rgb(16,16,16) square, radius about 4, white check. Several options that can combine form one multi-select choice list with a label.
- States: keyboard focus ring in `fields.keyboard-focus`. Measured 2026-11-16: rest bg #fff with a 1px ring rgba(0,0,0,.2); hover bg #F7F7F7; checked bg #101010; keyboard focus 2px #5083F0 (offset 2 unchecked, 1 checked); box 14x14, radius 4, in an 18px label; indeterminate looks checked; disabled not measured.
- Copy: label names the action ("Turn on discount recovery"); details carry the consequence in one tight line.
- Evidence: measured.

### fields.checkbox-dependent: reveal a field under a choice

- Intent: learn the field applies only to that option; do fill it.
- Use when: a value is needed only when a checkbox or radio is chosen. Not when: it is always needed, show it plainly; the whole card is one opt-in limit, see `form.reveal-by-checkbox`.
- Ask: which value does the choice reveal, in which unit? [a number or an amount, 150 wide]; required once ticked? [yes].
- Admin: Discount create "Limit number of times...", money field under a radio, seen 2026-11-14. Also: Settings > Checkout "Send abandoned checkout emails automatically" reveals two radio groups under it: "Send to" (Anyone who abandons their checkout; Email subscribers who abandon their checkout) and "Send after" (1 hour, 6 hours, 10 hours (recommended), 24 hours). The recommended option is marked in its own label.
- Shape: number field 150x32 at checkbox x + 24, 4 below the checkbox label line. Money field 150x30 indented the same.
- Behaviour: the field appears only when the choice is checked; unchecked leaves it out, not disabled.
- Evidence: measured.

### fields.switch: flip one rule inside a card

- Intent: learn the state; do flip it.
- Use when: a menu or popover option with immediate effect. Not when: a settings rule with an explanation, see `settings.switch-row`; an option saved with a form, see `fields.checkbox-details`.
- Ask: on or off by default? [off]; does it apply at once with no save step? [yes].
- Admin: Orders "Display options" popover, seen 2026-11-14.
- Shape: 32x16 track, label 13/20 at its left, switch right-aligned. Colours in `settings.switch-row`.
- States: Measured 2026-11-16: on bg #101010, knob 16 white shifted translateX(11), transition .1s; off, hover and focus not measured.
- Evidence: measured.

### fields.which-control: choose the right control for the value

- Intent: pick the control that fits the value.
- Use when: deciding. Two states applied at once: switch. Yes/no saved with a form, or several that combine: checkbox. Two to four exclusive options that each need help: choice list (radio). Longer lists or options that need no help: select. Two or three views of the same data: segmented choice. A value of free text or number: text-like field.
- Admin: Settings > Checkout and Discount create, seen 2026-11-14.
- Behaviour: one control per value; never mix a checkbox group with a select for the same setting.
- Evidence: observed.

### fields.search: find and pick an existing record

- Intent: learn what can be picked; do search and add.
- Use when: the value is a record from a long list (discount codes, products). Not when: a short fixed list, see `fields.select`; one customer with a create row, see `fields.customer-combobox`; products or collections of the store, see `form.resource-picker`.
- Ask: which records can be found? [none, owner decides]; one pick or many? [many, as chips]; what does empty mean? [all, said in the help line].
- Admin: Discount create "Applies to" and "Eligibility", seen 2026-11-14.
- Shape: search field 30 high, same shadow and radius as text. For a single pick, a select reveals a search field and a Browse button below it. The label stays visible. A hint such as "Leave empty to protect all" is the help line.
- Evidence: observed.

### fields.focus: show a focused field

- Intent: see where input goes.
- Use when: a text-like field takes click or keyboard focus. Not when: a checkbox or radio, see `fields.keyboard-focus`.
- Admin: Discount create, seen 2026-11-14.
- States: shadow becomes `rgba(0,0,0,.04) 0 2px 3px -1px, rgba(0,0,0,.04) 0 3px 4px -1.5px, rgba(0,0,0,.04) 0 4px 5px -2px, rgb(80,131,240) 0 0 0 1px, rgba(53,115,246,.06) 0 0 0 3px, rgba(53,115,246,.06) 0 4px 20px 2px, rgba(53,115,246,.05) 0 0 8px 1px inset`. A 1 blue ring, 3 halo, 20 glow. Hover is not measured.
- Behaviour: keep at least 4 clear to any `overflow: hidden` edge or the ring is cut.
- Evidence: measured.

### fields.keyboard-focus: show keyboard focus on a choice

- Intent: see which checkbox or radio is focused.
- Use when: a checkbox or radio takes keyboard focus. Not when: a text field, see `fields.focus`.
- Admin: Discount create, Settings > Checkout, seen 2026-11-14.
- States: a 2 blue ring (same blue as `fields.focus`) around the box with about 2 offset and about 6 radius. The native input's computed outline (`rgb(229,151,0) auto`) is not what is drawn; the ring comes from the visual sibling.
- Evidence: measured.

### fields.error: say a value is wrong

- Intent: learn what is wrong; do fix the value.
- Use when: a value is invalid after the merchant edits or submits. Not when: a form-level failure, see `form.validation-banner`; the question is when errors first show, see `form.error-timing`; the error sits in a modal, see `feedback.field-error`; a form field with the same look, see `form.field-error`.
- Admin: Discount create errors, seen 2026-11-14.
- States: control shadow `rgb(235,0,20) 0 0 0 1px, rgba(0,0,0,.04) 0 4px 5px -2px, rgba(0,0,0,.04) 0 3px 4px -1.5px, rgba(0,0,0,.04) 0 2px 3px -1px, rgba(224,61,80,.05) 0 0 8px 1px inset`. Message 7 below the control: 16 alert-circle icon, 2 gap, 12px/18 400 rgb(206,31,24). The help text is replaced by the error while invalid.
- Behaviour: a choice list takes `error` too ("Select at least one").
- Copy: short and specific ("Email is not valid").
- Evidence: measured.

### fields.disabled: show a field that cannot be edited

- Intent: learn the value is locked; do nothing.
- Use when: a value cannot change now. Not when: a revealed option, hide it instead (`fields.checkbox-dependent`).
- Ask: why is it locked, and where is that said? [the help line says why].
- Admin: no disabled text field on the captured pages. Buttons and radio labels: text rgb(166,166,166); primary disabled bg rgba(0,0,0,.13) with white text.
- States: disabled field not measured. Disabled radio labels rgb(166,166,166).
- Evidence: observed.

### fields.help-text: explain a field under it

- Intent: learn what the value does; do nothing.
- Use when: one line explains the effect or format. Not when: the text is general to the group, see `settings.group-heading`; you decide wording for a section or warning, see `feedback.help-text` and `feedback.banner`; a term needs a definition, see `fields.help-tooltip`.
- Admin: Discount create, Settings > General, seen 2026-11-14.
- Shape: 12px/18 400 rgb(74,74,74), 6 below the control, replaced by the error while invalid. Radio and checkbox details are the same colour (12/16 for radios, 12/18 for checkboxes).
- Copy: one line, plain: "Leave empty to protect all codes". A field label that already says it needs no help.
- Evidence: measured.

### fields.help-tooltip: explain a term beside its label

- Intent: learn what a term means; do nothing.
- Use when: a short definition that does not fit as help. Not when: it fits one line, see `fields.help-text`; a control needs a hint on hover, see `feedback.tooltip`.
- Ask: which terms need a definition? [only those too long for help text].
- Admin: inline help icon with a dark tooltip on hover or focus, seen 2026-11-14 (setup guide step info).
- States: see `actions.tooltip-look`.
- Behaviour: opens on hover or keyboard focus of the icon; text is plain.
- Evidence: observed.

### fields.width: size a field

- Intent: see how much the value needs.
- Use when: laying out a form column. Not when: a table cell.
- Admin: Discount create, seen 2026-11-14.
- Shape: text field fills the 728 column; select 360; number 239 with a suffix, 150 when nested; money 150. Short values stay narrow; two related controls share a row with gap 8.
- Evidence: measured.

### fields.customer-combobox: pick or create a customer in one field

- Intent: find a customer by name or email; do create a new one without leaving.
- Use when: a record needs one customer from a large list. Not when: choosing among few static values, see `fields.select`; other records without a create row, see `fields.search`.
- Ask: may a customer be created here? [yes]; what does each row show? [name and email].
- Admin: Create order > Customer, seen 2026-11-16. Also: `fields.search`.
- Shape: search field with a leading magnifier, placeholder "Search or create a customer". Popover (280x505) lists "Create a new customer" first, then rows with name and email below. A live region announces "10 customers found and an option to create a new customer".
- Behaviour: Escape closes. Choosing a row replaces the field with the customer block.
- Evidence: observed.

### fields.affix-preview: type a prefix and suffix and see the result

- Intent: learn what an identifier will look like; do set its prefix and suffix.
- Use when: a value is composed from editable parts around a generated core. Not when: the whole value is typed, see `fields.text`.
- Ask: default prefix and suffix? ["#" and none]; where does the identifier appear? [none, owner decides].
- Admin: Settings > General "Order ID format", seen 2026-11-16.
- Shape: group heading with a one-line description under it, then a card with two text fields side by side (Prefix, Suffix; prefix holds "#") and under them a plain sentence: "Your order ID will appear as #1001, #1002, #1003, ...".
- Behaviour: edited inline; the page save bar appears. The sentence is the live preview.
- Evidence: observed

### fields.type-picker: pick a data type from a grouped, searchable list

- Intent: do choose one type out of many kinds.
- Use when: more than about ten options fall into families. Not when: the list is short, see `fields.select`.
- Ask: Which types are recommended at the top? [single line text, multi-line text, integer, image, metaobject].
- Admin: Add metaobject definition, field row type button, seen 2026-11-16.
- Shape: a button showing the current type with its icon opens a popover: search box, a "Recommended" group, then labelled groups Text, Media, Reference, Number, Link, Date and time, Other, Advanced. Each option has an icon. An option that maps to another stored type shows it in parentheses ("Choice list (Single line text)").
- Behaviour: typing filters across groups; choosing closes the popover.
- Evidence: observed.

### fields.link-picker: find a target by search or paste a URL

- Intent: do point an item at a page of the store or an outside address.
- Use when: the target can be many resource types. Not when: one type only, see `fields.search`.
- Ask: Which resource types? [collections, products, pages, blog posts].
- Admin: Menu item inline row, seen 2026-11-16.
- Shape: input "Search or paste link" (30 high, padding 5 12, 13px). A popover opens under it (as wide as the input) with groups and counts: "Collections (2)", "Products (11)". Empty input shows no popover.
- Behaviour: groups expand to their results; pasting a URL accepts it as is.
- Evidence: measured (input).

### fields.code-editor: edit markup or templates as code

- Intent: change a template written in HTML and Liquid; keep or revert the default.
- Use when: the value is code or markup that merchants edit rarely and exactly. Not when: the value is prose, see `form.rich-text`; or a query with results, see `form.query-editor`.
- Ask: Which language and which variables are offered? [HTML with Liquid, a "Liquid variables" help card above]. Can the merchant revert? [yes, "Revert to default" link under the editor].
- Admin: Settings > Notifications > Customer notifications > a template (`/email_templates/<id>/edit`), seen 2026-11-16.
- Shape: a card with a labelled subject input, then the label "Email body (HTML)" and the editor. Editor 864x499, radius 8, no border, white, monospace 13px, line height 18.2px, line-number gutter 37px wide in grey (153,153,153), soft wrap on, own scrollbar. Operators and tags are coloured.
- States: dirty shows the page save bar; the header has a "Preview" button for a rendered check.
- Behaviour: lines wrap and keep their number; the editor scrolls inside itself, never the page.
- Copy: "Email subject", "Email body (HTML)", "Revert to default", "Liquid variables".
- Evidence: measured.

### fields.type-picker-categorized: pick a data type from grouped options

- Intent: choose what kind of value a field holds.
- Use when: more than about ten options fall into clear families. Not when: a short flat list, see `fields.select`.
- Ask: Which groups lead? [Recommended: Single line text, Multi-line text, Integer, Image (File)]. Single or list of values? ["One" select beside it].
- Admin: Settings > Custom data > Add definition > Field type, seen 2026-11-16.
- Shape: a select button labelled "Select field type" opens a listbox 340 wide under it; options 32px high, 13px; group headers: Recommended, Text, Media, Reference, Number, Link, Date and time, Other, Advanced (with items such as Rich text, File, Product, Money, Rating, URL, Color, JSON, Mixed reference). The chosen type shows in the button; some types show their base in brackets ("Email (Single line text)").
- Behaviour: arrow keys and Enter; picking a type changes the validation rules.
- Evidence: measured.
