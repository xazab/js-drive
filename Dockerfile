FROM node:12-alpine

RUN apk update && \
    apk --no-cache upgrade && \
    apk add --no-cache linux-headers \
                       git \
                       openssh-client \
                       python \
                       alpine-sdk \
                       zeromq-dev

# Install dependencies first, in a different location
# for easier app bind mounting for local development
WORKDIR /

COPY package.json package-lock.json ./
ENV npm_config_zmq_external=true
RUN npm ci --production

FROM node:12-alpine

LABEL maintainer="Xazab Developers <dev@xazab.xyz>"
LABEL description="Drive Node.JS"

RUN apk update && apk add --no-cache zeromq-dev

# Copy NPM modules
COPY package.json package-lock.json /
COPY --from=0 /node_modules/ /node_modules

ENV PATH /node_modules/.bin:$PATH

# Copy project files
WORKDIR /usr/src/app
COPY . /usr/src/app
RUN cp .env.example .env

ARG NODE_ENV=production
ENV NODE_ENV ${NODE_ENV}

EXPOSE 26658
