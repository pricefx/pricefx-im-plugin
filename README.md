# pricefx-integration

Claude plugin for Pricefx platform integration. Provides tools, context, and workflows for working with Pricefx APIs, configuration, and pricing logic within Claude Code.

## Overview

This plugin enhances Claude Code with Pricefx-specific capabilities:

- **API Integration** - Tools for interacting with Pricefx REST APIs (pricing, quoting, data management)
- **Configuration Assistance** - Help with Pricefx partition configuration, price parameters, and logic setup
- **Groovy Logic Support** - Context-aware assistance for writing Pricefx pricing logic in Groovy
- **Data Model Awareness** - Understanding of Pricefx data structures (products, customers, price lists, etc.)

## Installation

1. Clone this repository:
   ```bash
   git clone https://gitlab.pricefx.eu/tools/pricefx-integration.git
   ```

2. Place the plugin in your Claude Code plugins directory or reference it in your project's `.claude/` configuration.

## Plugin Structure

```
pricefx-integration/
├── .claude-plugin       # Plugin manifest
├── README.md            # This file
└── ...                  # Plugin source files
```

## Configuration

The plugin is defined in `.claude-plugin`:

```json
{
  "name": "pricefx-integration",
  "description": "Claude plugin for Pricefx platform integration",
  "version": "1.0.0",
  "author": {
    "name": "Pricefx Tools Team"
  }
}
```

## Development

### Branches

- `main` - Stable releases
- `develop` - Active development

### Contributing

1. Create a feature branch from `develop`
2. Make your changes
3. Submit a merge request to `develop`

## Repository

- **GitLab**: https://gitlab.pricefx.eu/tools/pricefx-integration

## License

Internal - Pricefx
