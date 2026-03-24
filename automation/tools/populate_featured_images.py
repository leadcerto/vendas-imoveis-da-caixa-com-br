import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(url, key)

def populate_featured_images():
    print("🚀 Iniciando preenchimento FULL de Imagens de Destaque...")
    
    offset = 0
    limit = 1000
    total_updated = 0
    
    while True:
        # Busca em blocos de 1000 (limite do Supabase)
        response = supabase.table("imoveis") \
            .select("imoveis_id, imovel_caixa_post_link_permanente") \
            .range(offset, offset + limit - 1) \
            .execute()
        
        properties = response.data
        if not properties:
            break
            
        print(f"📊 Processando bloco {offset} a {offset + len(properties)}...")
        
        updates = []
        for prop in properties:
            slug = prop.get("imovel_caixa_post_link_permanente")
            if not slug:
                continue
                
            updates.append({
                "imoveis_id": prop["imoveis_id"],
                "imovel_caixa_post_imagem_destaque": f"/imagens-destaque/{slug}.jpg"
            })
            
        if updates:
            try:
                supabase.table("imoveis").upsert(updates, on_conflict="imoveis_id").execute()
                total_updated += len(updates)
            except Exception as e:
                print(f"❌ Erro no bloco: {e}")
        
        print(f"✅ {total_updated} imóveis atualizados no total...")
        if len(properties) < limit:
            break
        offset += limit

    print(f"🏁 Concluído! {total_updated} imagens de destaque configuradas com nomes exatos.")

if __name__ == "__main__":
    populate_featured_images()
