import re

filepath = r"src\crq\schemas\vuln.py"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Remove cvss_vector which isn't in our new DB schema
content = re.sub(r'\s*cvss_vector:\s*str\s*\|\s*None\s*=\s*None', '', content)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
