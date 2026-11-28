# Field Card Delivery and Measurement

## Find your way in

| If you are… | Start here | Try this |
| --- | --- | --- |
| A publisher | [Inspect the delivery fixture](tests/field-tracking.test.mjs) | Compare a direct file request with a page visit. |
| A developer | [Read the Worker](src/field-worker.mjs) | Follow how delivery is recorded using synthetic inputs. |
| A reader | [Explore Field Card 01](https://github.com/jonathanbabec5-hash/potify-field-card) | Find the separate card and its reading companion. |

[Complete repository directory tree](docs/DIRECTORY.md)

## Did a reader receive a field card?

A button can be pressed without a PDF arriving. A PDF can arrive without the reader ever seeing the button. For a publisher making a useful thing on paper, that difference is the whole measurement question.

Follow the [test request](tests/field-tracking.test.mjs) from the landing page to the file, then inspect the [Worker](src/field-worker.mjs). The SQLite fixture separates anonymous delivery counts, consent-based attribution and excluded traffic. Seven local cases are documented; no real visitor records are included.

Run a direct-file request and a page-only visit in the fixture. Explain which counter should change in each case and why. A good correction uses synthetic requests and protects the reader’s choice. It does not turn delivery into a claim that the card was read.

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
