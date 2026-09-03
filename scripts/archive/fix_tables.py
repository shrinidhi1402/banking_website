filepath = r"D:\Projects\0xAxiom\banking_website\Arpit_Backend\supabase\001_crq_tables.sql"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

import re
# Remove the CREATE TABLE crq_knowledge_chunks block if it exists
content = re.sub(r'CREATE TABLE public\.crq_knowledge_chunks.*?\);\n', '', content, flags=re.DOTALL)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
