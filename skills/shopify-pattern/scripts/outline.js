// In-page outline: a compact tree under an element, to find where the parts of a pattern are before writing locators.
// One expression; call it as `(${src})(selectorOrText, maxLines)`. The first argument is a CSS selector, or `text:<regex>`
// to start from the last element holding that text, aria-label or placeholder and climb to the first ancestor at least 120 px high.
// Each line: tag.firstClass x,y,w,h "own text" @aria-label, positions from the root's corner; `#shadow` marks a shadow host.
(start, max) => {
  const kids = (n) => (n.shadowRoot ? [...n.shadowRoot.children, ...n.children] : [...n.children]);
  const own = (n) =>
    [...n.childNodes]
      .filter((x) => x.nodeType === 3)
      .map((x) => x.textContent.trim())
      .filter(Boolean)
      .join(" ");
  const all = [];
  const collect = (n) => {
    for (const c of kids(n)) {
      all.push(c);
      collect(c);
    }
  };
  collect(document.body);
  let root;
  if (start.startsWith("text:")) {
    const re = new RegExp(start.slice(5), "i");
    root = all.findLast(
      (e) =>
        (re.test(own(e)) ||
          re.test(e.getAttribute("aria-label") || "") ||
          re.test(e.getAttribute("placeholder") || "")) &&
        e.getBoundingClientRect().width,
    );
    while (root && root.getBoundingClientRect().height < 120) root = root.parentElement || root.getRootNode().host;
  } else root = all.find((e) => e.matches(start) && e.getBoundingClientRect().width);
  if (!root) return `no element for ${start}`;
  const o = root.getBoundingClientRect();
  const lines = [];
  const walk = (n, d) => {
    if (lines.length >= (max || 60) || n.tagName === "STYLE" || n.tagName === "SCRIPT" || n.tagName === "path") return;
    const r = n.getBoundingClientRect();
    if (r.width || r.height) {
      const cls = typeof n.className === "string" && n.className ? "." + n.className.split(" ")[0].slice(0, 32) : "";
      const text = own(n).slice(0, 28);
      const label = n.getAttribute("aria-label");
      lines.push(
        `${" ".repeat(d)}${n.tagName.toLowerCase()}${cls} ${Math.round(r.x - o.x)},${Math.round(r.y - o.y)},${Math.round(r.width)},${Math.round(r.height)}${text ? ` "${text}"` : ""}${label ? ` @${label.slice(0, 24)}` : ""}${n.shadowRoot ? " #shadow" : ""}`,
      );
    }
    for (const c of kids(n)) walk(c, d + 1);
  };
  walk(root, 0);
  return lines.join("\n");
};
