import re

filepath = r"D:\Projects\0xAxiom\backend_progress.md"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Mark P3 tasks as done
content = re.sub(r'\[ \] \*\*P3\.1\.1(.*)\n', r'[x] **P3.1.1\1\n', content)
content = re.sub(r'\[ \] \*\*P3\.1\.2(.*)\n', r'[x] **P3.1.2\1\n', content)
content = re.sub(r'\[ \] \*\*P3\.2\.1(.*)\n', r'[x] **P3.2.1\1\n', content)
content = re.sub(r'\[ \] \*\*P3\.2\.2(.*)\n', r'[x] **P3.2.2\1\n', content)
content = re.sub(r'\[ \] \*\*P3\.2\.4(.*)\n', r'[x] **P3.2.4\1\n', content)
content = re.sub(r'\[ \] \*\*P3\.2\.5(.*)\n', r'[x] **P3.2.5\1\n', content)
content = re.sub(r'\[ \] \*\*M4(.*)\n', r'[x] **M4\1\n', content)


with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
