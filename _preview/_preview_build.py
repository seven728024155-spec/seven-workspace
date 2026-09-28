#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Minimal Liquid preprocessor for previewing the Jekyll site locally.
Handles the subset of Liquid constructs used by this site:
  - {{ var }}
  - {{ var | filter }}
  - {{ 'literal' | filter }}
  - {% if cond %}{% else %}{% endif %}
  - {% for x in collection %}...{% endfor %}
  - filters: relative_url, size, date (with strftime), date_to_xmlschema, default
"""

import os
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path
import html as html_mod

ROOT = Path(__file__).parent
OUT = ROOT / "_preview"

POSTS_DIR = ROOT / "_posts"
LAYOUTS_DIR = ROOT / "_layouts"
SITE_TITLE = "seven 的工作空间"
SITE_DESC = "Seven 的个人工作空间——文章、笔记、可下载资源。一个慢慢搭建的数字角落。"
SITE_BASEURL = ""  # 本地预览不使用 baseurl；Jekyll 实际部署时按 _config.yml 注入


def parse_front_matter(text):
    """Parse YAML front-matter; returns (meta_dict, body)."""
    if not text.startswith("---"):
        return {}, text
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}, text
    meta_text = parts[1].strip()
    body = parts[2].lstrip("\n")
    meta = {}
    current_list_key = None
    for line in meta_text.splitlines():
        if not line.strip() or line.strip().startswith("#"):
            continue
        if line.startswith("  - ") and current_list_key:
            meta[current_list_key].append(line.strip()[2:].strip().strip("[]").strip())
            continue
        if ":" in line:
            key, _, value = line.partition(":")
            key = key.strip()
            value = value.strip()
            if value == "":
                meta[key] = []
                current_list_key = key
            elif value.startswith("[") and value.endswith("]"):
                inner = value[1:-1].strip()
                if not inner:
                    meta[key] = []
                else:
                    # naive split
                    meta[key] = [s.strip() for s in inner.split(",")]
            elif value in ("true", "false"):
                meta[key] = (value == "true")
            else:
                meta[key] = value.strip().strip('"').strip("'")
                current_list_key = None
    return meta, body


def load_posts():
    posts = []
    if not POSTS_DIR.exists():
        return posts
    for f in sorted(POSTS_DIR.glob("*.md"), reverse=True):
        meta, body = parse_front_matter(f.read_text(encoding="utf-8"))
        date_str = meta.get("date", "")
        try:
            d = datetime.strptime(str(date_str)[:19].strip(), "%Y-%m-%d %H:%M:%S")
        except Exception:
            try:
                d = datetime.strptime(str(date_str)[:10].strip(), "%Y-%m-%d")
            except Exception:
                d = datetime.now()
        meta["_date_obj"] = d
        meta["_filename"] = f.name
        meta["_body"] = body
        # permalink like /:year/:month/:day/:title.html
        slug = f.stem
        if len(slug) > 11 and slug[10] == "-":
            slug = slug[11:]
        meta["_slug"] = slug
        meta["_permalink"] = f"/{d.year}/{d.month:02d}/{d.day:02d}/{slug}.html"
        posts.append(meta)
    return posts


def clean_yaml_value(v):
    v = v.strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
        return v[1:-1]
    return v


def load_data():
    """读取 _data/*.yml → {key: [ {...}, ... ]}。
    只支持顶层为列表的简单 YAML（够 songs.yml 用）。"""
    data = {}
    data_dir = ROOT / "_data"
    if not data_dir.exists():
        return data
    for f in sorted(data_dir.glob("*.yml")):
        items = []
        current = None
        for raw in f.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("- "):
                if current is not None:
                    items.append(current)
                current = {}
                rest = line[2:].strip()
                if ":" in rest:
                    k, _, v = rest.partition(":")
                    current[k.strip()] = clean_yaml_value(v)
                continue
            if current is not None and ":" in line:
                k, _, v = line.partition(":")
                current[k.strip()] = clean_yaml_value(v)
        if current is not None:
            items.append(current)
        data[f.stem] = items
    return data


# 站点数据（_data/*.yml），供 Liquid 的 site.data.xxx 使用
SITE_DATA = load_data()


# ---------- Liquid engine ----------
class LiquidEngine:
    def __init__(self, posts, page_meta=None, page_url=""):
        self.posts = posts
        self.page_meta = page_meta or {}
        self.page_url = page_url
        self.scope_stack = [{}]

    def current_scope(self):
        return self.scope_stack[-1]

    def lookup(self, name):
        # look up the dotted name through scope chain
        for scope in reversed(self.scope_stack):
            if name in scope:
                return scope[name]
            if "." in name:
                root, _, rest = name.partition(".")
                if root in scope and scope[root] is not None:
                    val = scope[root]
                    try:
                        for part in rest.split("."):
                            if isinstance(val, dict):
                                val = val.get(part)
                            else:
                                val = getattr(val, part, None)
                            if val is None:
                                break
                        if val is not None:
                            return val
                    except Exception:
                        pass
        # fall back to known vars
        if name == "site.title": return SITE_TITLE
        if name == "site.description": return SITE_DESC
        if name == "site.url": return "https://seven728024155-spec.github.io"
        if name == "site.baseurl": return SITE_BASEURL
        if name == "site.posts": return self.posts
        if name.startswith("site.data."):
            return SITE_DATA.get(name[len("site.data."):], [])
        if name == "page.title": return self.page_meta.get("title", SITE_TITLE)
        if name == "page.description": return self.page_meta.get("description", SITE_DESC)
        if name == "page.url": return self.page_url
        return ""

    def apply_filter(self, value, filt, arg=None):
        if filt == "relative_url":
            if isinstance(value, str) and value.startswith("/"):
                return SITE_BASEURL + value
            return value
        if filt == "size":
            try:
                return len(value)
            except Exception:
                return 0
        if filt == "date":
            try:
                if isinstance(value, datetime):
                    d = value
                else:
                    s = str(value)[:19].strip()
                    try:
                        d = datetime.strptime(s, "%Y-%m-%d %H:%M:%S")
                    except Exception:
                        try:
                            d = datetime.strptime(s, "%Y-%m-%d")
                        except Exception:
                            d = datetime.now()
                fmt = arg or "%Y-%m-%d"
                return d.strftime(fmt)
            except Exception:
                return str(value)
        if filt == "date_to_xmlschema":
            try:
                if isinstance(value, datetime):
                    d = value
                else:
                    s = str(value)[:19].strip()
                    d = datetime.strptime(s, "%Y-%m-%d %H:%M:%S")
                return d.strftime("%Y-%m-%dT%H:%M:%S") + "+08:00"
            except Exception:
                return str(value)
        if filt == "default":
            return value if value not in (None, "", []) else (arg or "")
        if filt == "escape":
            return html_mod.escape(str(value)) if value is not None else ""
        if filt == "strip":
            return str(value).strip() if value is not None else ""
        if filt == "append":
            return str(value) + (arg or "")
        if filt == "prepend":
            return (arg or "") + str(value)
        if filt == "upcase":
            return str(value).upper()
        if filt == "downcase":
            return str(value).lower()
        return value

    # --- expression parser ---
    VAR_RE = re.compile(r"{{\s*(.+?)\s*}}")
    TAG_RE = re.compile(r"{%\s*(.+?)\s*%}")

    def render_value(self, expr):
        # returns the raw value (or filtered value if filter specified)
        expr = expr.strip()
        if expr == "empty":
            return []
        # 支持 "obj.attr.size" 这种隐式 size 滤镜（Liquid 习惯写法）
        size_suffixes = (".size", ".length", ".size")
        for suffix in size_suffixes:
            if expr.endswith(suffix):
                base = expr[:-len(suffix)]
                base_val = self.lookup(base)
                if isinstance(base_val, (list, str, dict)):
                    return len(base_val)
                # 否则回退到正常路径
                break
        parts = re.split(r"\s*\|\s*", expr)
        first = parts[0]
        # resolve "literal string"
        m = re.match(r'^"(.*)"$', first) or re.match(r"^'(.*)'$", first)
        if m:
            val = m.group(1)
        else:
            val = self.lookup(first)
        for f in parts[1:]:
            f = f.strip()
            arg = None
            if ":" in f:
                fname, _, farg = f.partition(":")
                fname = fname.strip()
                farg = farg.strip()
                if farg.startswith('"') and farg.endswith('"'):
                    arg = farg[1:-1]
                elif farg.startswith("'") and farg.endswith("'"):
                    arg = farg[1:-1]
                else:
                    arg = self.lookup(farg)
                f = fname
            else:
                f = f
            val = self.apply_filter(val, f, arg)
        return val

    def eval_condition(self, expr):
        expr = expr.strip()
        # simple comparison: A op B
        for op in ["==", "!=", ">=", "<=", ">", "<"]:
            if op in expr:
                left, _, right = expr.partition(op)
                lv = self._simple_value(left)
                rv = self._simple_value(right)
                try:
                    if op == "==": return lv == rv
                    if op == "!=": return lv != rv
                    if op == ">=": return lv >= rv
                    if op == "<=": return lv <= rv
                    if op == ">":  return lv > rv
                    if op == "<":  return lv < rv
                except Exception:
                    return False
        # truthiness
        v = self._simple_value(expr)
        if v is None: return False
        if isinstance(v, (list, str)) and len(v) == 0: return False
        if isinstance(v, int) and v == 0: return False
        if v == "": return False
        return True

    def _simple_value(self, s):
        s = s.strip()
        if s in ("empty",):
            return []
        m = re.match(r'^"(.*)"$', s) or re.match(r"^'(.*)'$", s)
        if m:
            return m.group(1)
        if s.isdigit():
            return int(s)
        # 支持 a.b.c | filter 形式（用于 if 条件中）
        if "|" in s:
            return self.render_value(s)
        # 支持 a.b.size / a.b.length 这种隐式 size 滤镜
        for suffix in (".size", ".length"):
            if s.endswith(suffix):
                base = s[:-len(suffix)]
                base_val = self.lookup(base)
                if isinstance(base_val, (list, str, dict)):
                    return len(base_val)
                break
        return self.lookup(s)

    def render(self, template):
        # 1. 先把所有 {% if %}{% endif %} 等块结构处理掉
        template = self._process_blocks(template)
        # 2. 再替换 {{ ... }} 输出
        def repl(m):
            v = self.render_value(m.group(1))
            if v is None: return ""
            if isinstance(v, bool): return ""
            if isinstance(v, (list, dict)): return str(len(v))
            return str(v)
        out = self.VAR_RE.sub(repl, template)
        return out

    def _substitute_vars(self, template):
        """Replace {{ ... }} while current scope is in place.
        Use inside {% for %} iterations where render()'s post-block substitution
        would run after the loop's scope was popped."""
        def repl(m):
            v = self.render_value(m.group(1))
            if v is None: return ""
            if isinstance(v, bool): return ""
            if isinstance(v, (list, dict)): return str(len(v))
            return str(v)
        return self.VAR_RE.sub(repl, template)

    def _process_blocks(self, template):
        # 循环展开 + if/else 删枝
        # 先 for，后 if
        template = self._expand_for(template)
        template = self._expand_if(template)
        return template

    def _find_matching(self, text, start, tag_kind):
        # tag_kind: 'for' or 'if'
        # returns end index of matching {% endfor %} or {% endif %}
        open_tag = f"{{% {tag_kind} "
        close_tag = "{% endif %}" if tag_kind == "if" else "{% endfor %}"
        depth = 1
        i = start
        while i < len(text):
            n_open = text.find(open_tag, i)
            n_close = text.find(close_tag, i)
            if n_close == -1:
                return -1
            if n_open != -1 and n_open < n_close:
                depth += 1
                i = n_open + len(open_tag)
            else:
                depth -= 1
                if depth == 0:
                    return n_close
                i = n_close + len(close_tag)
        return -1

    def _expand_for(self, template):
        # find {% for x in coll %}...{% endfor %}
        pattern = re.compile(r"{%\s*for\s+(\w+)\s+in\s+(\S+?)(?:\s+limit:\s*(\d+))?\s*%}")
        while True:
            m = pattern.search(template)
            if not m: break
            var = m.group(1)
            coll_expr = m.group(2)
            limit = int(m.group(3)) if m.group(3) else None
            start = m.end()
            end = self._find_matching(template, start, "for")
            if end == -1: break
            inner = template[start:end]
            coll = self.lookup(coll_expr) or []
            out = []
            count = 0
            for item in coll if isinstance(coll, list) else []:
                if limit is not None and count >= limit:
                    break
                self.scope_stack.append({var: item})
                # 给文章特殊处理：site.posts 的对象，提供 page 风格的字段
                if isinstance(item, dict) and "_permalink" in item:
                    # post-like
                    self.scope_stack[-1]["post"] = item
                    # 同步 title/date/tags 等
                    self.scope_stack[-1]["page"] = item
                    # 提供 url 过滤友好的字段
                    item.setdefault("title", item.get("_slug", ""))
                    item.setdefault("date", item.get("_date_obj", datetime.now()))
                    item.setdefault("tags", item.get("tags", []))
                    item.setdefault("categories", item.get("categories", []))
                    # 提供 url 字段以便 relative_url 工作
                    item["url"] = item.get("_permalink")
                # 关键：{{ var }} 替换必须在 scope 还活着时执行（render() 的收尾替换发生在 pop 之后）
                rendered_inner = self._substitute_vars(self._process_blocks(inner))
                out.append(rendered_inner)
                self.scope_stack.pop()
                count += 1
            template = template[:m.start()] + "".join(out) + template[end + len("{% endfor %}"):]
        return template

    def _expand_if(self, template):
        pattern = re.compile(r"{%\s*(if)\s+(.+?)\s*%}")
        while True:
            m = pattern.search(template)
            if not m: break
            start = m.end()
            end = self._find_matching(template, start, "if")
            if end == -1: break
            inner_full = template[start:end]
            # split on {% else %}
            else_match = re.search(r"{%\s*else\s*%}", inner_full)
            if else_match:
                inner = inner_full[:else_match.start()]
                else_block = inner_full[else_match.end():]
            else:
                inner = inner_full
                else_block = ""
            cond = self.eval_condition(m.group(2))
            chosen = inner if cond else else_block
            template = template[:m.start()] + chosen + template[end + len("{% endif %}"):]
        return template


def render_file(src: Path, posts):
    text = src.read_text(encoding="utf-8")
    fm, body = parse_front_matter(text)
    # 这是一个 page（带 layout 的）
    if "layout" in fm:
        layout_name = fm["layout"]
        layout_file = LAYOUTS_DIR / f"{layout_name}.html"
        if not layout_file.exists():
            raise FileNotFoundError(f"Layout not found: {layout_file}")
        layout_text = layout_file.read_text(encoding="utf-8")
        # Calculate page URL
        page_url = fm.get("permalink", "/" + str(src.relative_to(ROOT)).replace("\\", "/"))
        if not page_url.startswith("/"):
            page_url = "/" + page_url
        if src.name == "index.html" and "permalink" not in fm:
            page_url = "/"
        engine = LiquidEngine(posts, fm, page_url)
        # Render the body
        rendered_body = engine.render(body)
        # Inject into layout's {{ content }}
        layout_engine = LiquidEngine(posts, fm, page_url)
        rendered_layout = layout_engine.render(layout_text.replace("{{ content }}", rendered_body))
        return rendered_layout
    else:
        # 不带 layout 的独立 HTML（如 about/, files/）—— 仍然要 Liquid 化
        page_url = "/" + str(src.relative_to(ROOT)).replace("\\", "/")
        if src.name == "index.html":
            page_url = "/"
        engine = LiquidEngine(posts, fm, page_url)
        return engine.render(text)


def main():
    posts = load_posts()
    if OUT.exists():
        try:
            shutil.rmtree(OUT)
        except Exception:
            # 本机删除可能被安全回收机制拦截而失败 —— 删不掉就直接覆盖写
            pass
    OUT.mkdir(exist_ok=True)

    for src in ROOT.rglob("*.html"):
        if any(part.startswith(".") for part in src.relative_to(ROOT).parts):
            continue
        if "_preview" in src.relative_to(ROOT).parts:
            continue
        rel = src.relative_to(ROOT)
        out_path = OUT / rel
        out_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            rendered = render_file(src, posts)
            out_path.write_text(rendered, encoding="utf-8")
            print(f"  rendered  {rel}")
        except Exception as e:
            print(f"  FAILED    {rel}: {e}")

    # 复制非 HTML 资源
    for src in ROOT.rglob("*"):
        if src.is_file() and src.suffix not in (".html",):
            rel = src.relative_to(ROOT)
            if any(part.startswith(".") for part in rel.parts):
                continue
            if "_preview" in rel.parts:
                continue
            out_path = OUT / rel
            out_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, out_path)

    print(f"\n→ 预览已生成在: {OUT}")


if __name__ == "__main__":
    main()
