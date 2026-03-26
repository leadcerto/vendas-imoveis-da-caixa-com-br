import binascii

file_path = r"c:\Users\PICHAU\Desktop\antigravity\venda-imoveis-caixa\automation\csv-caixa\remote_1774490274493_Lista_imoveis_SP.csv"

with open(file_path, 'rb') as f:
    line1 = f.readline()
    line2 = f.readline()
    print(f"LINE 1 RAW: {line1}")
    print(f"LINE 1 HEX: {binascii.hexlify(line1)}")
    print(f"LINE 2 RAW: {line2}")
    print(f"LINE 2 HEX: {binascii.hexlify(line2)}")
