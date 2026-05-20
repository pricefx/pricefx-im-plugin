# Provisioned Integration FAQs

Operational FAQs for the Pricefx Integration Manager **provisioned** runtime — answers to recurring questions that aren't covered by the component reference.

**Source:** https://pricefx.atlassian.net/wiki/spaces/CUST/pages/4697128997/Provisioned+Integration+FAQs

---

## How to download big files using `pfx-sftp` or `sftp`

By default Camel SFTP loads files into memory first, which causes `OutOfMemoryError` on large files.

**Solution:** set `streamDownload=true` on the consumer URI to stream files instead.

```xml
<from uri="pfx-sftp://remote/path?connection=sftp.connection&amp;streamDownload=true"/>
```

All parameters set on `pfx-sftp:` are passed through to the underlying Camel SFTP component — any Camel SFTP option works with `pfx-sftp`.

**Reference:** https://camel.apache.org/components/3.21.x/sftp-component.html

---

## Encrypted properties can NOT be transferred between environments

Every environment has its own encryption key, so you **cannot** copy encrypted properties from one environment to another (e.g. dev → qa). Each environment must encrypt its own values via the Platform Manager UI.

Introduced in IM **4.6.0** (PFIM-6280).

---

## Where to put your property

### `application.properties` in `repo/config`

- Written by the user via Platform Manager UI (Settings → Runtime Properties); regenerated whenever the user changes a value.
- Recommended for properties **shared between environments**: file patterns, file URIs, etc.
- **This is the only property file that supports encrypted properties.**

### `application-app_xxx.properties`

- For **environment-specific** settings: cron schedules, batch sizes, error email addresses, etc.
- **Does not support encrypted properties.**

---

## How to use FreeMarker template in provisioned IM

**Step 1:** in Platform Manager, open the provisioned IM instance and upload the FreeMarker template via the **"New Resource"** button.

### Since version 4.10.0

All resources are automatically synced between the Git repository and the provisioned IM instance file system, stored under `/home/im/repository/resources`.

**Step 2 — one-liner reference from a route:**

```xml
<to uri="freemarker:file:/home/im/repository/resources/example.fm?contentCache=false"/>
```

### Before version 4.10.0 (Deprecated)

**Step 2 — load the template via `pfx-resources` and write it to local disk:**

```xml
<to uri="pfx-resources:load?name=data-report-email.ftl"/>
<to uri="file://{{integration.data}}/ftl/?fileName=data-report-email.ftl"/>
```

**Step 3 — render the template:**

```xml
<to uri="freemarker:file://{{integration.data}}/ftl/data-report-email.ftl"/>
```

> Use `freemarker:file://path/to/my.ftl` (file-based) instead of `freemarker:resourceName` on provisioned IM.

---

## How to download Quote PDF

Call the partition's `quotemanager.fetchpdf` endpoint with `output=pdf` and a `templateName`:

```xml
<toD uri="pfx-rest:post?connection=pricefx&amp;uri=/quotemanager.fetchpdf/${header[quoteId]}&amp;output=pdf&amp;templateName=${header[templateName]}"/>
```

---

## How to create multiple instances of your Groovy converter

A Groovy converter can be parametrized inline — pass an argument to make distinct instances with different format patterns:

```xml
<body in="value" out="result" converter="myConverter('us')"/>
```

---

## How to use `converterStrategy` for one API call

For the **whole project**:

```properties
integration.mappers.default-converter-strategy-type=MANUAL
```

For **one call** only — pass `converterStrategyType` on the URI:

```xml
<to uri="pfx-api:loaddata?converterStrategyType=MANUAL&amp;....."/>
```

---

## Binding Spring properties in Groovy

In a Groovy bean/processor, bind values from `application.properties` directly:

```groovy
public @Value('${irm.anzac.sftp-done-filePattern}') String sftpDoneFilePattern;
public @Value('${irm.anzac.gzipData-filePattern}') String gzipDataFilePattern;
```

---

## How to switch to a custom Docker image when custom dependencies are added

Some scenarios (adding a new dataformat, third-party JAR, etc.) require dependencies in `pom.xml` that are not part of the standard image. In Platform Manager, use the **"Convert to Custom Image"** action — found in the Failed Events / Build panel — to switch the instance from `Standard` to `Custom`.

---

## How to add a dataformat

Manual IM instances had `camel-context.xml` available; provisioned instances do **not**. To add a custom dataformat (e.g. Parquet) on provisioned:

1. Create a bean XML file in `beans/`
2. Add the dependency to `pom.xml`
3. Convert the instance to a [custom image](#how-to-switch-to-a-custom-docker-image-when-custom-dependencies-are-added)

Example — Parquet/Avro dataformat (https://camel.apache.org/components/4.8.x/dataformats/parquetAvro-dataformat.html):

```xml
<bean id="parquet" class="org.apache.camel.model.dataformat.ParquetAvroDataFormat">
    <property name="compressionCodecName" value="GZIP"/>
</bean>
```

---

## How to whitelist a static subclass

Whitelist static inner classes using `$` as the delimiter between outer and inner class names:

```properties
integration.groovy-sandbox.custom-allowed-types=org.apache.avro.SchemaBuilder$FieldAssembler
```

---

## Multipart Form Submit Processor — File Upload

`pfx-rest` and Camel HTTP do not natively support submitting a multipart form with both a file upload and a text body. A small Groovy transform builds the multipart entity:

```xml
<pollEnrich timeout="500">
    <simple>file:{{integration.sftp.root}}/outbound?fileName=FEF750A1D5CDBB6-0000000000000001-30303083-20250250.pdf</simple>
</pollEnrich>
<transform>
    <groovy>
        // Read the incoming message
        File file = exchange.getIn().getBody(File.class)

        // Encode the file as a multipart entity
        org.apache.hc.client5.http.entity.mime.MultipartEntityBuilder entity =
            org.apache.hc.client5.http.entity.mime.MultipartEntityBuilder.create()

        entity.setCharset(java.nio.charset.Charset.forName("UTF-8"))
        entity.addBinaryBody("file", file,
            org.apache.hc.core5.http.ContentType.DEFAULT_BINARY, exchange.properties.OTFileName)
        entity.addTextBody("body", exchange.properties.metadataPayload,
            org.apache.hc.core5.http.ContentType.APPLICATION_JSON)

        // Set multipart entity as the outgoing message's body
        return entity.build()
    </groovy>
</transform>
<log message="Body prepared for upload."/>
<setHeader name="OTCSTicket"><simple>${bean:simpleCache.getOrDefault('OTCSTicket','')}</simple></setHeader>
<setHeader name="Authorization"><simple>Bearer ${bean:simpleCache.getOrDefault('JWT','')}</simple></setHeader>
<toD uri="${properties:exxon.opentext.url}/api/v2/nodes?bridgeEndpoint=true&amp;httpMethod=POST"/>
<log message="response: ${body}"/>
```

---

## Mail File Attachment Processor

Processor that attaches a file to an outbound mail message.

```groovy
import org.apache.camel.Exchange
import org.apache.camel.Processor
import org.apache.camel.attachment.AttachmentMessage

import jakarta.activation.DataHandler
import jakarta.activation.FileDataSource
import org.slf4j.Logger
import org.slf4j.LoggerFactory

class MailAttachmentProcessor implements Processor {
    private static final Logger log = LoggerFactory.getLogger(MailAttachmentProcessor.class);
    void process(Exchange exchange) throws Exception {
        AttachmentMessage attMsg = exchange.getIn(AttachmentMessage.class)
        String exportDate = exchange.getProperty("exportDate", String.class)
        String customerId = exchange.getProperty("customerId", String.class)
        String attachmentName = exchange.getProperty("fileUid", String.class) + "-" +
            customerId + "-" + exchange.getProperty("exportDate", String.class) + ".pdf"
        String attachmentFilePath = exchange.getProperty("AttachmentFilePath", String.class) +
            "/" + attachmentName
        String attachmentDisplayName = "Notification Letter " + customerId + " " +
            exportDate + ".pdf"
        attMsg.addAttachment(attachmentDisplayName,
            new DataHandler(new FileDataSource(new File(attachmentFilePath))));
        log.info("Attached :" + attachmentName + " from path " + attachmentFilePath)
    }
}
```

**Usage:**

```xml
<pollEnrich timeout="500">
    <simple>file:{{integration.sftp.root}}/filearea/outbound?fileName=${header.fileNameHeader}</simple>
</pollEnrich>
<process ref="mailAttachmentProcessor"/>
<setBody><constant>Customer's Quotes attached.</constant></setBody>
<to uri="direct:export-emailApprovedQuoteSMTP"/>
```

---

## Are old SOAP webservices compatible with provisioned instance?

Yes — old SOAP services can still be set up on a provisioned instance during migration.

See: *How to Use Web Services on Provisioned IM Instances* — https://pricefx.atlassian.net/wiki/pages/createpage.action?spaceKey=IM&title=Web%20Services

---

## Migrate Aggregation Strategy implementation

When migrating older aggregation strategies you may hit:

```
java.lang.VerifyError: Bad type on operand stack
```

**Cause:** anonymous inner class in Groovy doesn't verify cleanly on newer IM/JVM combinations.

**Solution:** extract the anonymous inner class to a **named** static inner class.

**Original Java on IM 1.1.18:**

```java
File toDelete = new File(zipFile.getFile().getPath());
newExchange.addOnCompletion(new Synchronization() {
    @Override
    public void onComplete(Exchange exchange) {
        toDelete.delete();
    }

    @Override
    public void onFailure(Exchange exchange) {
    }
});
```

**New Groovy on IM 6.0.7:**

```groovy
newExchange.getExchangeExtension().addOnCompletion(new DeleteFileOnCompletion(new File(zipFile.getFile().getPath())));

private static class DeleteFileOnCompletion extends SynchronizationAdapter {
    private final File fileToDelete;

    DeleteFileOnCompletion(File fileToDelete) {
        this.fileToDelete = fileToDelete;
    }

    @Override
    public void onComplete(Exchange exchange) {
        fileToDelete.delete();
    }

    @Override
    public void onFailure(Exchange exchange) {
        // No-op
    }
}
```

---

## How to revert version update of a provisioned instance

When a version update breaks the instance and you need to roll back:

1. **Stop the instance.**
2. **Revert** the commit made by the Platform Manager service and change `IM_STATUS` in `.gitlab-ci.yml` to `INSTALL`.
3. **Check the pipelines** in GitLab to confirm.
4. **Start the instance.**
