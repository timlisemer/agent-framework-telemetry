.PHONY: check install

check:
	cd collector && bun run typecheck
	actionlint

install:
	cd collector && bun install
