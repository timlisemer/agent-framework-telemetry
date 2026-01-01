.PHONY: check install

check:
	cd collector && bun run typecheck
	actionlint
	act workflow_dispatch --input build_aio=true -n -P ubuntu-latest=catthehacker/ubuntu:act-latest

install:
	cd collector && bun install
