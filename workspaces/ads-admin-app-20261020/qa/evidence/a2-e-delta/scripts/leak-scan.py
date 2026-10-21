# Counts secret hits in files; prints counts only, never values.
import re, sqlite3, sys, pathlib
qa = pathlib.Path(sys.argv[1]); targets = [pathlib.Path(p) for p in sys.argv[2:]]
db = sqlite3.connect(f"file:{qa/'ads.sqlite'}?mode=ro", uri=True)
pw = (qa/'admin-password').read_text().strip() if (qa/'admin-password').exists() else None
key = db.execute("select value from ads_meta where name='signing_key'").fetchone()
hashes = [r[0] for r in db.execute("select password_hash from ads_admins")]
cols = [r[1] for r in db.execute("pragma table_info(ads_sessions)")]
sess = [str(v) for row in db.execute("select * from ads_sessions") for c, v in zip(cols, row) if v is not None and len(str(v)) >= 16 and c not in ('username',)]
files = [f for t in targets for f in ([t] if t.is_file() else t.rglob('*')) if f.is_file()]
texts = []
for f in files:
    try: texts.append(f.read_bytes().decode('utf-8', 'ignore'))
    except Exception: pass
def hits(vals): return sum(t.count(v) for t in texts for v in vals if v)
pat = lambda r: sum(len(re.findall(r, t, re.I)) for t in texts)
print('files scanned', len(files))
print('password hits:', hits([pw]) if pw else 'n/a (file gone)')
print('signing_key hits:', hits([key[0]] if key else []))
print(f'password-hash hits ({len(hashes)} hashes):', hits(hashes))
print(f'session-value hits ({len(sess)} values):', hits(sess))
print('cookie/csrf patterns:', pat(r'(PHPSESSID|ads_session|solad_session)=[A-Za-z0-9]{8,}') + pat(r'x-csrf-token"?\s*[:=]\s*"?[A-Za-z0-9_\-]{16,}') + pat(r'^\s*cookie:\s*\S{8,}'))
print('DSN patterns:', pat(r'(sqlite|mysql|pgsql):(/|host=)'))
