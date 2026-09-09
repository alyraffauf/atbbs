FROM node:26-slim@sha256:c0753125a3789977aefe869cbebccf70e3cfd7ea84ca48547458f02e4f1d7146 AS build

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

FROM nginx:alpine@sha256:72ba65eb42c10344912a84ff42408db7d34f2feb642204570ab8fc5ffd29f1d3
COPY --from=build /repo/web/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY web/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
