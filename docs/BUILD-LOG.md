# November 25, 2026 · Field Card Delivery and Measurement

**Question.** Let a publisher distinguish a delivered file from a button click.

**Source and change.** potify-first-cycle at `7bc29685d6decd1f3d1bbbb0216f837bc7701a51`. Worker, D1 migration and original delivery tests. Use only behind a trusted authenticated edge that strips client-supplied identity headers. The fixture uses an in-memory database.

**Observed result.** Seven tests passed against the in-memory SQLite fixture, covering consent, delivery, exclusion rules, erasure, reporting and attribution.

```sh
node --test tests/field-tracking.test.mjs
```

**Next acceptance check.** Run the fixture suite and demonstrate that an eligible file delivery can be counted while an unrelated event cannot.

**Owner and decision.** Chance owns the public release and approves campaign copy. No visitor rows, private reports or production authentication bindings are included.

This dated record describes the developer package. Verify remote commit and tree in the publication receipt before announcing a GitHub release.
