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

# Define the command to run the feedback sentiment analysis service
CMD ["node", "feedback-service.js"] 