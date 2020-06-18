FROM node:12.18.0-alpine3.9 as base

RUN apk add --no-cache bash \
    unbound-dev \
    gmp-dev

FROM base as build

WORKDIR /opt

RUN apk add git --no-cache \
    g++ \
    gcc \
    make \
    python2

ARG TAG=v2.1.5

RUN wget https://github.com/handshake-org/hsd/archive/$TAG.tar.gz \
    && tar -xvf $TAG.tar.gz \
    && mv hsd-$(echo $TAG | cut -c2-) hsd \
    && cd hsd \
    && npm install \
    && cd ..

COPY . hs-rosetta

RUN cd hs-rosetta \
    && npm install

FROM base
ENV PATH="${PATH}:/opt/hsd/bin:/opt/hsd/node_modules/.bin"
COPY --from=build /opt/hsd/ /opt/hsd/
COPY --from=build /opt/hs-rosetta/ /opt/hs-rosetta

ENTRYPOINT ["hsd"]
CMD ["--index-tx", "--index-address", "--plugins", "/opt/hs-rosetta/lib/plugin.js", "--prefix=/data"]
