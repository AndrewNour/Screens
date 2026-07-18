FROM node:18-alpine

WORKDIR /app

# Copy back-end dependencies
COPY back/package*.json ./back/
RUN cd back && npm install

# Copy front-end files
COPY front/ ./front/

# Copy back-end files
COPY back/ ./back/

# Expose port (Hugging Face default)
EXPOSE 7860

# Start server
CMD ["node", "back/server.js"]
