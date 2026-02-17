# Secrets Management Options for Railway

## Problem

The `CALCULUS_API_KEY` is owned by a third party. We need a way for them to provide it without the project owner necessarily seeing the raw value.

## What Railway Has Natively

Railway environment variables are visible to **all project members**. There's no built-in way to let someone set a variable without project members being able to read it.

## Options

### 1. Direct handoff (simplest)

Ask the third party to send the key through a secure channel (e.g., a self-destructing link via [onetimesecret.com](https://onetimesecret.com)), paste it into Railway as `CALCULUS_API_KEY`.

**Pros:** Zero overhead, works immediately.
**Cons:** You see the key.

### 2. Infisical (self-hosted on Railway)

[One-click deploy on Railway](https://railway.com/deploy/infisical). Open-source secrets manager. Give the third party access to upload the key, configure the ML server to fetch it from Infisical at runtime.

**Pros:** You never see the raw key, open-source, runs on Railway.
**Cons:** Extra service to maintain, added complexity.

### 3. HashiCorp Vault (self-hosted on Railway)

[One-click deploy on Railway](https://railway.com/deploy/hashicorp-vault). Enterprise-grade secrets management. Same concept as Infisical but more feature-rich.

**Pros:** Industry standard, fine-grained access control.
**Cons:** Heavier than Infisical, more complex to configure.

### 4. Doppler (SaaS)

[doppler.com](https://www.doppler.com/) — has an official Railway integration that syncs secrets to Railway variables. Role-based permissions let you control who sees what.

**Pros:** Managed service, easy setup, audit logs.
**Cons:** Third-party SaaS dependency, potential cost.

## Recommendation

For a single API key, **option 1** (secure handoff) is the pragmatic choice. If strict secret isolation is required, **option 2** (Infisical) is the lightest self-hosted solution.
