FROM node:20-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy the rest of the application files
COPY . .

# Expose the default application port
EXPOSE 4000

# Set default env variable
ENV PORT=4000

CMD ["npm", "start"]
