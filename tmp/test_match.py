
import re

def normalize_caixa_id(val) -> int:
    try:
        s = str(val).strip()
        s = re.sub(r'[^\d]', '', s)
        if not s: return 0
        if len(s) == 13:
            prefixos = ['84444', '14444', '15555', '10211', '10542', '10811']
            for p in prefixos:
                if s.startswith(p):
                    return int(s[len(p):])
        return int(s)
    except:
        return 0

tests = [
    ('3683', 3683),
    (3683, 3683),
    ('8444400003683', 3683),
    ('1444400003683', 3683),
    ('0000446279', 446279),
    (1444422000000, 22000000)
]

for val, expected in tests:
    res = normalize_caixa_id(val)
    print(f"Input: {val} -> Result: {res} (Exp: {expected}) - {'✅' if res == expected else '❌'}")
