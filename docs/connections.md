# Connection Configuration Guide

Connections define how IM connects to external systems (Pricefx, SFTP servers, REST APIs, databases). They are stored as JSON files in `config/connections/` or defined as XML beans.

## Pricefx Connection

The primary Pricefx connection is configured in `application.properties` (not as a JSON connection file):

```properties
integration.pfx.url=https://your-cluster.pricefx.eu/pricefx
integration.pfx.username=admin
integration.pfx.partition=your-partition
integration.pfx.password=your-password
integration.pfx.debug=false
```

### Additional Pricefx Connections (JSON)

For connecting to multiple Pricefx instances:

```json
{
  "id": "secondary-pfx",
  "discriminator": "net.pricefx.integration.component.rest.domain.connection.PriceFxConnection",
  "partition": "other-partition",
  "username": "admin",
  "password": "password",
  "uri": "https://other-cluster.pricefx.eu/pricefx",
  "connectTimeout": 6000
}
```

Reference in routes: `connection=secondary-pfx`

## Pricefx Connection (XML Bean)

Connections can also be defined as XML beans in route files:

```xml
<pfx:connection id="secondaryPfx"
                uri="https://other-cluster.pricefx.eu/pricefx"
                partition="other-partition"
                username="admin"
                password="{{secondary.pfx.password}}"
                debug="false"
                connectTimeout="6000"/>
```

### `<pfx:connection>` Attributes

| Attribute | Description | Required |
|-----------|-------------|----------|
| `id` | Connection bean ID | yes |
| `uri` | Server URL | yes |
| `partition` | Pricefx partition | yes |
| `username` | Username | yes |
| `password` | Password | yes |
| `twoFactorAuthSecurityToken` | 2FA security token | no |
| `debug` | Enable debug logging | no |
| `connectTimeout` | Connection timeout (ms) | no |
| `useJsonWebToken` | Use JWT authentication | no |

## REST/OAuth2 Connections

For connecting to REST APIs with OAuth2 authentication (e.g., Salesforce):

### OAuth2 Connection (JSON)

```json
{
  "id": "salesforce.connection",
  "discriminator": "net.pricefx.integration.component.rest.domain.connection.OAuth2Connection",
  "uri": "https://customer.my.salesforce.com",
  "authUri": "https://customer.my.salesforce.com/services/oauth2/token",
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret",
  "username": "integrationuser@company.com",
  "password": "password+securityToken",
  "grantType": "password"
}
```

### Basic Auth Connection (JSON)

```json
{
  "id": "basic.connection",
  "discriminator": "net.pricefx.integration.component.rest.domain.connection.BasicConnection",
  "uri": "https://api.example.com",
  "username": "user",
  "password": "password"
}
```

### JWT Connection (JSON)

```json
{
  "id": "jwt.connection",
  "discriminator": "net.pricefx.integration.component.rest.domain.connection.JwtConnection",
  "uri": "https://api.example.com",
  "authUri": "https://api.example.com/auth/token",
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
  "uri": "https://public-api.example.com"
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
  "discriminator": "net.pricefx.integration.connection.SftpConnection",
  "host": "sftp.example.com",
  "port": 22,
  "username": "sftpuser",
  "password": "password",
  "knownHostsFile": "/path/to/known_hosts",
  "privateKeyFile": "/path/to/private_key"
}
```

### Using SFTP Connections in Routes

```xml
<from uri="pfx-sftp://remote/path?connection=sftp.connection&amp;delete=true"/>
<to uri="pfx-sftp://remote/upload?connection=sftp.connection"/>
```

## S3 Connections

```json
{
  "id": "s3.connection",
  "discriminator": "net.pricefx.integration.component.s3.S3Connection",
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

## Connection Discriminator Reference

| Discriminator Class | Use Case |
|---------------------|----------|
| `...connection.PriceFxConnection` | Pricefx server |
| `...connection.OAuth2Connection` | REST with OAuth2 (Salesforce, etc.) |
| `...connection.BasicConnection` | REST with Basic Auth |
| `...connection.JwtConnection` | REST with JWT |
| `...connection.NoopConnection` | REST without auth |
| `...connection.SftpConnection` | SFTP servers |
| `...s3.S3Connection` | AWS S3 |

All connection classes are under `net.pricefx.integration.component.rest.domain.connection` (REST types) or their respective component packages.
