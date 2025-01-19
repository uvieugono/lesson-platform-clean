FROM node:18-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . /app

# Corrected path to list files in the utils directory
RUN ls /app/app/utils

RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]