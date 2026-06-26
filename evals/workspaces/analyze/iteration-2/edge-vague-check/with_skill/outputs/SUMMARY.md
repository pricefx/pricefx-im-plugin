Happy to run a quality check on your route. I just need to know **which route** you mean — your message didn't name a specific file.

Route files live under:

```
src/main/resources/repo/routes/
```

Each route is a single `.xml` file (e.g. `import-products.xml`, `export-customers.xml`).

**Which route file should I analyze?** Reply with the file name (or path) and I'll lint it against the Pricefx IM best-practice checks — naming/structure, XML escaping, file-consumer config, Pricefx API usage, and known anti-patterns — then report OK / WARN / FAIL per check with specific fixes.

If you're not sure of the name, let me know and I can list what's in the `routes/` folder for you to pick from.
