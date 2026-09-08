FROM node:26-slim AS build

WORKDIR /repo
COPY package.json package-lock.json ./
COPY atbbs/package.json atbbs/package.json
COPY atproto/package.json atproto/package.json
COPY web/package.json web/package.json
RUN npm ci
COPY atbbs atbbs
COPY atproto atproto
COPY web web
RUN npm --workspace atbbs-web run build

FROM nginx:alpine
COPY --from=build /repo/web/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY web/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
