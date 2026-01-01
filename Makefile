.PHONY: build check install

build:
	docker compose build

check:
	cd collector && bun run typecheck
	docker compose config --quiet

install:
	cd collector && bun install
