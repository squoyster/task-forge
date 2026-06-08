
agent-index:
	./scripts/build-agent-index.sh

agent-report:
	@wc -c .agent/*.idx 2>/dev/null || true
	@wc -w .agent/*.idx 2>/dev/null || true
