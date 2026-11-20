FROM node:22-bookworm-slim AS source
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.ts tsconfig.json tsconfig.test.json eslint.config.js ./
COPY firebase.json firestore.rules storage.rules firestore.indexes.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY tests/ ./tests/

FROM source AS development
ENV VITE_USE_EMULATORS=true
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--strictPort"]

FROM eclipse-temurin:21-jre-jammy AS java

FROM source AS emulators
COPY --from=java /opt/java/openjdk /opt/java/openjdk
ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="/opt/java/openjdk/bin:${PATH}"
ENV CI=true
RUN node -e "const fs = require('node:fs'); const config = require('./firebase.json'); for (const name of ['auth', 'firestore', 'storage', 'ui']) { if (config.emulators[name]) config.emulators[name].host = '0.0.0.0'; } fs.writeFileSync('firebase.json', JSON.stringify(config));"
CMD ["node", "scripts/emulators.mjs", "start", "--persist"]

FROM source AS build
ARG PUBLIC_FIREBASE_WEB_KEY
ARG PUBLIC_FIREBASE_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_HANDOUT_MAX_MIB
RUN VITE_FIREBASE_API_KEY="$PUBLIC_FIREBASE_WEB_KEY" VITE_FIREBASE_AUTH_DOMAIN="$PUBLIC_FIREBASE_DOMAIN" npm run build

FROM nginxinc/nginx-unprivileged:1.28-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/
EXPOSE 8080
