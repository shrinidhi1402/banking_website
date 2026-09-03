filepath = r"src\crq\api\v1\auth.py"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("user.sub", "user.id")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
