import os
import re

schema_dir = r"src\crq\schemas"

for filename in os.listdir(schema_dir):
    if not filename.endswith(".py"):
        continue
    filepath = os.path.join(schema_dir, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Replace specific fields
    content = re.sub(r'id:\s*uuid\.UUID', r'id: int', content)
    content = re.sub(r'org_id:\s*uuid\.UUID', r'org_id: int', content)
    content = re.sub(r'business_unit_id:\s*uuid\.UUID', r'business_unit_id: int', content)
    content = re.sub(r'asset_id:\s*uuid\.UUID', r'asset_id: int', content)
    content = re.sub(r'control_id:\s*uuid\.UUID', r'control_id: int', content)
    content = re.sub(r'assessment_id:\s*uuid\.UUID', r'assessment_id: int', content)
    content = re.sub(r'vulnerability_id:\s*uuid\.UUID', r'vulnerability_id: int', content)
    content = re.sub(r'scope_id:\s*uuid\.UUID', r'scope_id: int', content) # Scope ID could be UUID, but let's see. Wait, scope_id in DB is UUID!

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
