"""Extract ONLY pure XML-building routines from the official cached XLSM files.

Development-only dependency: oletools. This never executes VBA or Excel. The
browser interpreter accepts a closed grammar, cannot execute system/Excel APIs,
and fails closed for unsupported constructs. Sources are hashed for provenance.
"""
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
from oletools.olevba import VBA_Parser

ROOT = Path(__file__).resolve().parents[1]
NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def strip_comment(line):
    quoted = False
    i = 0
    while i < len(line):
        if line[i] == '"':
            if quoted and i + 1 < len(line) and line[i + 1] == '"':
                i += 2
                continue
            quoted = not quoted
        elif line[i] == "'" and not quoted:
            return line[:i].strip()
        i += 1
    return line.strip()


def extract(file):
    with zipfile.ZipFile(file) as z:
        wb = ET.fromstring(z.read("xl/workbook.xml"))
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        targets = {r.attrib["Id"]: r.attrib["Target"].lstrip("/") for r in rels}
        sheets = {}
        fixed_cells = {}
        shared = []
        needs_fixed_cells = file.parent.name == "sat-fraccion-iii-cheques" or "FedatariosSP" in file.name
        if needs_fixed_cells and "xl/sharedStrings.xml" in z.namelist():
            shared = ["".join(item.itertext()) for item in ET.fromstring(z.read("xl/sharedStrings.xml"))]
        for sheet in wb.find("s:sheets", NS):
            target = targets[sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]]
            if not target.startswith("xl/"):
                target = "xl/" + target
            # codeName is worksheet metadata near the beginning. Do not parse
            # thousands of catalogue cells simply to get the sheet's VBA name.
            with z.open(target) as stream:
                header = stream.read(16384)
            code_name = re.search(rb'<(?:\w+:)?sheetPr\b[^>]*\bcodeName="([^"]+)"', header)
            if code_name:
                sheets[code_name[1].decode("utf8").lower()] = sheet.attrib["name"]
            # Immutable constants read by VBA, not user input. Never seed capture
            # values or financial rows from the sample workbook.
            allowed = set()
            if file.parent.name == "sat-fraccion-iii-cheques" and sheet.attrib["name"] == "Acto u operación":
                allowed = {f"B{i}" for i in range(12, 19)}
            if "FedatariosSP" in file.name and sheet.attrib["name"] == "Aviso":
                allowed = {"B1"}
            if not allowed:
                continue
            sheet_xml = ET.fromstring(z.read(target))
            for cell in sheet_xml.findall(".//s:c", NS):
                if cell.attrib["r"] not in allowed:
                    continue
                value = cell.findtext("s:v", default="", namespaces=NS)
                if cell.attrib.get("t") == "s" and value:
                    value = shared[int(value)]
                fixed_cells[f'{sheet.attrib["name"]}!{cell.attrib["r"]}'] = value
    parser = VBA_Parser(str(file))
    modules = {}
    for _, _, filename, code in parser.extract_macros():
        name = Path(filename).stem.lower()
        code = re.sub(r"_\s*\r?\n", " ", code)
        lines = [strip_comment(line) for line in code.splitlines()]
        source = "\n".join(lines)
        constants = {}
        for m in re.finditer(r"(?im)^(?:(?:public|private)\s+)?const\s+(\w+)(?:\s+as\s+\w+)?\s*=\s*(.+)$", source):
            constants[m[1].lower()] = m[2].strip()
        routines = {}
        pattern = r"(?ims)^(?:(?:public|private)\s+)?(function|sub)\s+(\w+)\s*\((.*?)\)[^\n]*\n(.*?)^end\s+(?:function|sub)\s*$"
        module_source = re.sub(pattern, "", source)
        variables = []
        public_variables = []
        for declaration in re.finditer(r"(?im)^(dim|public|private)\s+(?!const\b)(.+)$", module_source):
            for item in declaration[2].split(","):
                var = re.match(r"\s*(\w+)", item)
                if var:
                    (public_variables if declaration[1].lower() == "public" else variables).append(var[1].lower())
        for m in re.finditer(pattern, source):
            fname = m[2].lower()
            if ("xml" not in fname and not re.fullmatch(r"getreferenciah[2-7]", fname)) or fname == "writexml" or fname.endswith("_click"):
                continue
            params = []
            for param in re.split(r",\s*", m[3]):
                if not param.strip():
                    continue
                pm = re.match(r"(?i)\s*(?:optional\s+)?(?:byval\s+|byref\s+)?(\w+)(?:\s+as\s+\w+)?(?:\s*=\s*(.*))?", param)
                if not pm:
                    raise ValueError(f"Invalid XML parameter {file}: {param}")
                params.append({"name": pm[1].lower(), "default": pm[2]})
            body = []
            for line in m[4].splitlines():
                line = line.strip()
                if not line or re.match(r"(?i)^(dim |on error |msgbox\b|[\w]+:$)", line):
                    continue
                # writeXml is a terminal output marker, never a file-system call.
                if re.match(r"(?i)^call\s+writexml\b", line):
                    line = re.sub(r"(?i)^call\s+writexml\s*\((.*?),.*\)$", r"__output = \1", line)
                # Encoding occurs at element boundaries in our interpreter.
                if re.match(r'(?i)^\w+\s*=\s*replace\([^,]+,\s*"[&\']"', line):
                    continue
                # No UI, workbook mutation, or saving routine is retained.
                if re.match(r"(?i)^(activesheet\.|sheets\(.*\)\.(activate|select|visible|range)|range\(.*\)\.value\s*=|call\s+(?!xml)|application\.)", line):
                    continue
                body.append(line)
            routines[fname] = {"params": params, "lines": body}
        if routines or constants:
            modules[name] = {"sheet": sheets.get(name), "variables": variables, "publicVariables": public_variables, "constants": constants, "routines": routines}
            # The successful validaOtorgamientoPoder path restores the grantor
            # rows before invoking xml(). Extract those literal offsets, without
            # retaining or running its UI/validation code. Fail if SAT changes it.
            if file.parent.name == "sat-fraccion-xii-notarios-b" and name == "sheet1":
                validation = re.search(r"(?ims)^function validaOtorgamientoPoder\(\).*?^end function", source)
                if not validation:
                    raise ValueError("Missing official grantor-row initializer")
                initial_values = dict(re.findall(r"(?im)^(ROW_PERSONA_REPORTADA_\w+)\s*=\s*(\d+)\s*$", validation[0]))
                if set(initial_values) != {"ROW_PERSONA_REPORTADA_FISICA", "ROW_PERSONA_REPORTADA_MORAL", "ROW_PERSONA_REPORTADA_FIDE"}:
                    raise ValueError("Changed official grantor-row initializer")
                modules[name]["initialValues"] = {key.lower(): int(value) for key, value in initial_values.items()}
    parser.close()
    return {"sourceFile": file.name, "sourceSha256": hashlib.sha256(file.read_bytes()).hexdigest(), "verifiedAt": "2026-09-26", "fixedCells": fixed_cells, "modules": modules}


if __name__ == "__main__":
    target = ROOT / "lib/pld/generated/sat-xml-programs.json"
    programs = {}
    for file in sorted((ROOT / "public/sat-templates").rglob("*.xlsm")):
        programs[file.parent.name] = extract(file)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(programs, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Extracted {len(programs)} static XML programs to {target.relative_to(ROOT)}")
