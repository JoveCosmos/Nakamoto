"""constitution: the AtomOne constitution (constitution.md, the official text, unedited) as the
Constitution view's HTML fragment - a contents list and the reading column.

The text uses a small part of Markdown: '#' headings to four levels, paragraphs wrapped over
lines, '-' bullets nested by two spaces (a continuation line is indented under its bullet) and
**bold**. Anything else would come through as plain, escaped text, never as markup.

    html = constitution.fragment(md_text, meta)     meta: {repo, commit, date, url}
"""
import html, re


def _inline(s):
    s = html.escape(s, quote=False)
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)


def _slug(t, seen):
    base = "c-" + (re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")[:60] or "part")
    s, n = base, 2
    while s in seen:
        s, n = "%s-%d" % (base, n), n + 1
    seen.add(s)
    return s


def fragment(md, meta):
    lines = md.replace("\r\n", "\n").split("\n")
    out, toc, seen = [], [], set()
    para = []                       # lines of the paragraph being read
    stack = []                      # open <ul> levels (indent of each)
    item = None                     # the list item being read: [indent, text]
    in_terms = False

    def flush_para():
        if para:
            out.append("<p>" + _inline(" ".join(x.strip() for x in para)) + "</p>")
            para.clear()

    def flush_item():
        nonlocal item
        if item is not None:
            out.append("<li>" + _inline(item[1].strip()))
            item = None

    def close_lists(to=-1):
        # close <li>/<ul> down to (and not including) indent `to`
        while stack and stack[-1] > to:
            out.append("</li></ul>")
            stack.pop()

    def end_blocks():
        flush_para(); flush_item(); close_lists()

    for raw in lines:
        m = re.match(r"^(#{1,4})\s+(.*)$", raw)
        if m:
            end_blocks()
            lvl, text = len(m.group(1)), m.group(2).strip()
            if lvl == 1:
                continue                                   # the title: the view has its own
            sid = _slug(text, seen)
            in_terms = text.lower() == "defined terms"
            out.append('<h%d id="%s">%s</h%d>' % (lvl, sid, _inline(text), lvl))
            toc.append((lvl, sid, text))
            continue
        b = re.match(r"^( *)- (.*)$", raw)
        if b:
            flush_para(); flush_item()
            ind = len(b.group(1))
            if not stack or ind > stack[-1]:
                out.append('<ul%s>' % (' class=cn-terms' if in_terms and not stack else ''))
                stack.append(ind)
            else:
                close_lists(ind)
                out.append("</li>")                        # closes the previous sibling
            item = [ind, b.group(2)]
            continue
        if not raw.strip():
            flush_item() if item is not None else flush_para()
            continue
        if item is not None and raw.startswith(" " * (item[0] + 2)):
            item[1] += " " + raw.strip()                   # a bullet's continuation
            continue
        if stack:
            flush_item(); close_lists()
        para.append(raw)
    end_blocks()

    # a list item opened as "<li>text" is closed by the next "</li>" (a sibling) or "</li></ul>"
    # (the end of its list); a nested <ul> sits inside its parent item, as HTML wants
    body = "\n".join(out)

    nav = []
    for lvl, sid, text in toc:
        short = re.sub(r"^(Article \d+|Section [\w.]+):\s*", lambda k: k.group(1) + ": ", text)
        nav.append('<a class="cn-l%d" href="#%s" data-cn="%s">%s</a>' % (lvl, sid, sid, html.escape(short)))
    opts = "".join('<option value="%s">%s%s</option>' % (sid, " " * (lvl - 2), html.escape(text)) for lvl, sid, text in toc)
    src = ('The official text, <a href="%s" target=_blank rel="noopener noreferrer">%s</a>, commit <b>%s</b> of %s. Nothing here is edited.'
           % (html.escape(meta["url"]), html.escape(meta["repo"]), html.escape(meta["commit"][:7]), html.escape(meta["date"])))
    return ('<nav class=cn-toc aria-label="Contents"><em>Contents</em>' + "".join(nav) + '</nav>'
            '<div class=cn-art tabindex=0><div class=cn-in>'
            '<select class=cn-sel aria-label="Go to a part">' + opts + '</select>'
            '<header class=cn-hd><h1>The AtomOne Constitution</h1><p>' + src + '</p></header>'
            + body + '</div></div>')
