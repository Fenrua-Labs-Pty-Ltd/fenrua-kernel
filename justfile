set shell := ["bash", "-euo", "pipefail", "-c"]

default:
  @just --list

# Build the native P/N521 library and validate the arithmetic toolchain.
build:
  pnpm run build

# Run exactly ten deterministic P/N521 Genesis cases and write SHA-256 evidence.
test:
  pnpm run test

# Generate research-only local-ceremony RapidSnark proofs for N521 add/sub.
prove:
  pnpm run prove

# Verify Genesis records plus the published valid/tampered development proofs.
evidence:
  pnpm run evidence

# Re-run evidence verification while requiring this exact Node/OS host.
evidence-same-host:
  pnpm run evidence:same-host
