all:

lint:
	@npm run lint

docs:
	@npm run docs

cover:
	@npm run cover

test:
	@npm run test

.PHONY: all lint test cover docs
