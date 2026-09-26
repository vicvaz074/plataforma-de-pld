"""Cache XSDs and XML examples linked by the official SAT activity pages.

Read-only remote requests; no guessed schema URLs. System curl validates TLS.
"""
import concurrent.futures
import hashlib
import json
import re
import subprocess
from xml.etree import ElementTree as ET
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "tests/fixtures/sat-official"
PAGES = "juegosysorteos tarjetas_servicio tarjetas_prepagadas tarjetas_devolucion cheques_viajero mutuo blindaje inmuebles desarrollo_inmobiliario metalesyjoyas obras vehiculos traslado servicios donativos agentes arrendamiento fedatarios servidores activos".split()


def fetch(url):
    return subprocess.check_output(["curl", "-fsSL", "--max-time", "40", "--retry", "2", url])


def links(page):
    url = f"https://sppld.sat.gob.mx/pld/interiores/{page}.html"
    html = fetch(url).decode("utf8", errors="replace")
    return [(href, url) for href in re.findall(r'href="([^"]+\.(?:xsd|xml))"', html) if href.startswith("https://www.pld.hacienda.gob.mx/")]


def save(item):
    url, page = item
    data = fetch(url)
    name = Path(urlparse(url).path).name
    if ET.fromstring(data).tag.lower().endswith("html"):
        raise ValueError(f"Not XML: {url}")
    (DEST / name).write_bytes(data)
    return {"file": name, "url": url, "sourcePage": page, "consultedAt": "2026-09-26", "sha256": hashlib.sha256(data).hexdigest()}


if __name__ == "__main__":
    DEST.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        urls = dict(pair for group in pool.map(links, PAGES) for pair in group)
        sources = list(pool.map(save, sorted(urls.items())))
    (DEST / "sources.json").write_text(json.dumps(sources, ensure_ascii=False, indent=2) + "\n")
    print(f"Downloaded {len(sources)} official XSD/example sources")
