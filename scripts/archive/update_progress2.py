filepath = r"D:\Projects\0xAxiom\backend_progress.md"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("[ ] **P2.1.3", "[x] **P2.1.3")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
