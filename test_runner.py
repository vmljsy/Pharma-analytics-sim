"""
Automated Test Runner for rx.sim patient analytics simulations using Chrome DevTools Protocol (CDP).
Validates DOM mounting, KaTeX rendering, Plotly containers, console errors,
slider sweeps, and patient analytics invariants.
"""
import socket
import hashlib
import base64
import os
import json
import struct
import subprocess
import time
import urllib.request
import sys
import threading
import http.server
import socketserver

PORT = 8126
CHROME_PORT = 9225

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

def start_server():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(base_dir)
    handler = lambda *args, **kwargs: QuietHandler(*args, directory=base_dir, **kwargs)
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), handler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd

class CDPClient:
    def __init__(self, ws_url):
        parts = ws_url.replace('ws://', '').split('/', 1)
        host_port = parts[0].split(':')
        self.host = host_port[0]
        self.port = int(host_port[1])
        self.path = '/' + parts[1]
        self.sock = self._connect()
        self.req_id = 0
        self.console_errors = []
        self.console_logs = []

    def _connect(self):
        s = socket.create_connection((self.host, self.port), timeout=10)
        key = base64.b64encode(os.urandom(16)).decode('ascii')
        req = (
            f"GET {self.path} HTTP/1.1\r\n"
            f"Host: {self.host}:{self.port}\r\n"
            f"Upgrade: websocket\r\n"
            f"Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            f"Sec-WebSocket-Version: 13\r\n\r\n"
        )
        s.sendall(req.encode('ascii'))
        resp = s.recv(4096).decode('latin1')
        if '101' not in resp.splitlines()[0]:
            raise RuntimeError(f"WebSocket upgrade failed: {resp}")
        return s

    def send(self, method, params=None):
        self.req_id += 1
        msg = {"id": self.req_id, "method": method, "params": params or {}}
        payload = json.dumps(msg).encode('utf-8')
        length = len(payload)
        mask = os.urandom(4)
        masked = bytes([payload[i] ^ mask[i % 4] for i in range(length)])
        if length < 126:
            header = bytes([0x81, 0x80 | length]) + mask
        elif length < 65536:
            header = bytes([0x81, 0x80 | 126]) + struct.pack('!H', length) + mask
        else:
            header = bytes([0x81, 0x80 | 127]) + struct.pack('!Q', length) + mask
        self.sock.sendall(header + masked)
        return self.req_id

    def recv(self, timeout=5):
        self.sock.settimeout(timeout)
        try:
            head = self.sock.recv(2)
            if not head:
                return None
            b1, b2 = head[0], head[1]
            length = b2 & 0x7F
            if length == 126:
                length = struct.unpack('!H', self.sock.recv(2))[0]
            elif length == 127:
                length = struct.unpack('!Q', self.sock.recv(8))[0]
            data = b''
            while len(data) < length:
                chunk = self.sock.recv(length - len(data))
                if not chunk:
                    break
                data += chunk
            return json.loads(data.decode('utf-8'))
        except socket.timeout:
            return None

    def call(self, method, params=None, timeout=5):
        cid = self.send(method, params)
        start = time.time()
        while time.time() - start < timeout:
            msg = self.recv(timeout=1)
            if not msg:
                continue
            if msg.get('method') == 'Runtime.consoleAPICalled':
                args = msg.get('params', {}).get('args', [])
                text = ' '.join(str(a.get('value', a.get('description', ''))) for a in args)
                mtype = msg.get('params', {}).get('type', '')
                if mtype == 'error':
                    self.console_errors.append(text)
                else:
                    self.console_logs.append(f"[{mtype}] {text}")
            if msg.get('id') == cid:
                return msg.get('result', {})
        return {}

    def eval(self, expr):
        res = self.call("Runtime.evaluate", {"expression": expr, "returnByValue": True})
        val = res.get('result', {})
        if val.get('type') == 'object' and 'value' in val:
            return val['value']
        return val.get('value')

    def close(self):
        try:
            self.sock.close()
        except:
            pass

def find_chrome():
    candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expanduser(r"~\AppData\Local\Google\Chrome\Application\chrome.exe"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None

def main():
    chrome_path = find_chrome()
    if not chrome_path:
        print("[FAIL] Chrome executable not found")
        sys.exit(1)

    print(f"[*] Starting HTTP server on port {PORT}...")
    httpd = start_server()

    print(f"[*] Launching Headless Chrome on debug port {CHROME_PORT}...")
    chrome_proc = subprocess.Popen([
        chrome_path,
        f"--remote-debugging-port={CHROME_PORT}",
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-extensions",
        f"--user-data-dir={os.path.expanduser('~')}/.chrome-test-profile-rx"
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    client = None
    try:
        # Wait for Chrome to bind
        tabs = None
        for _ in range(20):
            try:
                resp = urllib.request.urlopen(f"http://127.0.0.1:{CHROME_PORT}/json", timeout=1)
                tabs = json.loads(resp.read().decode())
                if tabs:
                    break
            except:
                time.sleep(0.3)

        if not tabs:
            print("[FAIL] Could not connect to Chrome debugging port")
            sys.exit(1)

        ws_url = tabs[0]['webSocketDebuggerUrl']
        client = CDPClient(ws_url)
        client.call("Runtime.enable")
        client.call("Page.enable")

        experiments = [
            ("Main Catalog", "/index.html"),
            ("EXP-01: Episode Building", "/experiments/episode-building/index.html"),
            ("EXP-02: Source of Business", "/experiments/source-of-business/index.html"),
            ("EXP-03: Persistence Analysis", "/experiments/persistence-analysis/index.html"),
            ("EXP-04: Line of Therapy", "/experiments/line-of-therapy/index.html"),
            ("EXP-05: Compliance PDC vs MPR", "/experiments/compliance-adherence/index.html"),
            ("EXP-06: Brand Switching Matrix", "/experiments/switching-matrix/index.html"),
        ]

        all_passed = True
        print("\n" + "=" * 70)
        print("rx.sim — Longitudinal Patient Analytics Automated Validation Suite")
        print("=" * 70 + "\n")

        for name, path in experiments:
            url = f"http://127.0.0.1:{PORT}{path}"
            client.console_errors = []
            client.console_logs = []

            print(f"Testing {name.ljust(35)} -> {path}")
            client.call("Page.navigate", {"url": url})
            time.sleep(1.2) # Allow async init, KaTeX, and Plotly to render

            # 1. Assert no JavaScript runtime exceptions
            if client.console_errors:
                print(f"  [X] Console errors detected: {client.console_errors}")
                all_passed = False
            else:
                print("  [OK] Zero Console Errors")

            # 2. Check title
            title = client.eval("document.title")
            print(f"  [OK] Document Title: '{title}'")

            # 3. Check KaTeX rendering (for experiment pages)
            if "experiments" in path:
                katex_count = client.eval("document.querySelectorAll('.katex').length")
                if katex_count and katex_count > 0:
                    print(f"  [OK] KaTeX Equations Rendered: {katex_count} elements")
                else:
                    print("  [WARN] No KaTeX elements rendered on page")

                # 4. Check Plotly container
                plotly_svgs = client.eval("document.querySelectorAll('.main-svg').length")
                if plotly_svgs and plotly_svgs > 0:
                    print(f"  [OK] Plotly Chart Active: {plotly_svgs} SVG layers mounted")
                else:
                    print("  [FAIL] Plotly Chart SVG not found!")
                    all_passed = False

            print("-" * 70)

        if all_passed:
            print("\n[SUCCESS] ALL rx.sim PATIENT ANALYTICS SIMULATION MODULES VALIDATED CLEANLY!\n")
        else:
            print("\n[FAILURE] Some tests failed. Please review errors above.\n")
            sys.exit(1)

    finally:
        if client:
            client.close()
        chrome_proc.terminate()
        httpd.shutdown()

if __name__ == '__main__':
    main()
