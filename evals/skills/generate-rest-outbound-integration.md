# generate-rest-outbound-integration Evaluation

## Metadata

- Skill: `pricefx-im-plugin:generate-rest-outbound-integration`
- Version: 1.0.9
- Last updated: 2026-05-21
- Confusion partner: `generate-inbound-rest-endpoint` (inverse direction)

## Description under test

> Use when Pricefx Integration Manager must push data to an external system via HTTP (POST, PUT, PATCH) — says "call an external REST API", "outbound REST", "push to ERP", "send to webhook", "POST to external system", or needs OAuth 2.0 / API-key / HTTP Basic / mTLS / SAP JWT auth, with optional throttling, retry, and dry-run toggle. For an INBOUND endpoint exposed from IM use `generate-inbound-rest-endpoint`.

## Positive Cases

### Case 1: Event-driven POST to ERP

**Prompt**: `After Pricefx event ITEM_APPROVED_PL, we need to POST the approved contract to our ERP at https://erp.internal/api/v2/contracts. OAuth2 client-credentials auth.`

**Expected behavior**:
- [ ] Skill triggers
- [ ] Event-driven trigger + OAuth2 connection JSON
- [ ] `pfx-rest:post` step

### Case 2: Scheduled webhook push

**Prompt**: `Build outbound REST integration that pushes price list updates to downstream webhook https://hooks.example.com/pricelist on a daily schedule. Needs retry on 5xx errors.`

**Expected behavior**:
- [ ] Skill triggers
- [ ] Quartz cron + retry on transient errors
- [ ] Outbound POST pattern

### Case 3: SAP-style JWT+CSRF flow

**Prompt**: `Pricefx → external SAP OData system: when a quote is submitted (QUOTE_SUBMITTED event), POST it via SAP-style JWT + CSRF + cookies flow to SAP API Management.`

**Expected behavior**:
- [ ] Skill triggers
- [ ] Uses sap-jwt-csrf auth mode → references `references.md` for the SAP pattern
- [ ] Cookie handler + CSRF token route

### Case 4: Bearer token + throttling

**Prompt**: `I have a webhook receiver at https://partner.example.com/webhook that wants Pricefx data POSTed daily at 2am. Needs Bearer token auth and throttling to 5 req/s.`

**Expected behavior**:
- [ ] Skill triggers
- [ ] OAuth2 or apikey auth, plus throttling
- [ ] Daily Quartz cron

## Negative Cases

### Case 1: INBOUND REST endpoint (should pick `generate-inbound-rest-endpoint`)

**Prompt**: `I want to expose a REST endpoint from IM that external systems can call to submit a quote via POST /quotes. Needs JSON request validation and structured 400 errors.`

**Expected behavior**:
- [ ] This skill does NOT trigger
- [ ] `generate-inbound-rest-endpoint` is selected (inverse direction — IM as server, not client)

### Case 2: Generic export to CSV (should pick `generate-export-integration`)

**Prompt**: `Export Pricefx changed products to CSV daily on SFTP.`

**Expected behavior**:
- [ ] This skill does NOT trigger
- [ ] `generate-export-integration` is selected (file-based export, not REST)

## Edge Cases

### Case 1: "Call REST API" — direction unclear

**Prompt**: `I need to integrate Pricefx with a REST API.`

**Expected behavior**:
- [ ] Claude asks: outbound (IM → external) or inbound (external → IM)?
- [ ] Does NOT commit blindly to one direction
