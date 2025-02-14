FROM node:20.18.3
WORKDIR /app

# Install FFMPEG
RUN apt-get -y update
RUN apt-get -y upgrade
RUN apt-get install -y ffmpeg

# Intall dependencies
COPY ["package.json", "package-lock.json*", "./"]
RUN npm ci

# Build
COPY . .
RUN npm run build

# Start service
CMD ["npm", "run", "start"]