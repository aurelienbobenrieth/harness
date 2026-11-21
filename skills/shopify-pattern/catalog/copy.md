# Copy

The merchant wants to read wording that sounds like the Shopify admin: short, plain, consistent, and formatted the way the admin formats it. Every entry here comes from the published guidelines and the official pattern examples; check the live admin before treating one as measured.

### copy.button-label: name a button or action

- Intent: learn what a button does before clicking; do the action.
- Use when: writing a button, a menu action or a page action. Not when: the text is a link inside a sentence, see `copy.link-text`.
- Admin: Shopify dev docs > App design > Navigation and Content (`https://shopify.dev/docs/apps/design/navigation`), seen 2026-11-16.
- Shape: sentence case, start with a strong verb, active voice, `{verb} + {noun}`, or just the verb when the context is clear ("Rename", "Edit", "Duplicate").
- Behaviour: one primary action per page, the task merchants most often come to do; all others are secondary. A destructive confirm button repeats the action ("Delete").
- Copy: "Create template", "Export templates", "Upload image", "Browse templates", "Bulk edit". One term per action: "Upload image", not "Add photos". Same wording for the same action ("Delete product", "Delete collection"). Not a question or a toggle phrased as a question ("Reset password", not "Forgot password?").
- Evidence: docs, https://shopify.dev/docs/apps/design/content/grammar-and-mechanics

### copy.page-title: title a page or a section

- Intent: learn what the page is for; find the right section.
- Use when: writing a page title, a section `heading` or a card title. Not when: the text explains a field, see `copy.help-text`.
- Admin: Shopify dev docs > App design > Navigation > Page title (`https://shopify.dev/docs/apps/design/navigation`), seen 2026-11-16.
- Shape: short, describes the page's general purpose, one purpose per page. Sentence case, one sentence, no ending period, comma, semicolon or exclamation mark. Informative, concise and scannable. Section name goes in `heading`, supporting text in `subheading`, not in a paragraph above or inside the card.
- Behaviour: do not repeat the title under the title bar (duplicate content). Conversational areas (home cards, empty states) may use articles.
- Copy: "Sell your products in person", "Secure your account with two-step authentication", "Create purchase order".
- Evidence: docs, https://shopify.dev/docs/apps/design/content/grammar-and-mechanics

### copy.help-text: explain a field or a section

- Intent: learn what a field or a group does and why it matters.
- Use when: a field or a section needs a reason or a hint. Not when: the text reports a problem, see `copy.error-message`.
- Admin: Shopify dev docs > App design > Content > Voice and tone (`https://shopify.dev/docs/apps/design/content/voice-and-tone`), seen 2026-11-16.
- Shape: say the why and how, not only the instruction; give enough information for the merchant to decide; no filler such as "Add a note..."; specific benefits, not overstated.
- Behaviour: one sentence has no ending period; two or more sentences take periods. Section help goes in `subheading`.
- Copy: "Add products to collections so they're easy to find" (no period, one sentence). Do not write "You need to add at least 10 products before opening your store".
- Evidence: docs, https://shopify.dev/docs/apps/design/content/voice-and-tone

### copy.placeholder: write placeholder text

- Intent: see an example of the value; not to read instructions.
- Use when: a field needs a sample value. Not when: the text is the only label, see `fields.anatomy`.
- Admin: Shopify dev docs > App design > Content > Grammar and mechanics > Ellipses (`https://shopify.dev/docs/apps/design/content/grammar-and-mechanics`), seen 2026-11-16.
- Shape: short and plain; avoid ellipses in placeholder text or trailing off.
- Copy: "Search files", not "Start typing to search for files...". Pattern examples use "Search puzzles", "you@example.com".
- Evidence: docs, https://shopify.dev/docs/apps/design/content/grammar-and-mechanics

### copy.error-message: write an error that helps

- Intent: learn what went wrong and how to fix it.
- Use when: a field, a form or an action failed. Not when: the app knows how to fix it, resolve it automatically; not when it is a routine success, see `copy.toast-text`.
- Admin: Shopify dev docs > App design > User experience > Alerts, and Content > Voice and tone (`https://shopify.dev/docs/apps/design/user-experience/alerts`), seen 2026-11-16.
- Shape: say what happened, then the path forward. Plain, no jargon, humour or idioms. Do not use "bad request", "forbidden", "fatal", "unresolved", "invalid". No error codes unless merchants recognise them and they help.
- Behaviour: inline error sits directly under the field and shows after focus leaves it. Critical banners only for must-fix-now problems, with troubleshooting steps and a way to get support.
- Copy: "Product weight needs to be positive. Change the product weight to be greater than or equal to 0 and try again."
- Evidence: docs, https://shopify.dev/docs/apps/design/content/voice-and-tone

### copy.empty-state-text: invite the first action

- Intent: learn why the list is empty and what to do first.
- Use when: a list or page has no records yet. Not when: a filter matched nothing, see `feedback.no-results`.
- Admin: Shopify dev docs > API > App Home > Patterns > Index (`https://shopify.dev/docs/api/app-home/latest/patterns/templates/resource-index`), seen 2026-11-16.
- Shape: heading, one supporting sentence in `subheading`, a primary button and optionally a secondary one. Articles are allowed here.
- Copy: buttons "Create product", "Browse products"; after creating, toast "Product created". Explain why the task matters before asking for the action; do not promise outcomes ("You're just a few steps away from receiving your first order").
- Evidence: docs, https://shopify.dev/docs/api/app-home/latest/patterns/templates/resource-index

### copy.destructive-confirmation: confirm a delete or a disconnect

- Intent: learn what will be lost; confirm or cancel.
- Use when: an action removes data or an integration. Not when: the change can be undone in place, see `feedback.toast-when`.
- Admin: Shopify dev docs > API > App Home > Patterns > Index table and Account connection (`https://shopify.dev/docs/api/app-home/latest/patterns/compositions/index-table`), seen 2026-11-16.
- Shape: title is a question naming the object, body asks once and states the consequence, then Cancel and a critical primary that repeats the action.
- Copy: "Delete 2 puzzles?", "Are you sure you want to delete the selected puzzles? This action cannot be undone."; "Disconnect account?", "Are you sure you want to disconnect your Puzzlify account? You'll need to reconnect to continue syncing data."; a warning banner may add "Any pending syncs will be cancelled and your integration settings will be removed."; buttons "Delete", "Disconnect", "Cancel". Merchant input in quotes: Are you sure you want to delete "cat shirt"?
- Evidence: docs, https://shopify.dev/docs/api/app-home/latest/patterns/compositions/account-connection

### copy.banner-text: write a banner

- Intent: learn something that stays visible and what to do about it.
- Use when: the message is page level, delayed or persistent. Not when: it is a short confirmation, see `copy.toast-text`.
- Admin: Shopify dev docs > App design > User experience > Alerts (`https://shopify.dev/docs/apps/design/user-experience/alerts`), seen 2026-11-16.
- Shape: a heading plus a short body. Info banners hold low priority content and are dismissible. Success banners only when feedback is delayed, persistent or has a CTA, with next steps. Warning banners sparingly. Error banners say what happened and offer a path forward. Do not tell merchants how to feel.
- Behaviour: a dismissed banner does not return in the same session. One banner visible at a time on the homepage.
- Copy: for serious problems explain the impact without scary words: "Some of today's sales data hasn't been updated yet. This will be fixed shortly."
- Evidence: docs, https://shopify.dev/docs/apps/design/content/voice-and-tone

### copy.toast-text: confirm a quick result

- Intent: learn that a routine action worked.
- Use when: the action is routine and non-critical. Not when: the merchant needs the information later, see `copy.banner-text`.
- Admin: Shopify dev docs > App design > User experience > Alerts (`https://shopify.dev/docs/apps/design/user-experience/alerts`), seen 2026-11-16.
- Shape: three words or fewer; simple and unobtrusive; words are optional ("Consider confirming without words").
- Behaviour: for success only; errors use a toast only when persistent, such as a connection error.
- Copy: "Product saved.", "Card dismissed", "Customer archived". Do not write "You successfully added a product" or "Congrats!". Pattern examples also use "Account connected successfully" and "Step 1 completed!", which are longer than three words.
- Evidence: docs, https://shopify.dev/docs/apps/design/content/voice-and-tone
- Docs differ: the alerts page says three words or fewer, but its pattern examples use longer toasts, https://shopify.dev/docs/api/app-home/latest/patterns/compositions/account-connection.

### copy.dates-times: write a date or a time

- Intent: read when something happened.
- Use when: any date, time, range or timestamp appears. Not when: the value is empty, see `feedback.empty-value`.
- Admin: Shopify dev docs > App design > Content > Grammar and mechanics (`https://shopify.dev/docs/apps/design/content/grammar-and-mechanics`), seen 2026-11-16.
- Shape: full month or a three-letter abbreviation when tight, no ordinals, never numerals only. 12-hour clock with a space before am or pm. Date and time joined with "at". Ranges use an en dash. Add a time zone only when needed, after the time.
- Behaviour: use `Intl.DateTimeFormat` for localisation when possible. Time zone letters S or D only for mixed audiences.
- Copy: "December 11, 2024", "Dec 11, 2024", "January 23–April 1", "12:35 pm", "3:00 pm–4:00 pm", "Thursday, October 15, 2015 at 2:00 pm EDT", "Just now", "13 minutes ago", "Yesterday at 10:30 am", "Aug 14, 2016" for dates over one year old. Not "12/11/24", not "January 23rd".
- Evidence: docs, https://shopify.dev/docs/apps/design/content/grammar-and-mechanics

### copy.numbers-money: write numbers, money and units

- Intent: read a quantity, an amount or a measure.
- Use when: any number, price, range or unit appears. Not when: choosing how to chart it, see `data.line-chart`.
- Admin: Shopify dev docs > App design > Content > Grammar and mechanics (`https://shopify.dev/docs/apps/design/content/grammar-and-mechanics`), seen 2026-11-16.
- Shape: numerals ("5 orders", not "five"), commas from four digits, never shortened ("12 k" is wrong). Ranges with an en dash and no spaces; upward "and up" or "or more"; downward ranges specific ("$0.00–$49.99"). Currency after the amount. A space between a number and its unit, units never plural, decimals not fractions, unit last for several dimensions, per unit with no spaces around the slash.
- Copy: "12,000", "5–10 products", "$50.00 and up", "$10,000 USD" (not "USD$10,000"), "3.4 lb", "4 lb", "11.875 × 3.375 × 13.625 cm", "$100/m". Percentages are not covered by the guidelines; pattern examples write "3.2%".
- Evidence: docs, https://shopify.dev/docs/apps/design/content/grammar-and-mechanics

### copy.capitalization: capitalise words

- Intent: read labels that look like the admin's.
- Use when: writing any heading, button, card title, menu item or email subject. Not when: it is a proper noun that is already capitalised.
- Admin: Shopify dev docs > App design > Content > Grammar and mechanics (`https://shopify.dev/docs/apps/design/content/grammar-and-mechanics`), seen 2026-11-16.
- Shape: sentence case for headings, subheadings, buttons, card titles. Capitalise proper and trademarked nouns ("Shopify Payments"), brands, countries, people. Lowercase general features ("blogs", "navigation", "admin") and the first letter after a slash ("ZIP/postal code"). Capitalise the first letter of each list item. No bold for headings, proper nouns, merchant input or checkbox titles.
- Copy: "Create purchase order".
- Evidence: docs, https://shopify.dev/docs/apps/design/content/grammar-and-mechanics

### copy.link-text: write a link

- Intent: know where a link goes before following it.
- Use when: a sentence or footer carries a link. Not when: the link is a row that navigates, see `navigation.settings-link-list`.
- Admin: Shopify dev docs > App design > Content > Grammar and mechanics (`https://shopify.dev/docs/apps/design/content/grammar-and-mechanics`), seen 2026-11-16.
- Shape: avoid links when possible. Never "click here" or "here". Use an info icon for short standalone information, an inline link in a sentence, or a "learn more" link for longer content. At most one "learn more" per screen. Punctuation stays outside the link, except a question mark.
- Behaviour: link text alone states the destination; warn when it opens a new window (accessibility page).
- Copy: "Learn more about creating puzzles." with only "creating puzzles" linked.
- Evidence: docs, https://shopify.dev/docs/api/app-home/latest/patterns/compositions/footer-help

### copy.terms-to-avoid: words and punctuation to drop

- Intent: read copy without friction.
- Use when: reviewing any string. Not when: the term is a name merchants already use.
- Admin: Shopify dev docs > App design > Content (`https://shopify.dev/docs/apps/design/content`), seen 2026-11-16.
- Shape: no jargon or idioms; no "every", "all" or "most" about success; no "bad request", "forbidden", "fatal", "invalid"; no "successfully" for simple actions; no "Congrats!" for routine tasks; no "click here". No ampersands ("Zones and rates"). Avoid exclamation marks (at most one per page), question marks, semicolons and colons in sentences. No emoji in the nav menu.
- Copy: use "you" for the merchant; "I" only for consent ("I agree to the terms and conditions"); first mention of the app by its proper name, then "we".
- Evidence: docs, https://shopify.dev/docs/apps/design/content/voice-and-tone
- Docs differ: the pattern examples use "Step 1 completed!" despite the exclamation rule, https://shopify.dev/docs/api/app-home/latest/patterns/compositions/setup-guide.

### copy.tone-per-situation: match tone to the moment

- Intent: read a message whose tone fits what just happened.
- Use when: choosing how warm, direct or brief a message is. Not when: formatting only, see `copy.capitalization`.
- Admin: Shopify dev docs > App design > Content > Voice and tone (`https://shopify.dev/docs/apps/design/content/voice-and-tone`), seen 2026-11-16.
- Shape: voice stays constant (real, proactive, dynamic, guiding, never pushy or prescriptive); tone changes. Everyday tasks: simplest words. Learning: explain why before asking. Simple errors: problem plus fix. Completion: simple, unobtrusive thanks only for tasks you required. Motivating: next step and why, no promised outcomes. Serious problems: impact without scary language, apologise within reason, give steps. Announcements: what it is, specific benefits, "Remind me later". Celebrations: rare, significant milestones.
- Copy: "Thanks for taking the time to share your feedback."; "Your store is 1 year old today! Here's to many more."; "Based on your type of business, this is the POS hardware we recommend."; not "Create a new campaign and you could double your sales this holiday season."
- Evidence: docs, https://shopify.dev/docs/apps/design/content/voice-and-tone

### copy.lists: write a list or a menu

- Intent: scan several items.
- Use when: bullets, numbered steps, or menu entries. Not when: the items are steps with illustrations, see `onboarding.numbered-steps`.
- Admin: Shopify dev docs > App design > Content > Grammar and mechanics (`https://shopify.dev/docs/apps/design/content/grammar-and-mechanics`), seen 2026-11-16.
- Shape: bullets when order does not matter, numbers when it does. Introduce with a full sentence ending in a colon. Capitalise each item; no commas at the end; punctuate every item only if one has two or more sentences; do not mix words and full sentences. Menu actions `{verb} + {noun}`, ordered most popular first; menu nouns concise and ordered logically (most recent first).
- Copy: "Today", "Yesterday", "This week"; "Rename", "Edit", "Duplicate".
- Evidence: docs, https://shopify.dev/docs/apps/design/content/grammar-and-mechanics

### copy.plain-language: keep copy plain and scannable

- Intent: understand quickly.
- Use when: writing any paragraph. Not when: legal text that must be exact.
- Admin: Shopify dev docs > App design > Content (`https://shopify.dev/docs/apps/design/content`), seen 2026-11-16.
- Shape: headings, bullets and short sentences. Aim for about a United States grade 7 reading level. No large blocks of text, no idioms. One noun, verb or phrase per concept. Break complicated tasks into steps that each focus on one action. Guide, do not prescribe. Do not duplicate content or show the same content two ways on one page. Hyphenate compound modifiers before a noun ("high-risk order"), never "ecommerce" or "email" with a hyphen. American spelling ("Color", "Canceled").
- Evidence: docs, https://shopify.dev/docs/apps/design/content

### copy.truncation: shorten text that does not fit

- Intent: see the part of a long value that matters.
- Use when: a title, name or value exceeds its space. Not when: the value should wrap to a second line.
- Admin: Shopify dev docs > App design > Content > Grammar and mechanics (`https://shopify.dev/docs/apps/design/content/grammar-and-mechanics`), seen 2026-11-16.
- Shape: decide by the space and by what merchants need most; usually keep the beginning or end and cut the middle. Use the ellipsis character, not three periods. An ellipsis-icon button (not text) expands more actions, typically in cards or limited action sets.
- Behaviour: app nav items from the seventh go under "View more"; app names over 20 characters are truncated.
- Evidence: docs, https://shopify.dev/docs/apps/design/navigation

### copy.locale: format text for the merchant's locale

- Intent: read addresses, names and measures in a local form.
- Use when: the app shows an address, a country, units or dates to several markets. Not when: the app targets one locale only.
- Admin: Shopify dev docs > App design > Content > Grammar and mechanics (`https://shopify.dev/docs/apps/design/content/grammar-and-mechanics`), seen 2026-11-16.
- Shape: address fields in order first and last name, address, optional apartment or suite, city, country or province, postal code; keep "(optional)" on the optional field; locale labels ("State" and "ZIP code" in the US). Country as a noun uses the full name; as an adjective the abbreviation without punctuation ("US currency"). Imperial units for the US, Liberia and Myanmar, metric elsewhere. Use `Intl.DateTimeFormat`. American spelling for merchant-facing text.
- Copy: "Your store must be located in the United States."
- Evidence: docs, https://shopify.dev/docs/apps/design/content/grammar-and-mechanics
