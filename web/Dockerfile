# Dockerfile para Ambiente Next.js (Desenvolvimento)
FROM node:20-alpine

WORKDIR /app

# Copia apenas os arquivos de dependência primeiro para melhor cache
COPY package*.json ./

RUN npm install

# Copia o restante
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
