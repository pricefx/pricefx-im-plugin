import { request } from "node:https";
import { request as httpRequest } from "node:http";

export class PricefxClient {
  constructor({ url, partition, username, password }) {
    this.baseUrl = `${url.replace(/\/+$/, "")}/pricefx/${partition}`;
    this.partition = partition;
    this.auth = Buffer.from(
      `${partition}/${username}:${password}`
    ).toString("base64");
  }

  async post(path, body = {}) {
    const base = new URL(this.baseUrl);
    const [pathname, query] = path.split("?");
    const url = new URL(base.origin);
    url.pathname = `${base.pathname}${pathname}`;
    if (query) url.search = `?${query}`;

    const payload = JSON.stringify(body);

    return new Promise((resolve, reject) => {
      const reqFn = url.protocol === "https:" ? request : httpRequest;
      const req = reqFn(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${this.auth}`,
            Accept: "application/json",
          },
        },
        (res) => {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            const raw = Buffer.concat(chunks).toString();
            if (res.statusCode >= 400) {
              reject(
                new Error(
                  `HTTP ${res.statusCode}: ${raw.slice(0, 200)}`
                )
              );
              return;
            }
            try {
              resolve(JSON.parse(raw));
            } catch {
              reject(new Error(`Invalid JSON response: ${raw.slice(0, 200)}`));
            }
          });
        }
      );

      req.on("error", reject);
      req.write(payload);
      req.end();
    });
  }

  async listProductExtensions() {
    return this.getExtensionConfig("product");
  }

  async listCustomerExtensions() {
    return this.getExtensionConfig("customer");
  }

  async fetchProductAttributeMeta(locale = "en") {
    const r = await this.post(`/fetch/PAM?dataLocale=${locale}`, { data: {} });
    return r?.response?.data || [];
  }

  async fetchProductExtensionAttributeMeta(extensionName, locale = "en") {
    const r = await this.post(`/productmanager.fetchpxam?dataLocale=${locale}`, {
      data: { name: extensionName },
    });
    return r?.response?.data || [];
  }

  async fetchMetadata(objectType, id) {
    let path = `/metadata.fetch/${objectType}`;
    if (id) {
      path += `?${getIdParam(objectType)}=${encodeURIComponent(id)}`;
    }
    return this.post(path, {});
  }

  async getExtensionConfigRaw(type) {
    const r = await this.post(`/configurationmanager.get/${type}extension`, {});
    const raw = r?.response?.data?.[0];
    if (!raw) return { config: {}, version: 0 };
    const config = typeof raw === "string" ? JSON.parse(raw) : raw;
    const version = r?.response?.data?.[1] ?? 0;
    return { config, version };
  }

  async getExtensionConfig(type) {
    const { config } = await this.getExtensionConfigRaw(type);
    return config;
  }

  async saveExtensionConfig(type, config) {
    return this.post(`/configurationmanager.set/${type}extension`, {
      data: {
        content: JSON.stringify(config),
      },
    });
  }

  async createExtension(type, name, { label, numberOfAttributes = 10, allowSearch = false }) {
    const ALLOWED_ATTR_COUNTS = [3, 6, 8, 10, 20, 30, 50];
    const NAME_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

    if (!NAME_REGEX.test(name)) {
      throw new Error(`Invalid name "${name}". Allowed characters: A-Z, a-z, 0-9, _. Must not start with a number.`);
    }
    if (!ALLOWED_ATTR_COUNTS.includes(numberOfAttributes)) {
      throw new Error(`Invalid attribute count ${numberOfAttributes}. Allowed values: ${ALLOWED_ATTR_COUNTS.join(", ")}.`);
    }

    const existing = await this.getExtensionConfig(type);
    if (existing[name]) {
      throw new Error(`Extension "${name}" already exists.`);
    }
    existing[name] = {
      label: label || name,
      numberOfAttributes,
      allowSearch,
      allowPASearch: false,
    };
    return this.saveExtensionConfig(type, existing);
  }

  async addAttributeMeta(typeCode, data) {
    return this.post(`/add/${typeCode}`, {
      data,
      operationType: "add",
    });
  }

  async updateAttributeMeta(typeCode, data, oldValues) {
    return this.post(`/update/${typeCode}`, {
      data,
      oldValues,
      operationType: "update",
    });
  }

  async fetchExtensionAttributeMeta(type, extensionName, locale = "en") {
    const cmd = type === "product" ? "productmanager.fetchpxam" : "customermanager.fetchcxam";
    const r = await this.post(`/${cmd}?dataLocale=${locale}`, {
      data: { name: extensionName },
    });
    return r?.response?.data || [];
  }

  async setAttribute(type, extensionName, fieldName, { label, fieldType, formatType }) {
    const typeCode = type === "product" ? "PXAM" : "CXAM";
    const existing = await this.fetchExtensionAttributeMeta(type, extensionName);
    const current = existing.find((a) => a.fieldName === fieldName);

    const data = {
      fieldName,
      name: extensionName,
      label: label || fieldName,
      fieldType: fieldType ?? 2,
      formatType: formatType || null,
      requiredField: false,
      readOnly: false,
    };

    if (current) {
      data.typedId = current.typedId;
      data.version = current.version;
      return this.updateAttributeMeta(typeCode, data, current);
    } else {
      return this.addAttributeMeta(typeCode, data);
    }
  }

  async setAttributes(type, extensionName, attributes) {
    const typeCode = type === "product" ? "PXAM" : "CXAM";
    const existing = await this.fetchExtensionAttributeMeta(type, extensionName);
    const existingByField = new Map(existing.map((a) => [a.fieldName, a]));

    const results = [];
    for (const attr of attributes) {
      const current = existingByField.get(attr.fieldName);
      const data = {
        fieldName: attr.fieldName,
        name: extensionName,
        label: attr.label || attr.fieldName,
        fieldType: attr.fieldType ?? 2,
        formatType: attr.formatType || null,
        requiredField: false,
        readOnly: false,
      };

      if (current) {
        data.typedId = current.typedId;
        data.version = current.version;
        const r = await this.updateAttributeMeta(typeCode, data, current);
        results.push({ fieldName: attr.fieldName, action: "updated", result: r });
      } else {
        const r = await this.addAttributeMeta(typeCode, data);
        results.push({ fieldName: attr.fieldName, action: "added", result: r });
      }
    }
    return results;
  }

  async listDataSources(locale = "en") {
    const r = await this.post(`/datamart.getfcs/DMDS?dataLocale=${locale}`, {});
    return r?.response?.data || [];
  }

  async fetchDataSourceAttributeMeta(name, locale = "en") {
    const r = await this.post(`/productmanager.fetchdsam?dataLocale=${locale}`, {
      data: { uniqueName: name },
    });
    return r?.response?.data || [];
  }

  async listPricingParameters(locale = "en") {
    const r = await this.post(`/fetch/MLTVM?dataLocale=${locale}`, {
      data: {
        startRow: 0,
        endRow: 200,
        _constructor: "AdvancedCriteria",
        criteria: [],
      },
    });
    return r?.response?.data || [];
  }

  async fetchPricingParameterData(typedId, locale = "en") {
    const r = await this.post(
      `/lookuptablemanager.fetch/${typedId}?onConflict=validationError&isc_dataFormat=json&dataLocale=${locale}`,
      {
        data: {
          startRow: 0,
          endRow: 200,
          _constructor: "AdvancedCriteria",
          criteria: [],
        },
      }
    );
    return r?.response?.data || [];
  }

  async testConnection() {
    const r = await this.post("/configurationmanager.get/productextension", {});
    return r?.response?.statusCode === 0 || r?.response?.data !== undefined;
  }

  async fetchSample(objectType, { name, limit = 5 } = {}) {
    const criteria = [];

    if (name && (objectType === "PX" || objectType === "CX")) {
      criteria.push({ fieldName: "name", operator: "equals", value: name });
    }

    if (name && objectType === "DMDS") {
      criteria.push({ fieldName: "uniqueName", operator: "equals", value: name });
    }

    const body = {
      data: {
        startRow: 0,
        endRow: limit,
        _constructor: "AdvancedCriteria",
        criteria,
      },
    };

    const r = await this.post(`/fetch/${objectType}`, body);
    return r?.response?.data || [];
  }
}

function getIdParam(objectType) {
  const idParams = {
    PX: "name",
    CX: "name",
  };
  // Condition record types like CRCI10 use conditionRecordSetId
  if (objectType.startsWith("CR")) {
    return "conditionRecordSetId";
  }
  return idParams[objectType] || "name";
}
