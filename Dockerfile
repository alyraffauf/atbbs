FROM node:26.8.2-slim@sha256:f7bb8247fdb16250dbec7fd0e24f091c6f5f0a29d256f3aef5816a7a369166b2 AS build

WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY atbbs/package.json atbbs/package.json
COPY atproto/package.json atproto/package.json
COPY web/package.json web/package.json
RUN npm ci
COPY atbbs atbbs
COPY atproto atproto
COPY web web
RUN npm --workspace atbbs-web run build

FROM nginx:alpine@sha256:62ff2089abf5a9ed33bd232895bef5e22f7bb4b200675cec49a5ebc48e3d4ac8
COPY --from=build /repo/web/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY web/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
