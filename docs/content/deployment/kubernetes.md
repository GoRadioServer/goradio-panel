# Kubernetes

Example manifests live in `k8s/` — Namespace, ConfigMap, Secret template,
PVC, Deployment, Service, and Ingress — tied together with a
`kustomization.yaml`.

```sh
cp k8s/secret.example.yaml k8s/secret.yaml   # fill in real values -- gitignored, never commit it
kubectl apply -f k8s/secret.yaml
kubectl apply -k k8s/
```

## Replicas: stuck at 1

**Read `k8s/deployment.yaml`'s top comment before touching replica count.**
The panel stores user accounts and listener stats in a local SQLite file
on the PVC. SQLite has a single writer — two pods would either fail to
both mount a `ReadWriteOnce` volume, or, on a `ReadWriteMany` volume,
corrupt the database racing each other. `strategy: Recreate` exists for
the same reason: a rolling update briefly runs old and new pods together,
which two SQLite writers on the same file can't survive.

If you outgrow a single pod, pointing `db.sqlite_path` at a different
volume-backed path is not the fix — the fix is swapping SQLite for a real
database server (the schema is small; see `internal/db`) before scaling
out.

## Ingress

`k8s/ingress.yaml` is a worked example against ingress-nginx +
cert-manager — adjust it, or replace it entirely, to match your actual
cluster's ingress controller.

Its `proxy-buffering`/`proxy-read-timeout` annotations matter if you keep
ingress-nginx: `GET /api/stations/{slug}/events` is a long-lived
server-sent-events stream feeding the UI's live updates. Without them,
nginx's default response buffering delays or batches events instead of
forwarding them as they arrive, and its default 60-second
`proxy-read-timeout` kills the connection outright if a station goes quiet
for a minute.

## Configuration

The Deployment is configured the same way as the
[Docker image](docker.md) — environment variables sourced from the
ConfigMap and Secret, not a mounted `panel.yaml`. See
[Configuration](../getting-started/configuration.md#environment-variable-overrides)
for what each variable maps to.
