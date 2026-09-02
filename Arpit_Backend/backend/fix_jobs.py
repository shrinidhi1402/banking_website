filepath = r"src\crq\api\v1\jobs.py"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("org_id: uuid.UUID = Query(default=uuid.UUID(\"00000000-0000-0000-0000-000000000001\"))", "org_id: int = Query(default=1)")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
