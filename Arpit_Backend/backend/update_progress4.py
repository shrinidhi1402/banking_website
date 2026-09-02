import re
filepath = r"D:\Projects\0xAxiom\backend_progress.md"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Mark P4 tasks as done
content = re.sub(r'\[ \] \*\*P4\.1(.*?)\n', r'[x] **P4.1\1\n', content)
content = re.sub(r'\[ \] \*\*P4\.2(.*?)\n', r'[x] **P4.2\1\n', content)
content = re.sub(r'\[ \] \*\*P4\.3(.*?)\n', r'[x] **P4.3\1\n', content)
content = re.sub(r'\[ \] \*\*P4\.4(.*?)\n', r'[x] **P4.4\1\n', content)
content = re.sub(r'\[ \] \*\*P4\.5(.*?)\n', r'[x] **P4.5\1\n', content)
content = re.sub(r'\[ \] \*\*M5(.*?)\n', r'[x] **M5\1\n', content)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
