# Web architecture

The web application has three dependency tiers:

```text
frontend -> atbbs -> atproto
```

Dependencies only point to the right. Generated lexicons live beside these tiers
and are consumed by `atbbs` when it validates or constructs product records.

## `atproto`

`src/atproto` owns protocol transport and repository access. Put XRPC calls,
response-envelope validation, AT URI parsing, raw records, identities, blob URLs,
and generic repository operations here.

This tier must not know about ATBBS collections, product models, React, routing,
queries, caching, or browser files.

## `atbbs`

`src/atbbs` is the browser-neutral product layer. Put schema validation, joins,
sorting, omission and visibility policy, product limits, prepared read models,
and intent-level commands here.

Public inputs and outputs use plain data or browser-neutral capabilities. For
example, an attachment upload receives a `PendingAttachment` with a `read()`
method; it does not receive a browser `File`. Read models expose prepared URLs and
route identifiers, so consumers do not inspect blob references or parse AT URIs.

This tier may depend on `atproto` and generated lexicons. It must not depend on
React, TanStack Query, routing, JSX, or browser globals.

## `frontend`

`src/frontend` owns React rendering, routes, loaders, query definitions and keys,
cache updates, mutations, navigation, alerts, forms, and browser adapters. It uses
the product readers and `AtbbsWriter` instead of protocol transports or generic
repository functions.

`src/frontend/ui` contains presentation controls only. A UI control may depend on
React and another UI control, but not on product features, query modules, `atbbs`,
or `atproto`.

## Placement examples

| Change | Owner |
| --- | --- |
| Add an XRPC response validator | `atproto` |
| Change thread sorting or reply omission | `atbbs/discussion` |
| Add a community query key or invalidation | `frontend/features/community` |
| Convert a browser `File` into readable bytes | `frontend` browser adapter |
| Build an ATBBS post record and upload attachments | `atbbs` command |
| Add a reusable unlabeled form control | `frontend/ui` |

Do not add `shared`, `common`, or broad `utils` directories. Choose the concrete
owner and use a name that describes the responsibility. The architecture test at
the web root parses imports with the TypeScript compiler API and rejects boundary
violations and browser globals in `atbbs`.
