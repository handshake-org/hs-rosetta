FROM node:current-alpine AS base
RUN apk add --no-cache unbound-dev gmp-dev
ADD https://github.com/handshake-org/hs-rosetta/archive/v1.2.0.zip /opt/
RUN unzip /opt/v1.2.0.zip -d /opt/ -x "*/Makefile" "*/jsdoc.json" "*/Dockerfile" "*/LICENSE" "*/README.md" "*/test/*"
WORKDIR /opt/hs-rosetta-1.2.0

FROM base as build
RUN apk add --no-cache gcc g++ make python2 git
RUN npm install --production

FROM base
ENV PATH="${PATH}:/opt/hs-rosetta-1.2.0/node_modules/hsd/bin"
COPY --from=build /opt/hs-rosetta-1.2.0/node_modules /opt/hs-rosetta-1.2.0/node_modules
ENTRYPOINT ["hsd"]
# NOTE: Listening on public interface without auth, make sure to secure the host!
CMD ["--index-tx", "--index-address", "--plugins", "/opt/hs-rosetta-1.2.0", \
     "--rosetta-http-host=0.0.0.0", "--rosetta-no-auth", "--prefix=/data"]
