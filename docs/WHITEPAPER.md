# Field Card Delivery and Measurement
## Whitepaper · public developer edition

**November 25, 2026 · Worker source and SQL fixtures**

### Goal and audience

Let a publisher distinguish a delivered file from a button click. The immediate audience is independent publishers and privacy-minded developers.

### Design and implementation

The worker serves the Field Card using consent-aware request handling, a database schema and a protected reporting path. Tests use an in-memory SQLite store. The implementation distinguishes anonymous counters from consent-based measurement. A direct PDF request can bypass the landing page and still needs correct accounting.

### What a contributor can establish

Seven tests passed against the in-memory SQLite fixture, covering consent, delivery, exclusion rules, erasure, reporting and attribution. Exercise reuse, retention, bot exclusion and denied reporting access with disposable fixtures. The reporting endpoint relies on a trusted upstream identity boundary.

### Evidence and outstanding work

No visitor rows, private reports or production authentication bindings are included. The next acceptance case is concrete. Run the fixture suite and demonstrate that an eligible file delivery can be counted while an unrelated event cannot.

### Place in POTIFY

Qualify one publisher interested in paid implementation support. Analytics volume itself is not revenue. The marketing plan gives the test window and the evidence for a commercial outcome.

[Source provenance](source.json) · [Build log](BUILD-LOG.md) · [Marketing plan](MARKETING.md)
