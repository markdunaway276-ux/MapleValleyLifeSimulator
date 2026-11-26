"""Local game server for Maple Valley (started by play.bat).

Serves the game folder at http://localhost:<port> like `python -m http.server`,
and adds one thing the browser cannot do on its own: F9 feedback snapshots are
saved straight into the `feedback` folder next to the game.

  feedback/<date>_<time>.png   the marked-up screenshot (with the note band)
  feedback/feedback-list.md    one numbered entry per snapshot (F9 #1, #2 ...)

Commit and push the feedback folder with GitHub Desktop so Claude (or anyone
helping) can read the pictures and notes from GitHub.

Only listens on this computer (127.0.0.1). Python 3.8+, no packages needed.
Usage: python tools/dev-server.py [port]
"""
import base64
import datetime
import http.server
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FB_DIR = os.path.join(ROOT, 'feedback')
FB_LIST = os.path.join(FB_DIR, 'feedback-list.md')
MAX_BODY = 40 * 1024 * 1024
PNG_PREFIX = 'data:image/png;base64,'
LIST_HEADER = (
    '# Maple Valley feedback\n\n'
    'Made with F9 (or the camera button) in the game while it runs from play.bat.\n'
    'Each entry has its picture in this folder. Status: open = still to fix, fixed = done.\n'
)


def clean(value, limit):
    text = '' if value is None else str(value)
    text = re.sub(r'[\x00-\x08\x0b-\x1f\x7f]', '', text)
    return text[:limit]


def save_feedback(data):
    png = data.get('png')
    if not isinstance(png, str) or not png.startswith(PNG_PREFIX):
        raise ValueError('bad picture')
    raw = base64.b64decode(png[len(PNG_PREFIX):], validate=True)
    if not raw.startswith(b'\x89PNG'):
        raise ValueError('not a PNG')

    os.makedirs(FB_DIR, exist_ok=True)
    now = datetime.datetime.now()
    stamp = now.strftime('%Y-%m-%d_%H-%M-%S')
    name, k = stamp + '.png', 2
    while os.path.exists(os.path.join(FB_DIR, name)):
        name = '%s-%d.png' % (stamp, k)
        k += 1
    with open(os.path.join(FB_DIR, name), 'wb') as f:
        f.write(raw)

    try:
        with open(FB_LIST, 'r', encoding='utf-8') as f:
            listing = f.read()
    except FileNotFoundError:
        listing = LIST_HEADER
    n = len(re.findall(r'^## #\d+', listing, flags=re.M)) + 1

    info = data.get('info') if isinstance(data.get('info'), dict) else {}
    note = clean(data.get('note'), 2000).strip().replace('\r\n', '\n').replace('\n', '\n  ')
    when = now.strftime('%b %d, %Y, %I:%M %p').replace(' 0', ' ')
    entry = '\n## #%d · %s · %s\n- Note: %s\n' % (n, when, name, note or '(no note)')
    for label, key in (('Where', 'where'), ('Spot', 'spot'), ('Game time', 'clock'),
                       ('Weather', 'weather'), ('Device', 'device')):
        val = clean(info.get(key), 160).strip()
        if val:
            entry += '- %s: %s\n' % (label, val)
    if info.get('marked'):
        entry += '- Marked: yes (drawn on the picture)\n'
    entry += '- Status: open\n'
    with open(FB_LIST, 'w', encoding='utf-8', newline='\n') as f:
        f.write(listing + entry)
    return {'ok': True, 'file': name, 'n': n}


class Handler(http.server.SimpleHTTPRequestHandler):
    # Some Windows PCs map .js to text/plain in the registry, which stops ES modules loading.
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.json': 'application/json',
        '.glb': 'model/gltf-binary',
        '.wasm': 'application/wasm',
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # Always load the newest files after a Pull (no stale copies in the browser cache).
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def send_json(self, code, obj):
        body = json.dumps(obj).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split('?')[0] == '/__feedback/ping':
            return self.send_json(200, {'ok': True, 'folder': 'feedback'})
        return super().do_GET()

    def do_POST(self):
        if self.path.split('?')[0] != '/__feedback':
            return self.send_json(404, {'ok': False, 'error': 'not found'})
        try:
            length = int(self.headers.get('Content-Length') or 0)
            if length <= 0 or length > MAX_BODY:
                return self.send_json(413, {'ok': False, 'error': 'too large'})
            data = json.loads(self.rfile.read(length).decode('utf-8'))
            if not isinstance(data, dict):
                raise ValueError('bad request')
            result = save_feedback(data)
            print('  F9 #%d saved: feedback/%s' % (result['n'], result['file']))
            return self.send_json(200, result)
        except Exception as e:  # report the problem to the game instead of crashing
            return self.send_json(400, {'ok': False, 'error': str(e)})

    def log_message(self, fmt, *args):
        pass  # keep the window quiet; F9 saves print their own line


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    server = http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler)
    print('Maple Valley is running at http://localhost:%d' % port)
    print('F9 snapshots are saved to: %s' % FB_DIR)
    print('Leave this window open while you play. Close it to stop.')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
