// In-page probe: the named parts of a pattern and the few values that define them.
// One expression; call it as `(${src})(parts, rootName)`. Same code in the admin (T3 preview_evaluate)
// and in our app (Playwright frame.evaluate), so a value sheet and our screen compare value for value.
// parts: { name: locator }. locator = deep CSS selector, or
//   { sel, text, in, nth, up, closest }: `sel` pierces shadow roots (default "*"), `text` is a regex tested on
//   the element's own text or aria-label, `in` scopes to another part, `nth` picks a match (default 0, -1 last),
//   `up` climbs n parents, `closest` climbs to a selector, `pseudo` ("::before") reads a pseudo-element.
//   A list of locators is tried in order (an element first, a pseudo-element as fallback).
// rootName: the part x and y are measured from (default: the viewport).
(parts, rootName) => {
  const kids = (n) => (n.shadowRoot ? [...n.shadowRoot.children, ...n.children] : [...n.children]);
  const all = (root) => {
    const out = [];
    const walk = (n) => {
      for (const c of kids(n)) {
        out.push(c);
        walk(c);
      }
    };
    walk(root);
    return out;
  };
  const own = (el) =>
    [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .filter(Boolean)
      .join(" ");
  // A `display: contents` host has no box but still carries text and inherited type.
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 || r.height > 0 || getComputedStyle(el).display === "contents";
  };
  const parent = (el) => el.parentElement || (el.getRootNode() && el.getRootNode().host) || null;
  const found = {};
  const chosen = {};
  const locate = (name, seen = []) => {
    if (name in found) return found[name];
    if (seen.includes(name) || !(name in parts)) return null;
    for (const raw of Array.isArray(parts[name]) ? parts[name] : [parts[name]]) {
      const loc = typeof raw === "string" ? { sel: raw } : raw || {};
      const el = find(loc, name, seen);
      if (el && (!loc.pseudo || getComputedStyle(el, loc.pseudo).content !== "none")) {
        chosen[name] = loc;
        return (found[name] = el);
      }
    }
    return (found[name] = null);
  };
  const find = (loc, name, seen) => {
    const scope = loc.in ? locate(loc.in, [...seen, name]) : document.body;
    let el = null;
    if (scope) {
      const re = loc.text ? new RegExp(loc.text, "i") : null;
      const hits = all(scope).filter((e) => {
        if (e.tagName === "STYLE" || e.tagName === "SCRIPT" || !visible(e)) return false;
        if (loc.sel && !e.matches(loc.sel)) return false;
        return !re || re.test(own(e)) || re.test(e.getAttribute("aria-label") || "");
      });
      el = hits[loc.nth < 0 ? hits.length + loc.nth : loc.nth || 0] || null;
      for (let i = 0; el && i < (loc.up || 0); i++) el = parent(el);
      if (el && loc.closest) {
        let c = el;
        while (c && !c.matches(loc.closest)) c = parent(c);
        el = c;
      }
    }
    return el;
  };
  const px = (v) =>
    v
      .split(" ")
      .map((p) => (p.endsWith("px") ? String(Math.round(parseFloat(p) * 10) / 10) : p))
      .join(" ");
  const colour = (v) => {
    const m = v.match(/^rgba?\(([^)]+)\)$/);
    if (!m) return v;
    const [r, g, b, a] = m[1]
      .split(/[,\s/]+/)
      .filter(Boolean)
      .map(Number);
    if (a === 0) return "none";
    const hex = "#" + [r, g, b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("");
    return a === undefined || a === 1 ? hex : `${hex}/${Math.round(a * 100)}`;
  };
  const rootEl = rootName ? locate(rootName) : null;
  const o = rootEl ? rootEl.getBoundingClientRect() : { x: 0, y: 0, right: innerWidth };
  const out = {};
  for (const name of Object.keys(parts)) {
    const el = locate(name);
    if (!el) {
      out[name] = null;
      continue;
    }
    const pseudo = chosen[name].pseudo;
    if (pseudo) {
      const p = getComputedStyle(el, pseudo);
      out[name] = {
        w: Math.round(parseFloat(p.width)),
        h: Math.round(parseFloat(p.height)),
        bg: colour(p.backgroundColor),
        radius: px(p.borderRadius),
      };
      continue;
    }
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    const v = {
      x: Math.round(r.x - o.x),
      y: Math.round(r.y - o.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
      right: Math.round(o.right - r.right),
    };
    v.font = `${px(s.fontSize)}/${px(s.lineHeight)} ${s.fontWeight}`;
    v.color = colour(s.color);
    v.bg = colour(s.backgroundColor);
    if (s.backgroundImage !== "none") v.bgImage = s.backgroundImage.replace(/rgba?\([^)]+\)/g, colour).slice(0, 160);
    v.radius = px(s.borderRadius);
    v.pad = px(s.padding);
    if (s.gap !== "normal") v.gap = px(s.gap);
    // A hairline reads 0.7px on a scaled screen: border widths are whole pixels, at least 1.
    if (parseFloat(s.borderTopWidth) || parseFloat(s.borderBottomWidth))
      v.border = `${Math.max(1, Math.round(parseFloat(s.borderTopWidth) || parseFloat(s.borderBottomWidth)))} ${colour(parseFloat(s.borderTopWidth) ? s.borderTopColor : s.borderBottomColor)}`;
    v.shadow = s.boxShadow === "none" ? "none" : "yes";
    if (s.opacity !== "1") v.opacity = s.opacity;
    const t = own(el) || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "";
    if (t) v.text = t.slice(0, 60);
    v.tag = el.tagName.toLowerCase();
    out[name] = v;
  }
  return out;
};
