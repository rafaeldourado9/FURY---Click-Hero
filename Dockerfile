FROM node:20-alpine

WORKDIR /app

# Instala dependências uma vez na imagem para que não seja necessário
# rodar `npm install` no host. Cache de layer maximizado: package.json
# muda raramente comparado ao código.
COPY package*.json ./
RUN npm ci

# Copia o restante do código-fonte.
COPY . .

# Build de produção (typecheck + emit). Não emite quando `tests/` está
# excluído via tsconfig.build.json.
RUN npx tsc -p tsconfig.build.json

CMD ["npm", "run", "start:api"]
