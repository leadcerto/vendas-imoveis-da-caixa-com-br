import json

with open(r'c:\Users\PICHAU\Desktop\antigravity\venda-imoveis-caixa\supabase\id-grupos-imovel.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

sql = "INSERT INTO public.grupos_imovel (id, nome, valor_minimo, valor_maximo, compra_financiamento_entrada, compra_financiamento_prestacao, compra_registro, compra_despachante, compra_desocupacao, honorario_leiloeiro, honorarios_corretagem, honorarios_corretagem_caixa, venda_reforma, venda_condominio, venda_fundo_reserva, venda_financiamento, venda_agua_luz, venda_impostos, venda_tempo_meses, venda_despesas, venda_despesas_extras, venda_aceleracao, venda_financiamento_amortizacao, aluguel_roi_comum, aluguel_roi_caixa) VALUES\n"

rows = []
for item in data:
    row = f"({item['ID']}, '{item['Nome ']}', {item['Maior que']}, {item['Menor ou igual a']}, {item['compra-financimento entrada']}, {item['compra-financiamento-prestacao']}, {item['compra-registro']}, {item['compra-despachante']}, {item['compra-desocupacao']}, {item['honorario-leiloeiro']}, {item['honorarios-corretagem']}, {item['honorarios-corretagem-caixa']}, {item['venda-reforma']}, {item['venda-condominio']}, {item['venda-fundoi-reserva']}, {item['venda-financiamento']}, {item['venda-agua-luz']}, {item['venda-impostos']}, {item['venda-tempo-meses']}, {item['venda-despesas']}, {item['venda-despesas-extras']}, {item['venda-aceleracao']}, {item['venda-financiamento-amortizacao']}, {item['aluguel-roi-comum']}, {item['aluguel-roi-caixa']})"
    rows.append(row)

sql += ",\n".join(rows) + ";"

with open(r'c:\Users\PICHAU\Desktop\antigravity\venda-imoveis-caixa\supabase\seed-grupos-imovel.sql', 'w', encoding='utf-8') as f:
    f.write(sql)
