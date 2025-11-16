# Use Apify base image with Playwright
FROM apify/actor-node-playwright-chrome:18

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --include=dev \
    && npm run build 2>/dev/null || echo "No build step specified" \
    && npm prune --production

# Copy source code
COPY . ./

# Run the actor
CMD npm start
