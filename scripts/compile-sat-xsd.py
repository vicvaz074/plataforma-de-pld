"""Compile the closed subset actually used by the downloaded official XSDs.

Reject any new/unsupported schema construct instead of silently ignoring it.
The result is checked against libxml2/lxml in the release verification script.
"""
import json
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ALLOWED = {"schema", "element", "complexType", "simpleType", "restriction", "pattern", "sequence", "choice", "maxLength", "minLength", "length", "minInclusive"}


def node(element):
    tag = element.tag.split("}")[-1]
    if tag not in ALLOWED:
        raise ValueError(f"Unsupported XSD construct: {tag}")
    attrs = dict(element.attrib)
    for key in ("type", "base"):
        if key in attrs:
            attrs[key] = attrs[key].split(":")[-1]
    return {"tag": tag, **attrs, **({"children": [node(child) for child in element]} if len(element) else {})}


schemas = {}
for file in sorted((ROOT / "tests/fixtures/sat-official").glob("*.xsd")):
    if file.name == "spr.xsd":
        continue  # superseded by the 2021 SPR2 schema linked on the same SAT page
    root = ET.parse(file).getroot()
    children = [node(child) for child in root]
    schemas[root.attrib["targetNamespace"]] = {"file": file.name, "root": next(child for child in children if child["tag"] == "element"), "types": {child["name"]: child for child in children if child["tag"] != "element"}}
target = ROOT / "lib/pld/generated/sat-xsd.json"
target.write_text(json.dumps(schemas, ensure_ascii=False, separators=(",", ":")) + "\n")
print(f"Compiled {len(schemas)} schema namespaces")
