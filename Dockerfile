FROM node:current-alpine AS base
RUN apk add --no-cache unbound-dev gmp-dev
WORKDIR /opt/hs-rosetta
COPY package*.json /opt/hs-rosetta/
COPY lib /opt/hs-rosetta/lib/

FROM base as build
RUN apk add --no-cache gcc g++ make python2 git
RUN npm install --production

FROM base
ENV PATH="${PATH}:/opt/hs-rosetta/node_modules/hsd/bin"
COPY --from=build /opt/hs-rosetta/node_modules /opt/hs-rosetta/node_modules
ENTRYPOINT ["hsd"]
# NOTE: Listening on public interface without auth, make sure to secure the host!
CMD ["--index-tx", "--index-address", "--plugins", "/opt/hs-rosetta", \
     "--rosetta-http-host=0.0.0.0", "--rosetta-no-auth", "--prefix=/data"]
