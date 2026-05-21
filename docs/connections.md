# Connection Configuration Guide

Connections define how IM connects to external systems (Pricefx, SFTP servers, REST APIs, databases). They are stored as JSON files in `config/connections/`.

## Endpoint-field naming (READ THIS FIRST)

The JSON field name for the connection's endpoint is **not** uniform across discriminator classes — it depends on the Java class the discriminator points at:

| Discriminator | Endpoint field(s) |
|---|---|
| `PriceFxConnection` | `uri` |
| `SFTPConnection` (note: uppercase) | `host` + `port` (+ `path`, `username`, `password`, `strictHostKeyChecking`) |
| `OAuth2Connection`, `BasicConnection`, `JwtConnection`, `NoopConnection` (REST family) | `url` (+ `authUrl` for token-based variants) |
| `S3Connection` | `region` + `bucket` (no URL field — endpoint is derived) |

These are the actual Spring/Jackson deserialization keys from the IM Java sources (`net.pricefx.integration.component.rest.domain.connection.*`). Using `uri` on an `OAuth2Connection` JSON, or `url` on a `PriceFxConnection` JSON, will silently drop the value at deserialization time — the connection will fail to authenticate with a confusing null-pointer or "host not configured" error.

## Pricefx Connection (JSON)

```json
{
  "id": "pricefx",
  "discriminator": "net.pricefx.integration.component.rest.domain.connection.PriceFxConnection",
  "partition": "your-partition",
  "username": "admin",
  "password": "your-password",
  "uri": "https://your-cluster.pricefx.eu/pricefx"
}
```

### Additional Pricefx Connections

For connecting to multiple Pricefx instances:

```json
{
  "id": "secondary-pfx",
  "discriminator": "net.pricefx.integration.component.rest.domain.connection.PriceFxConnection",
  "partition": "other-partition",
  "username": "admin",
  "password": "password",
  "uri": "https://other-cluster.pricefx.eu/pricefx"
}
```

Reference in routes: `connection=secondary-pfx`

## REST/OAuth2 Connections

For connecting to REST APIs with OAuth2 authentication (e.g., Salesforce):

### OAuth2 Connection (JSON)

```json
{
  "id": "salesforce.connection",
  "discriminator": "net.pricefx.integration.component.rest.domain.connection.OAuth2Connection",
  "url": "https://customer.my.salesforce.com",
  "authUrl": "https://customer.my.salesforce.com/services/oauth2/token",
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret",
  "username": "integrationuser@company.com",
  "password": "password+securityToken"
}
```

The grant type defaults to `password`. To use a different grant (e.g. `client_credentials`), override `authRequestTemplate` — there is **no** standalone `grantType` field on `OAuth2Connection`.

### Basic Auth Connection (JSON)

```json
{
  "id": "basic.connection",
  "discriminator": "net.pricefx.integration.component.rest.domain.connection.BasicConnection",
  "url": "https://api.example.com",
  "username": "user",
  "password": "password"
}
```

### JWT Connection (JSON)

```json
{
  "id": "jwt.connection",
  "discriminator": "net.pricefx.integration.component.rest.domain.connection.JwtConnection",
  "url": "https://api.example.com",
  "authUrl": "https://api.example.com/auth/token",
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret"
}
```

### Noop Connection (JSON)

For APIs that don't require authentication:

```json
{
  "id": "public-api",
  "discriminator": "net.pricefx.integration.component.rest.domain.connection.NoopConnection",
  "url": "https://public-api.example.com"
}
```

### Using REST Connections in Routes

```xml
<!-- With connection ID -->
<toD uri="pfx-rest:get?uri=/api/data&amp;connection=salesforce.connection"/>

<!-- Connection provides base URL, uri provides the path -->
<toD uri="pfx-rest:get?uri=/services/data/v48.0/query/&amp;q=select Name from Account&amp;connection=salesforce.connection&amp;connectionTimeoutMs=500000"/>
```

## SFTP Connections

SFTP connections configure server access for file transfer.

### SFTP Connection (JSON)

```json
{
  "id": "sftp.connection",
  "discriminator": "net.pricefx.integration.component.sftp.connection.SFTPConnection",
  "host": "sftp.example.com",
  "port": 22,
  "path": "/",
  "username": "sftpuser",
  "password": "password",
  "strictHostKeyChecking": false
}
```

Fields available on `SFTPConnection`: `host`, `port` (default `22`), `path` (default `"/"`), `username`, `password`, `strictHostKeyChecking` (default `false`). The class lives in `net.pricefx.integration.component.sftp.connection.SFTPConnection` (uppercase `SFTP`). There is **no** `knownHostsFile` or `privateKeyFile` field — known-hosts handling is controlled by `strictHostKeyChecking`, and IM does not currently support SSH-key authentication via this connection type.

### Using SFTP Connections in Routes

```xml
<from uri="pfx-sftp://remote/path?connection=sftp.connection&amp;delete=true"/>
<to uri="pfx-sftp://remote/upload?connection=sftp.connection"/>
```

## S3 Connections

```json
{
  "id": "s3.connection",
  "discriminator": "net.pricefx.integration.component.s3.connection.S3Connection",
  "accessKey": "your-access-key",
  "secretKey": "your-secret-key",
  "region": "us-east-1"
}
```

## Connection File Location

Connections are stored as JSON files in:

```
config/
  connections/
    salesforce.connection.json
    sftp.connection.json
    secondary-pfx.json
```

The file name (without `.json`) becomes the connection ID.

## Default Connection

When a component parameter `connection` is not specified, the default Pricefx connection (from `application.properties`) is used. This applies to `pfx-api`, `pfx-config`, and other Pricefx-specific components.

For `pfx-rest`, `pfx-sftp`, and `pfx-sql`, a connection is typically required unless the URI includes full connection details.

## Best Practices

### Pricefx connection naming
- If the project has only one `PriceFxConnection`, it is recommended to name it `pricefx`. When the connection is named `pricefx`, it is used as the implicit default and you don't need to add a `connection` parameter on any `pfx-api` component.
- NEVER add `connection=pricefx` to route URIs — it is redundant since `pricefx` is the default.
- Only use the `connection` parameter when connecting to a non-default Pricefx instance.

### Default SFTP connection — use `file` component instead
- The connection named `default-sftp-connection` (or any name starting with `default-sftp-connection`) refers to the IM pod's own SFTP storage, which is mounted directly into the pod's local file system.
- **Do NOT use `pfx-sftp` with `default-sftp-connection`.** Instead, use the `file` component to access these files directly: `file://{{integration.sftp.root}}/{path}`
- Using `pfx-sftp` to access locally mounted storage adds unnecessary SFTP protocol overhead, impacting performance and cost. The `file` component accesses the same files directly from the file system — faster and simpler.
- Only use `pfx-sftp` when connecting to an **external** SFTP server (not the default IM storage).

## Connection Discriminator Reference

| Discriminator Class | Use Case |
|---------------------|----------|
| `net.pricefx.integration.component.rest.domain.connection.PriceFxConnection` | Pricefx server |
| `net.pricefx.integration.component.rest.domain.connection.OAuth2Connection` | REST with OAuth2 (Salesforce, etc.) |
| `net.pricefx.integration.component.rest.domain.connection.BasicConnection` | REST with Basic Auth |
| `net.pricefx.integration.component.rest.domain.connection.JwtConnection` | REST with JWT |
| `net.pricefx.integration.component.rest.domain.connection.NoopConnection` | REST without auth |
| `net.pricefx.integration.component.sftp.connection.SFTPConnection` | SFTP servers (uppercase SFTP) |
| `net.pricefx.integration.component.s3.connection.S3Connection` | AWS S3 |

The discriminator string is consumed by `Class.forName()` at deserialization — a typo in the class path (or wrong casing on `SFTP`) throws `ClassNotFoundException` at deploy time, **not** a runtime null-pointer.
