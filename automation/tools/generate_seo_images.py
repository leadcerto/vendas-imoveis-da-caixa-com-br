import os
import sys
from PIL import Image
from supabase import create_client, Client
import re

# Supabase configuration
URL = "https://jefgzdcynnotuiaiickd.supabase.co"
KEY = "sb_publishable_s_f-Can7kPxIKjF1uS8E2g_b5vTJY5u"

supabase: Client = create_client(URL, KEY)

# Paths
BASE_IMAGE_PATH = r"c:\Users\PICHAU\Desktop\antigravity\venda-imoveis-caixa\ImagemDestaque.jpg"
OUTPUT_DIR = r"c:\Users\PICHAU\Desktop\antigravity\venda-imoveis-caixa\web\public\imagens-destaque"

def clean_name(name):
    if not name:
        return ""
    # Lowercase, replace accents, and remove special characters
    name = str(name).lower()
    name = name.replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')
    name = name.replace('ã', 'a').replace('õ', 'o').replace('ê', 'e').replace('ô', 'o')
    name = name.replace('ç', 'c')
    # Keep only alphanumeric and spaces, then replace spaces with hyphens
    name = re.sub(r'[^a-z0-9\s]', '', name)
    name = re.sub(r'\s+', '-', name.strip())
    return name

def process_images():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        print(f"Created/Verified directory: {OUTPUT_DIR}")

    if not os.path.exists(BASE_IMAGE_PATH):
        print(f"Error: Base image not found at {BASE_IMAGE_PATH}")
        return

    # Open and resize base image once
    with Image.open(BASE_IMAGE_PATH) as img:
        img_resized = img.resize((450, 450), Image.Resampling.LANCZOS)
        
        batch_size = 1000
        offset = 0
        total_count = 0
        new_images_count = 0

        while True:
            print(f"Fetching properties {offset} to {offset + batch_size}...")
            try:
                response = supabase.table("imoveis").select(
                    "imoveis_id, imovel_caixa_post_link_permanente"
                ).range(offset, offset + batch_size - 1).execute()
                
                properties = response.data
            except Exception as e:
                print(f"Error fetching data: {e}")
                break

            if not properties:
                break

            print(f"Processing {len(properties)} properties...")

            for prop in properties:
                slug = prop.get('imovel_caixa_post_link_permanente')
                if not slug:
                    print(f"Skipping property {prop.get('imoveis_id')} - no slug")
                    continue
                
                # Format: slug.jpg
                filename = f"{slug}.jpg"
                output_path = os.path.join(OUTPUT_DIR, filename)

                if not os.path.exists(output_path):
                    img_resized.save(output_path, "JPEG", quality=85)
                    new_images_count += 1
                
                total_count += 1

            if len(properties) < batch_size:
                break
            
            offset += batch_size

    print(f"Done! Processed {total_count} properties.")
    print(f"Generated {new_images_count} new images in {OUTPUT_DIR}")

if __name__ == "__main__":
    process_images()
