FROM node:26.10.0-slim@sha256:930557a230abacbc3f4fd9b8648abf8f4bee1e17cb72195dcdfb2f709bc85b33 AS build

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

FROM nginx:alpine@sha256:713fc2ebfd92e8217db451477182ee91944b123d2b1ee9fd5a8c6e91ca6c3a11
COPY --from=build /repo/web/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY web/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
