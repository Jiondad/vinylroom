#!/usr/bin/env python3
"""Print only the unreviewed read-only integration functions for multidisc UUID work.

No imports of target modules; AST reads source text only. No file, DB, media writes.
"""
import ast
from pathlib import Path

TARGETS = {
    "tag_phase2c.py": {"inventory", "discover_files", "album_record", "valid_album_folder"},
    "tag_rename_writer.py": {"_catalog_files", "_references_match"},
    "index_scanner.py": {"scan_set", "disc_number"},
    "tag_native_index.py": {"preflight", "__call__"},
}
for filename, functions in TARGETS.items():
    source_path = Path("/app") / filename
    print("\n========", filename, "========")
    if not source_path.is_file():
        print("NOT_FOUND")
        continue
    raw = source_path.read_text(encoding="utf-8")
    parsed = ast.parse(raw)
    found = set()
    for n in ast.walk(parsed):
        if not isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) or n.name not in functions:
            continue
        found.add(n.name)
        print(ast.get_source_segment(raw, n))
        print()
    missing = functions - found
    if missing:
        print("MISSING_FUNCTIONS:", ",".join(sorted(missing)))

print("\n======== native callback registration ========")
path = Path("/app/server.py")
if path.is_file():
    lines = path.read_text(encoding="utf-8").splitlines()
    matches = [i for i, line in enumerate(lines)
               if "configure_rename_context" in line or "NativeAlbumIndex(" in line]
    for i in matches:
        print(f"LINES {max(1,i-5)}-{min(len(lines),i+7)}")
        for pos in range(max(0,i-6), min(len(lines),i+7)):
            print(f"{pos+1:04}: {lines[pos]}")
        print()
else:
    print("NOT_FOUND")
print("READ_ONLY_COMPLETE")
