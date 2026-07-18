FROM node:18-alpine

WORKDIR /app

# Copy back-end dependencies as node user
COPY --chown=node:node back/package*.json ./back/
RUN cd back && npm install

# Copy front-end and back-end directories
COPY --chown=node:node front/ ./front/
COPY --chown=node:node back/ ./back/

# Pre-create uploads directory and database file with correct ownership
RUN mkdir -p back/uploads && echo "[]" > back/ads.json && chown -R node:node /app

# Switch to standard non-root user
USER node

# Expose default Hugging Face Spaces port
EXPOSE 7860

# Start server
CMD ["node", "back/server.js"]
