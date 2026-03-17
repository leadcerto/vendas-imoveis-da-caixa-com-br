# Dockerfile para Ambiente de Scripts Python
FROM python:3.11-slim

# Evita o buffering do log do Python
ENV PYTHONUNBUFFERED=1

# Define a pasta de trabalho
WORKDIR /app

# Instala dependências do sistema necessárias para algumas bibliotecas (como pandas ou Levenshtein)
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copia os arquivos de requerimentos primeiro para aproveitar o cache do Docker
COPY requirements.txt .

# Instala as dependências do Python
RUN pip install --no-cache-dir -r requirements.txt

# Copia o restante do código
COPY . .

# Comando padrão (mantém o container vivo)
CMD ["tail", "-f", "/dev/null"]
