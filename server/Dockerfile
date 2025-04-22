# Use an official Node.js runtime as a parent image (Use LTS version)
FROM node:18-slim

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (or yarn.lock)
# Use package-lock.json for npm v7+, otherwise use package.json
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy the rest of the application code into the container
COPY . .

# Make port 3001 available to the world outside this container (or use PORT env var)
# Cloud Run automatically provides the PORT env var, usually 8080
# EXPOSE 3001

# Define the command to run your app using node
# Cloud Run uses the PORT environment variable to determine which port to listen on.
# Your server/index.js should ideally use process.env.PORT
CMD ["node", "index.js"] 