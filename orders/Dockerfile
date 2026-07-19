FROM node:alpine

WORKDIR /app

# Install service deps without requiring published @fmticketflow/common
COPY orders/package.json ./
RUN node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('package.json','utf8')); delete p.dependencies['@fmticketflow/common']; fs.writeFileSync('package.json', JSON.stringify(p, null, 2));"
RUN npm install --omit=dev

# Inject locally built common (same idea as sync-common.sh)
COPY common ./node_modules/@fmticketflow/common
RUN cd ./node_modules/@fmticketflow/common && npm install --omit=dev

COPY orders .

CMD ["npm", "start"]
