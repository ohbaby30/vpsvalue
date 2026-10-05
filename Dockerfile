FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node server.mjs calculator.mjs card.svg ./
COPY --chown=node:node public ./public
USER node
ENV NODE_ENV=production PORT=8080 TZ=Asia/Shanghai
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
