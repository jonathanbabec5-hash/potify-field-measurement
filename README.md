# Field Card Delivery and Measurement

[Complete repository directory tree](docs/DIRECTORY.md)

**Worker source and SQL fixtures.** Let a publisher distinguish a delivered file from a button click.

### Setup and usage

Use Node.js 24 for the included checks. Supply a trusted authentication gateway and database configuration before any independent deployment.

```sh
node --test tests/field-tracking.test.mjs
```

Reproduce the consent and delivery tests. 

### Developer entry points

The worker serves the Field Card using consent-aware request handling, a database schema and a protected reporting path. Tests use an in-memory SQLite store. Explore `drizzle/`, `public/`, `src/`, `tests/` in the full tree.

### Verification

Seven tests passed against the in-memory SQLite fixture, covering consent, delivery, exclusion rules, erasure, reporting and attribution.

```sh
node --test tests/field-tracking.test.mjs
```

### Release scope

No visitor rows, private reports or production authentication bindings are included. potify-first-cycle at `7bc29685d6decd1f3d1bbbb0216f837bc7701a51`. Worker, D1 migration and original delivery tests. Use only behind a trusted authenticated edge that strips client-supplied identity headers. The fixture uses an in-memory database.

[Technical whitepaper](docs/WHITEPAPER.md) · [Marketing and sales plan](docs/MARKETING.md) · [Dated developer log](docs/BUILD-LOG.md)

Existing asset and code terms remain applicable. Public access to a recording, illustration, brand or manuscript does not itself grant commercial reuse rights.
