---
name: generate-connection
description: Interactively generate a Pricefx Integration Manager connection JSON file. Supports pricefx, sftp, rest-oauth2, rest-basic, rest-jwt, rest-public connection types. Use when the user says "create connection", "add connection", "configure sftp/rest/pricefx".
---

# Generate Connection

You are generating a connection JSON file for a Pricefx Integration Manager project. One connection per file. Never hardcode credentials — always use `{{property}}` placeholders.

## Step 1: Ask Connection Type

Ask: **What type of connection do you want to create?**

| Type | Use Case |
|------|----------|
| `pricefx` | Pricefx partition (default or additional) |
| `sftp` | External SFTP server |
| `rest-oauth2` | REST API with OAuth2 client credentials |
| `rest-basic` | REST API with Basic HTTP auth |
| `rest-jwt` | REST API with JWT bearer token |
| `rest-public` | REST API with no authentication |

If the user already stated the type in $ARGUMENTS, skip asking.

## Step 2: Collect Fields and Generate JSON

Ask all required fields for the chosen type in one message. Substitute real values for URLs/hosts/ports; always use `{{property}}` placeholders for credentials. Output the complete JSON plus the `application.properties` snippet.

### pricefx
Required: partition URL, partition name, username, password.
```json
{
  "name": "pricefx",
  "type": "pricefx",
  "url": "{partition-url}",
  "partition": "{partition-name}",
  "username": "{{pfx.username}}",
  "password": "{{pfx.password}}"
}
```
```properties
pfx.username={username}
pfx.password={ENC}changeme
```

### sftp
Required: host, port (default 22), username, auth method (password or key), remote directory.
```json
{
  "name": "{connection-name}",
  "type": "sftp",
  "url": "{host}",
  "port": 22,
  "username": "{{sftp.username}}",
  "password": "{{sftp.password}}",
  "remoteDirectory": "{/remote/dir}"
}
```
For key auth, replace `"password"` with `"privateKey": "{{sftp.privateKey}}"`.
```properties
sftp.username={username}
sftp.password={ENC}changeme
```

### rest-oauth2
Required: base URL, token URL, client ID, client secret, scope (optional).
```json
{
  "name": "{connection-name}",
  "type": "rest-oauth2",
  "url": "{base-url}",
  "authUrl": "{token-url}",
  "clientId": "{{oauth.clientId}}",
  "clientSecret": "{{oauth.clientSecret}}",
  "authRequestTemplate": "{\"grant_type\": \"client_credentials\", \"client_id\": \"::clientId\", \"client_secret\": \"::clientSecret\"}"
}
```
If scope provided, add `"scope": "{{oauth.scope}}"` and `oauth.scope={scope}` to properties.
```properties
oauth.clientId={client-id}
oauth.clientSecret={ENC}changeme
```

### rest-basic
Required: base URL, username, password.
```json
{
  "name": "{connection-name}",
  "type": "rest-basic",
  "url": "{base-url}",
  "username": "{{api.username}}",
  "password": "{{api.password}}"
}
```
```properties
api.username={username}
api.password={ENC}changeme
```

### rest-jwt
Required: base URL, token. Optional: issuer.
```json
{
  "name": "{connection-name}",
  "type": "rest-jwt",
  "url": "{base-url}",
  "token": "{{jwt.token}}"
}
```
If issuer provided, add `"issuer": "{issuer}"`.
```properties
jwt.token={ENC}changeme
```

### rest-public
Required: base URL only.
```json
{
  "name": "{connection-name}",
  "type": "rest-public",
  "url": "{base-url}"
}
```
No credentials needed.

## Step 3: Confirm Connection Name

For non-pricefx connections, propose a name based on type + host/URL (e.g., `sftp-server`, `erp-api`, `external-oauth2`). Ask the user to confirm or change it.

The `name` field in JSON and the file name must match exactly:
- `erp-api` → `erp-api.json`
- `pricefx` → `pricefx.json`

## Step 4: Write Files

Write to: `src/main/resources/repo/connections/{connection-name}.json`

Check `src/main/resources/repo/config/application.properties`. If it exists, append only missing property keys. If not, display the properties block for the user to add manually.

Tell the user:
1. Path of the written JSON file
2. Properties block to add to `application.properties`
3. **Replace `{ENC}changeme` with the encrypted value via PlatformManager secrets**

Then ask: **Would you like to reference this connection in an existing route?** If yes, show:
```xml
<to uri="pfx-rest:get?uri=/endpoint&amp;connection={connection-name}"/>
<to uri="pfx-api:fetch?objectType=P&amp;connection={connection-name}"/>
```

## Important Rules

- NEVER hardcode passwords, tokens, client secrets, or private keys — always `{{property.name}}`
- The default Pricefx connection MUST be named `pricefx`
- One connection per JSON file
- File name must exactly match the `name` field in the JSON
- Use `{ENC}changeme` as placeholder in `application.properties` to signal encryption required
- For provisioned IM: use JSON files in `connections/` — do NOT use `integration.pfx.*` in `application.properties` for additional partitions
- Test connectivity after deployment: PlatformManager → Connections → Test
- No customer data, real credentials, or production URLs in generated output
- Reference: `integration-manager/docs/connections.md`
