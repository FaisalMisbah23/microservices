FROM node:alpine

WORKDIR /app

COPY expiration/package.json ./
RUN node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('package.json','utf8')); delete p.dependencies['@fmticketflow/common']; fs.writeFileSync('package.json', JSON.stringify(p, null, 2));"
RUN npm install --omit=dev

COPY common ./node_modules/@fmticketflow/common
RUN cd ./node_modules/@fmticketflow/common && npm install --omit=dev

COPY expiration .

CMD ["npm", "start"]
