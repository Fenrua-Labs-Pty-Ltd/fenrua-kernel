# Security Policy

Fenrua Kernel is a research-grade P/N521 utility primitive. It is not approved
for custody, transaction authorization, identity, consensus, validator
admission, or other production security decisions.

## Reporting a vulnerability

Do not publish an exploitable finding, private witness, credential, live node
identifier, bypass procedure, or proof-forgery technique in a public issue.
Use GitHub's private vulnerability-reporting flow from this repository's
**Security** tab.

Public issues may be used only for non-sensitive hardening, documentation and
reproducibility concerns. Remove all secrets before attaching evidence.

## Supported versions

Until the first tagged candidate release, only the current `main` branch is in
scope. Research status means a report will be investigated; it does not imply
an SLA or a production-security warranty.

## Disclosure record

Public-safe findings and their verified resolutions are recorded in
[SECURITY_AUDIT_LOG.md](SECURITY_AUDIT_LOG.md). A finding is not marked resolved
until its regression test passes and the cited source is committed.
