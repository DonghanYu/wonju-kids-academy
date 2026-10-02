"""web/ 을 단일 HTML(Artifact 게시용 데모)로 묶는다: CSS·JS·데이터 인라인."""
import json, re
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
W = ROOT / "web"
html = (W / "index.html").read_text(encoding="utf-8")
body = re.search(r"<!--APP-->(.*)<!--/APP-->", html, re.S).group(1)
css = (W / "styles.css").read_text(encoding="utf-8")
js = (W / "app.js").read_text(encoding="utf-8")
data = json.loads((W / "data" / "academies.json").read_text(encoding="utf-8"))
payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
out = f"""<title>원주 아이 학원 찾기</title>
<style>
{css}
</style>
{body}
<script>window.__ACADEMY_DATA__ = {payload};</script>
<script>
{js}
</script>
"""
dist = ROOT / "dist"; dist.mkdir(exist_ok=True)
(dist / "wonju-kids-demo.html").write_text(out, encoding="utf-8")
print(len(out), "bytes")
