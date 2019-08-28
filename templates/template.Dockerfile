# Use node-alpine as a base (30x smaller size being the major selling point)
FROM node:11.14.0-alpine

# Create the folder for the app and 
RUN mkdir -p /usr/src/app

# Set it as the workplace (commands will be ran from here)
WORKDIR /usr/src/app

# Copy host folder to container
COPY . .

# Install node modules
RUN npm install

# Start the node server
CMD ["npm", "run", "start"]