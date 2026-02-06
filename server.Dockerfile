# Reference
# https://bun.com/guides/ecosystem/docker

# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1.3.8-alpine AS base
WORKDIR /usr/src/app

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install

# install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
COPY packages/service/package.json /temp/prod/packages/service/
COPY packages/server/package.json /temp/prod/packages/server/
COPY packages/site/package.json /temp/prod/packages/site/
RUN cd /temp/prod && bun install --filter=service --filter=server --frozen-lockfile --production

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM base AS prerelease
COPY --from=install /temp/prod/node_modules node_modules
COPY . .

ENV NODE_ENV=production

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/packages/service ./packages/service
COPY --from=prerelease /usr/src/app/packages/server ./packages/server
COPY --from=prerelease /usr/src/app/package.json .

# run the app
USER bun
EXPOSE 30000/tcp
ENTRYPOINT [ "bun", "--filter=server", "start" ]
