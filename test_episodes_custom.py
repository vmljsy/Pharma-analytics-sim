"""
Comprehensive verification test for user-defined market segments,
interactive restriction matrix (M x M), and overlap episode calculations.
"""
import socket
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

PORT = 8130
CHROME_PORT = 9228

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

def start_server(base_dir):
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
            payload = bytearray()
            while len(payload) < length:
                chunk = self.sock.recv(min(4096, length - len(payload)))
                if not chunk:
                    break
                payload.extend(chunk)
            msg = json.loads(payload.decode('utf-8'))
            if msg.get('method') == 'Runtime.consoleAPICalled':
                args = msg.get('params', {}).get('args', [])
                text = ' '.join(str(a.get('value', a.get('description', ''))) for a in args)
                mtype = msg.get('params', {}).get('type', '')
                if mtype == 'error':
                    self.console_errors.append(text)
                else:
                    self.console_logs.append(f"[{mtype}] {text}")
            return msg
        except socket.timeout:
            return None

    def call(self, method, params=None, timeout=5):
        cid = self.send(method, params)
        start = time.time()
        while time.time() - start < timeout:
            msg = self.recv(timeout=1)
            if msg and msg.get('id') == cid:
                return msg.get('result', {})
        return {}

    def eval(self, expr, timeout=5):
        res = self.call("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True}, timeout=timeout)
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

    base_dir = r"c:\Users\vimal\patient-analytics-simulations"
    print(f"[*] Starting HTTP server on port {PORT} in {base_dir}...")
    httpd = start_server(base_dir)

    print(f"[*] Launching Headless Chrome on debug port {CHROME_PORT}...")
    user_data = os.path.join(os.environ.get('TEMP', '.'), f'chrome_test_custom_{int(time.time())}')
    chrome_proc = subprocess.Popen([
        chrome_path,
        f"--remote-debugging-port={CHROME_PORT}",
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        f"--user-data-dir={user_data}",
        "about:blank"
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    client = None
    try:
        # Wait for Chrome debug port
        for _ in range(25):
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{CHROME_PORT}/json", timeout=1)
                break
            except:
                time.sleep(0.2)

        # Open target page via /json/new
        target_url = f"http://127.0.0.1:{PORT}/experiments/episode-building/index.html"
        print(f"[*] Opening target tab: {target_url}...")
        req = urllib.request.Request(f"http://127.0.0.1:{CHROME_PORT}/json/new?{target_url}", method='PUT')
        resp = urllib.request.urlopen(req)
        tab = json.loads(resp.read().decode('utf-8'))
        ws_url = tab['webSocketDebuggerUrl']
        client = CDPClient(ws_url)
        client.call("Runtime.enable")
        client.call("Page.enable")

        # Wait for page readiness
        print("[*] Waiting for engine and Plotly initialization...")
        ready = False
        for _ in range(30):
            time.sleep(0.5)
            is_ready = client.eval("typeof window.EPISODE_SIM !== 'undefined' && typeof window.Plotly !== 'undefined'")
            if is_ready:
                ready = True
                break

        print(f"[*] Engine Readiness: {ready}")
        if not ready:
            print(f"[FAIL] Engine failed to initialize in time. Console errors: {client.console_errors}")
            sys.exit(1)

        # 1. Zero Console Errors
        if client.console_errors:
            print(f"[FAIL] Console errors: {client.console_errors}")
            sys.exit(1)
        print("[PASS] Zero Console Errors on initialization")

        # 2. Check document title
        title = client.eval("document.title")
        print(f"[PASS] Title: '{title}'")

        # 3. Initial Market Segments and Restriction Matrix Table (6 initial segments)
        initial_segs = client.eval("Object.keys(window.EPISODE_SIM.getMarketSegments())")
        print(f"[PASS] Initial Market Segments ({len(initial_segs)}): {initial_segs}")
        assert len(initial_segs) == 6, f"Expected 6 initial segments, got {len(initial_segs)}"

        matrix_rows = client.eval("document.querySelectorAll('#restriction-matrix-table tbody tr').length")
        print(f"[PASS] Restriction Matrix Table Rendered: {matrix_rows} rows")
        assert matrix_rows == 6, f"Expected 6 rows in matrix, got {matrix_rows}"

        # 4. Check Initial Matrix Values (GLP1 + DPP4 restricted, SGLT2 + GLP1 synergistic)
        init_matrix = client.eval("window.EPISODE_SIM.getRestrictionMatrix()")
        glp1_dpp4 = init_matrix.get('GLP1', {}).get('DPP4')
        sglt2_glp1 = init_matrix.get('SGLT2', {}).get('GLP1')
        print(f"[PASS] Initial restrictions: GLP1+DPP4 = {glp1_dpp4}, SGLT2+GLP1 = {sglt2_glp1}")
        assert glp1_dpp4 == 'restricted', f"Expected GLP1+DPP4 to be restricted, got {glp1_dpp4}"
        assert sglt2_glp1 == 'synergistic', f"Expected SGLT2+GLP1 to be synergistic, got {sglt2_glp1}"

        # 5. Test Matrix Cell Toggling (Symmetric bidirectional synchronization)
        print("[*] Testing interactive matrix cell toggle (GLP1 <-> DPP4)...")
        # Toggle 1: restricted -> synergistic
        client.eval("window.EPISODE_SIM.toggleMatrixCell('GLP1', 'DPP4')")
        m1 = client.eval("window.EPISODE_SIM.getRestrictionMatrix()")
        assert m1['GLP1']['DPP4'] == 'synergistic', f"Expected synergistic, got {m1['GLP1']['DPP4']}"
        assert m1['DPP4']['GLP1'] == 'synergistic', f"Expected symmetric DPP4+GLP1 synergistic, got {m1['DPP4']['GLP1']}"
        print("  [PASS] Cell toggled to 'synergistic' symmetrically")

        # Toggle 2: synergistic -> allowed
        client.eval("window.EPISODE_SIM.toggleMatrixCell('GLP1', 'DPP4')")
        m2 = client.eval("window.EPISODE_SIM.getRestrictionMatrix()")
        assert m2['GLP1']['DPP4'] == 'allowed', f"Expected allowed, got {m2['GLP1']['DPP4']}"
        assert m2['DPP4']['GLP1'] == 'allowed', f"Expected symmetric DPP4+GLP1 allowed, got {m2['DPP4']['GLP1']}"
        print("  [PASS] Cell toggled to 'allowed' symmetrically")

        # 6. Test User-Defined Custom Market Segment Addition
        print("[*] Testing Add Custom Market Segment: 'ALDO' (MRA / Finerenone)...")
        add_result = client.eval("""
            window.EPISODE_SIM.addCustomMarketSegment({
                id: 'ALDO',
                name: 'MRA / Finerenone',
                fullName: 'Mineralocorticoid Receptor Antagonist',
                defaultDrug: 'Kerendia (20mg)',
                color: '#ec4899'
            })
        """)
        assert add_result is True, "Failed to add custom market segment"
        segs_after_add = client.eval("Object.keys(window.EPISODE_SIM.getMarketSegments())")
        print(f"[PASS] Segments after custom add ({len(segs_after_add)}): {segs_after_add}")
        assert 'ALDO' in segs_after_add, "ALDO not found in segments"
        assert len(segs_after_add) == 7, f"Expected 7 segments, got {len(segs_after_add)}"

        # Verify matrix expanded to 7x7
        matrix_rows_7 = client.eval("document.querySelectorAll('#restriction-matrix-table tbody tr').length")
        matrix_cols_7 = client.eval("document.querySelectorAll('#restriction-matrix-table thead th').length - 1")
        print(f"[PASS] Matrix Table expanded to {matrix_rows_7} rows x {matrix_cols_7} cols")
        assert matrix_rows_7 == 7 and matrix_cols_7 == 7, "Matrix table does not match 7x7"

        # Check ALDO matrix entries
        m3 = client.eval("window.EPISODE_SIM.getRestrictionMatrix()")
        assert m3['ALDO']['ALDO'] == 'self', f"Expected ALDO self cell, got {m3['ALDO']['ALDO']}"
        assert m3['ALDO']['GLP1'] == 'allowed', f"Expected ALDO+GLP1 default allowed, got {m3['ALDO']['GLP1']}"
        assert m3['GLP1']['ALDO'] == 'allowed', f"Expected GLP1+ALDO default allowed, got {m3['GLP1']['ALDO']}"

        # Verify custom legend chip with delete button
        chip_exists = client.eval("document.querySelector('[data-delete-seg=\"ALDO\"]') !== null")
        print(f"[PASS] Custom Segment Legend Chip with delete button present: {chip_exists}")
        assert chip_exists, "Delete button for ALDO not found in legend chips"

        # 7. Test Overlap Episode Calculation with Hard vs Soft Restrictions
        print("[*] Testing Overlap Episode Calculation under duplication scenario...")
        client.eval("""
            const sel = document.getElementById('scenario-select');
            sel.value = 'duplication_conflict';
            sel.dispatchEvent(new Event('change'));
        """)
        time.sleep(0.5)

        # In duplication_conflict scenario: Claims 1,2 are DPP4; Claim 3 is GLP1 starting at Day 40 (overlapping Day 30-60 of Claim 2)
        # Ensure GLP1 + DPP4 is restricted
        client.eval("""
            const m = window.EPISODE_SIM.getRestrictionMatrix();
            m['GLP1']['DPP4'] = 'restricted';
            m['DPP4']['GLP1'] = 'restricted';
            window.EPISODE_SIM.render();
        """)
        time.sleep(0.3)

        # Soft restriction: conflict interval detected and episode flagged
        soft_stats = client.eval("""
            const res = window.EPISODE_SIM.buildTreatmentEpisodes(
                window.EPISODE_SIM.getCurrentClaims(),
                30, 'stockpile', 365,
                { restrictionMatrix: window.EPISODE_SIM.getRestrictionMatrix(), enforceHard: false, maxConcurrentSegments: 2 }
            );
            ({ conflicts: res.overlapIntervals.filter(i => i.type === 'conflict').length, epCount: res.episodes.length, hasConflict: res.episodes[0].hasConflict })
        """)
        print(f"[PASS] Soft Restriction Mode: {soft_stats}")
        assert soft_stats['conflicts'] > 0, "Expected at least 1 conflict interval detected"
        assert soft_stats['hasConflict'] is True, "Episode should be flagged with hasConflict: true"

        # Hard restriction: claim 2 truncated on switch date (Day 40)
        hard_stats = client.eval("""
            (() => {
                const res = window.EPISODE_SIM.buildTreatmentEpisodes(
                    window.EPISODE_SIM.getCurrentClaims(),
                    30, 'stockpile', 365,
                    { restrictionMatrix: window.EPISODE_SIM.getRestrictionMatrix(), enforceHard: true, maxConcurrentSegments: 2 }
                );
                const c2 = res.adjustedClaims.find(c => c.id === 2);
                return { c2End: c2.effectiveEnd, c2Trunc: c2.truncatedDays, epCount: res.episodes.length };
            })()
        """)
        print(f"[PASS] Hard Restriction Mode: {hard_stats}")
        assert hard_stats['c2End'] == 40, f"Expected claim 2 to be truncated at Day 40, got {hard_stats['c2End']}"
        assert hard_stats['c2Trunc'] == 20, f"Expected 20 days truncated on switch, got {hard_stats['c2Trunc']}"

        # 8. Test View Mode Toggle (Unified Regimen vs Segment-Specific Episodes)
        print("[*] Testing Episode View Mode toggle...")
        client.eval("window.EPISODE_SIM.setEpisodeViewMode('segment')")
        v_mode = client.eval("window.EPISODE_SIM.getViewMode()")
        assert v_mode == 'segment', f"Expected view mode 'segment', got {v_mode}"
        active_btn = client.eval("document.getElementById('btn-view-segment').classList.contains('active')")
        assert active_btn, "Segment view button should have active class"
        print("  [PASS] Switched to 'segment' view mode successfully")

        client.eval("window.EPISODE_SIM.setEpisodeViewMode('regimen')")
        v_mode2 = client.eval("window.EPISODE_SIM.getViewMode()")
        assert v_mode2 == 'regimen', f"Expected view mode 'regimen', got {v_mode2}"
        print("  [PASS] Switched back to 'regimen' view mode successfully")

        # 9. Test Deleting Custom Market Segment
        print("[*] Testing Deleting Custom Market Segment 'ALDO'...")
        del_result = client.eval("window.EPISODE_SIM.deleteCustomMarketSegment('ALDO')")
        assert del_result is True, "Failed to delete ALDO"
        segs_after_del = client.eval("Object.keys(window.EPISODE_SIM.getMarketSegments())")
        print(f"[PASS] Segments after delete ({len(segs_after_del)}): {segs_after_del}")
        assert 'ALDO' not in segs_after_del, "ALDO should have been deleted"
        assert len(segs_after_del) == 6, f"Expected 6 segments, got {len(segs_after_del)}"

        matrix_rows_6 = client.eval("document.querySelectorAll('#restriction-matrix-table tbody tr').length")
        assert matrix_rows_6 == 6, f"Expected matrix to return to 6 rows, got {matrix_rows_6}"
        print("  [PASS] Matrix table safely shrank back to 6x6")

        # 10. Check Plotly Chart SVG rendering
        plotly_svgs = client.eval("document.querySelectorAll('.main-svg').length")
        print(f"[PASS] Plotly Chart active: {plotly_svgs} SVG elements rendered")
        assert plotly_svgs > 0, "Plotly chart SVG elements not found"

        print("\n" + "=" * 70)
        print("[SUCCESS] ALL CUSTOM MARKET SEGMENT & RESTRICTION MATRIX TESTS PASSED!")
        print("=" * 70 + "\n")

    finally:
        if client:
            client.close()
        chrome_proc.terminate()
        httpd.shutdown()

if __name__ == '__main__':
    main()
