"""Knowledge embedding script for RAG pipeline (architecture §4.2)."""

import os
import asyncio
import argparse

from crq.ai_gateway.embeddings import embeddings_client

def chunk_text(text: str, chunk_size: int = 2000, overlap: int = 200) -> list[str]:
    """Basic sliding window chunking by characters (for MVP simplicity)."""
    chunks = []
    start = 0
    text_len = len(text)
    while start < text_len:
        end = start + chunk_size
        chunks.append(text[start:end])
        start = end - overlap
    return chunks

async def main():
    parser = argparse.ArgumentParser(description="Embed knowledge documents via TEI.")
    parser.add_argument("--dir", default="../../ai-knowledge", help="Directory containing knowledge files")
    args = parser.parse_args()
    
    if not os.path.isdir(args.dir):
        print(f"Error: Directory {args.dir} not found.")
        return
        
    print("Connecting to TEI...")
    
    for filename in os.listdir(args.dir):
        if not filename.endswith(".json") and not filename.endswith(".md"):
            continue
            
        filepath = os.path.join(args.dir, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        print(f"Processing {filename}...")
        chunks = chunk_text(content)
        
        # Batch embed
        try:
            embeddings = await embeddings_client.embed(chunks)
            print(f"Successfully embedded {len(chunks)} chunks for {filename}.")
            
            # Print SQL for manual Supabase insertion (since we aren't connecting directly to DB here)
            print("\n--- SQL INSERT STATEMENTS (Run in Supabase) ---")
            for i, (chunk, vector) in enumerate(zip(chunks, embeddings)):
                clean_chunk = chunk.replace("'", "''")
                vector_str = f"[{','.join(str(v) for v in vector)}]"
                sql = f"INSERT INTO public.crq_knowledge_chunks (source, content, embedding) VALUES ('{filename}', '{clean_chunk}', '{vector_str}');"
                print(sql)
            print("-----------------------------------------------\n")
            
        except Exception as e:
            print(f"Failed to embed {filename}: {e}")

if __name__ == "__main__":
    asyncio.run(main())
