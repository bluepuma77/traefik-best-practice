# Specify the base image
FROM node:lts-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy the rest of application's source code
COPY src/ ./src

# Copy local certificates
COPY *.pem .

# Expose the port the app runs on
EXPOSE 3000

# Command to run your app
CMD ["node", "src/index.js"]