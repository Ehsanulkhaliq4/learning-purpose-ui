# ==========================================
# Stage 1: Build the Angular Application
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies (npm ci is faster and strictly uses package-lock.json)
RUN npm ci

# Copy the rest of the Angular source code
COPY . .

# Build the Angular app for production
RUN npm run build --configuration=production

# ==========================================
# Stage 2: Serve the app with Nginx
# ==========================================
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built Angular app from the builder stage.
# For Angular 17+, the output is usually dist/<project-name>/browser
# Based on your prompt, your project name is likely 'learning-purpose-ui'
COPY --from=builder /app/dist/learning-purpose-ui/browser /usr/share/nginx/html

# Expose port 80 (Nginx default)
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]