def parse_brl_numeric(val):
    if not val:
        return 0.0
    s = str(val).replace('R$', '').replace('%', '').strip()
    if not s:
        return 0.0
    
    # Brazilian numeric pattern: 1.234,56 or 1234,56
    # Python/Excel string pattern: 1234.56
    
    if ',' in s and '.' in s:
        # 1.234,56 -> 1234.56
        s = s.replace('.', '').replace(',', '.')
    elif ',' in s:
        # 1234,56 -> 1234.56
        s = s.replace(',', '.')
    elif '.' in s:
        # 1234.56 (Excel) OR 1.234 (Thousand sep in some CSVs)
        parts = s.split('.')
        # If the part after the dot has exactly 3 digits and it's multiple dots, or just large number
        # and not 2 digits (cents), it's risky.
        # But CAIXA always uses two decimal places for cents.
        if len(parts[-1]) == 2: 
            # Likely 1234.56
            pass
        elif len(parts[-1]) == 3 and len(s) > 4:
            # Likely 1.234 (one thousand) -> 1234
            s = s.replace('.', '')
        else:
            # Fallback: if it's 123.4 (one decimal), it's likely decimal
            pass
            
    try:
        return float(s)
    except:
        return 0.0

test_cases = [
    ('1.234,56', 1234.56),
    ('1234,56', 1234.56),
    ('1234.56', 1234.56),
    ('1.234', 1234.0),
    ('18754.13', 18754.13),
    ('187541.31', 187541.31),
    ('1', 1.0),
    ('1.2', 1.2),
    ('R$ 1.234,56', 1234.56),
]

for inp, expected in test_cases:
    res = parse_brl_numeric(inp)
    print(f"Input: {inp:15} | Result: {res:10} | Correct: {res == expected}")
