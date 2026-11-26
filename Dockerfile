FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn
RUN yarn install --immutable
COPY . .
RUN yarn build

FROM nginx:1.29-alpine
COPY docker/default.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/simplia-web/browser /usr/share/nginx/html
EXPOSE 8080
