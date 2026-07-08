FROM node:20-slim

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install packages
RUN npm install

# Copy application files
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
