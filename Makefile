.PHONY: check install

check:
	cd collector && bun run typecheck
	actionlint
	act workflow_dispatch --input build_aio=true -n -P ubuntu-latest=catthehacker/ubuntu:act-latest
	docker buildx build --platform linux/amd64 .

install:
	cd collector && bun install
