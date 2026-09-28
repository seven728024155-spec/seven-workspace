# -*- coding: utf-8 -*-
"""
seven 的工作空间 · 本地管理后台服务器
提供轻量零依赖本地 HTTP API，实现文章、文字、文件管理及一键 Git 同步。
"""

import os
import sys
import json
import urllib.parse
import subprocess
import webbrowser
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 4321
REPO_DIR = os.path.dirname(os.path.abspath(__file__))
POSTS_DIR = os.path.join(REPO_DIR, "_posts")
FILES_DIR = os.path.join(REPO_DIR, "files")
DATA_DIR = os.path.join(REPO_DIR, "_data")
CONTENT_FILE = os.path.join(DATA_DIR, "site_content.yml")


class AdminHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=REPO_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, msg, status=400):
        self.send_json({"error": msg, "success": False}, status=status)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == "/admin":
            self.send_response(302)
            self.send_header("Location", "/admin/")
            self.end_headers()
            return

        if path == "/api/status":
            self.send_json({"local": True, "repo": "seven-workspace", "user": "seven728024155-spec"})
            return

        if path == "/api/posts":
            if "file" in query:
                file_name = query["file"][0]
                target = os.path.join(POSTS_DIR, file_name)
                if not os.path.exists(target):
                    self.send_error_json("文章不存在", 404)
                    return
                with open(target, "r", encoding="utf-8") as f:
                    content = f.read()
                self.send_json({"file": file_name, "content": content})
                return
            else:
                posts = []
                if os.path.exists(POSTS_DIR):
                    for fname in sorted(os.listdir(POSTS_DIR), reverse=True):
                        if fname.endswith(".md"):
                            fpath = os.path.join(POSTS_DIR, fname)
                            title, date, cats, tags = self._parse_post_meta(fpath, fname)
                            posts.append({
                                "name": fname,
                                "title": title,
                                "date": date,
                                "categories": cats,
                                "tags": tags
                            })
                self.send_json(posts)
                return

        if path == "/api/content":
            if not os.path.exists(CONTENT_FILE):
                self.send_json({"content": ""})
                return
            with open(CONTENT_FILE, "r", encoding="utf-8") as f:
                content = f.read()
            self.send_json({"content": content})
            return

        if path == "/api/files":
            files = []
            if os.path.exists(FILES_DIR):
                for fname in sorted(os.listdir(FILES_DIR)):
                    lower = fname.lower()
                    if lower.startswith(".") or lower.startswith("readme") or lower == "index.html":
                        continue
                    fpath = os.path.join(FILES_DIR, fname)
                    if os.path.isfile(fpath):
                        mtime = datetime.fromtimestamp(os.path.getmtime(fpath)).strftime("%Y-%m-%d")
                        files.append({
                            "name": fname,
                            "size": os.path.getsize(fpath),
                            "date": mtime,
                            "download_url": f"/files/{urllib.parse.quote(fname)}"
                        })
            self.send_json(files)
            return

        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == "/api/posts":
            try:
                length = int(self.headers.get("Content-Length", 0))
                raw = self.rfile.read(length).decode("utf-8")
                data = json.loads(raw)
                file_name = data.get("file")
                old_file = data.get("oldFile")
                content = data.get("content", "")

                if not file_name:
                    self.send_error_json("缺少文件名")
                    return

                os.makedirs(POSTS_DIR, exist_ok=True)
                new_path = os.path.join(POSTS_DIR, file_name)
                with open(new_path, "w", encoding="utf-8") as f:
                    f.write(content)

                if old_file and old_file != file_name:
                    old_path = os.path.join(POSTS_DIR, old_file)
                    if os.path.exists(old_path):
                        os.remove(old_path)

                self.send_json({"success": True, "file": file_name})
            except Exception as e:
                self.send_error_json(str(e))
            return

        if path == "/api/content":
            try:
                length = int(self.headers.get("Content-Length", 0))
                raw = self.rfile.read(length).decode("utf-8")
                data = json.loads(raw)
                content = data.get("content", "")

                os.makedirs(DATA_DIR, exist_ok=True)
                with open(CONTENT_FILE, "w", encoding="utf-8") as f:
                    f.write(content)

                self.send_json({"success": True})
            except Exception as e:
                self.send_error_json(str(e))
            return

        if path == "/api/files":
            try:
                content_type = self.headers.get("Content-Type", "")
                length = int(self.headers.get("Content-Length", 0))
                file_name = query.get("name", [None])[0]

                os.makedirs(FILES_DIR, exist_ok=True)

                if file_name:
                    save_path = os.path.join(FILES_DIR, file_name)
                    with open(save_path, "wb") as f:
                        remaining = length
                        while remaining > 0:
                            chunk_size = min(remaining, 65536)
                            chunk = self.rfile.read(chunk_size)
                            if not chunk:
                                break
                            f.write(chunk)
                            remaining -= len(chunk)
                    self.send_json({"success": True, "file": file_name})
                    return
                elif "multipart/form-data" in content_type:
                    boundary = content_type.split("boundary=")[-1].strip().encode()
                    body = self.rfile.read(length)
                    parts = body.split(b"--" + boundary)
                    saved = []
                    for part in parts:
                        if b'filename="' in part:
                            header_part, file_data = part.split(b"\r\n\r\n", 1)
                            file_data = file_data.rstrip(b"\r\n")
                            fn_start = header_part.find(b'filename="') + 10
                            fn_end = header_part.find(b'"', fn_start)
                            fname = header_part[fn_start:fn_end].decode("utf-8")
                            save_path = os.path.join(FILES_DIR, fname)
                            with open(save_path, "wb") as f:
                                f.write(file_data)
                            saved.append(fname)
                    self.send_json({"success": True, "files": saved})
                    return
                else:
                    self.send_error_json("未指定文件名或不支持的内容格式")
            except Exception as e:
                self.send_error_json(str(e))
            return

        if path == "/api/git/sync":
            try:
                output = []

                def run_cmd(args):
                    p = subprocess.run(
                        args,
                        cwd=REPO_DIR,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        text=True,
                        encoding="utf-8",
                        errors="replace"
                    )
                    return p.stdout

                output.append("> git add .")
                output.append(run_cmd(["git", "add", "."]))

                output.append('> git commit -m "update content via admin"')
                commit_out = run_cmd(["git", "commit", "-m", "update content via admin"])
                output.append(commit_out)

                output.append("> git push origin main")
                push_out = run_cmd(["git", "push", "origin", "main"])
                output.append(push_out)

                combined = "\n".join(output)
                success = "error" not in push_out.lower() and "fatal" not in push_out.lower()
                self.send_json({"success": success, "output": combined})
            except Exception as e:
                self.send_error_json(str(e))
            return

        self.send_error_json("未知的 POST 端点", 404)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == "/api/posts":
            file_name = query.get("file", [None])[0]
            if not file_name:
                self.send_error_json("未提供文件名")
                return
            target = os.path.join(POSTS_DIR, file_name)
            if os.path.exists(target):
                os.remove(target)
                self.send_json({"success": True})
            else:
                self.send_error_json("文件不存在", 404)
            return

        if path == "/api/files":
            file_name = query.get("file", [None])[0]
            if not file_name:
                self.send_error_json("未提供文件名")
                return
            target = os.path.join(FILES_DIR, file_name)
            if os.path.exists(target):
                os.remove(target)
                self.send_json({"success": True})
            else:
                self.send_error_json("文件不存在", 404)
            return

        self.send_error_json("未知的 DELETE 端点", 404)

    def _parse_post_meta(self, filepath, filename):
        title = filename
        date = ""
        cats = []
        tags = []
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                lines = f.readlines()
            in_fm = False
            for line in lines:
                l = line.strip()
                if l == "---":
                    if in_fm:
                        break
                    else:
                        in_fm = True
                        continue
                if in_fm:
                    if l.startswith("title:"):
                        title = l.replace("title:", "").strip().strip('"\'')
                    elif l.startswith("date:"):
                        date = l.replace("date:", "").strip().strip('"\'')
                    elif l.startswith("categories:"):
                        raw_c = l.replace("categories:", "").strip().strip("[]")
                        cats = [x.strip().strip('"\'') for x in raw_c.split(",") if x.strip()]
                    elif l.startswith("tags:"):
                        raw_t = l.replace("tags:", "").strip().strip("[]")
                        tags = [x.strip().strip('"\'') for x in raw_t.split(",") if x.strip()]
        except Exception:
            pass
        return title, date, cats, tags


def main():
    os.chdir(REPO_DIR)
    server_address = ("", PORT)
    try:
        httpd = HTTPServer(server_address, AdminHandler)
    except OSError:
        print(f"端口 {PORT} 被占用，尝试端口 {PORT + 1}")
        httpd = HTTPServer(("", PORT + 1), AdminHandler)

    port = httpd.server_port
    url = f"http://127.0.0.1:{port}/admin/"
    print("=" * 60)
    print(f"seven 的工作空间 · 本地管理后台已启动！")
    print(f"正在浏览器中打开: {url}")
    print(f"按 Ctrl+C 可停止服务")
    print("=" * 60)

    try:
        webbrowser.open(url)
    except Exception:
        pass

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n后台服务已停止。")
        httpd.server_close()


if __name__ == "__main__":
    main()
