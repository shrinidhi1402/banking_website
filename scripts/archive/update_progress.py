import re

filepath = r"D:\Projects\0xAxiom\backend_progress.md"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Mark P1.1.5, P1.2.x, P1.3.x as done
content = content.replace("[ ] **P1.1.5", "[x] **P1.1.5")
content = re.sub(r'\[ \] \*\*P1\.2(.*?)\n', r'[x] **P1.2\1\n', content)
content = re.sub(r'\[ \] \*\*P1\.3(.*?)\n', r'[x] **P1.3\1\n', content)

# P2.1 event pipeline direct call is done
content = content.replace("[ ] **P2.1.1", "[x] **P2.1.1")
content = content.replace("[ ] **P2.1.2", "[x] **P2.1.2")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
