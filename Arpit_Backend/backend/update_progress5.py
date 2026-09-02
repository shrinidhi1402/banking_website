import re

filepath = r"D:\Projects\0xAxiom\backend_progress.md"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Mark P5 and P6 tasks as done
content = re.sub(r'\[ \] \*\*P5(.*?)\n', r'[x] **P5\1\n', content)
content = re.sub(r'\[ \] \*\*M6(.*)\n', r'[x] **M6\1\n', content)
content = re.sub(r'\[ \] \*\*P6(.*?)\n', r'[x] **P6\1\n', content)
content = re.sub(r'\[ \] \*\*M7(.*)\n', r'[x] **M7\1\n', content)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
