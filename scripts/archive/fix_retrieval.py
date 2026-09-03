filepath = r"src\crq\query_engine\retrieval.py"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("crq_knowledge_chunks", "public.knowledge_chunks")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
