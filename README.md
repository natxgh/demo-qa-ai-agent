# HRMS Login Automation

Playwright E2E automation for HRMS Login — generated from the QA AI pilot test design.

## 🧪 Test Execution

### Running Tests

```bash
# Run all tests (headless)
npm test

# Run tests with browser visible
npm run test:headed

# Run tests in UI mode (interactive)
npm run test:ui

# List available tests without running them
npm run list
```

### Viewing Test Results

```bash
# Open the HTML test report
npm run report
```

## 📊 Test Workflow Scripts

### Full E2E Flow: Capture → Generate → Upload

**Recommended workflow** - runs tests, generates bug cards and evidence pack, then uploads to Lark:

```bash
# Capture everything and sync to Lark (requires confirmation)
npm run s2p:confirm

# Capture everything and auto-sync to Lark
npm run s2p
```

### Individual Steps

**Execute tests and generate bug cards:**
```bash
npm run execute
```

**Capture full evidence (tests → bug cards → evidence pack):**
```bash
npm run capture
```

**Generate bug cards from latest test results:**
```bash
npm run cards
```

**Generate evidence pack:**
```bash
npm run evidence
```

**Upload results to Lark:**
```bash
npm run file:lark
```

## 🔗 Lark Integration

### Authentication

```bash
# Set up Lark OAuth (interactive)
npm run lark:oauth
```

### PO Feedback Workflow

```bash
# Create PO feedback questions in Lark and wait for responses
npm run ask:po

# Poll for PO responses
npm run poll:po
```

### Test Case Management

```bash
# Upload test cases to Lark (with confirmation)
npm run upload:tc:confirm

# Auto-upload test cases to Lark
npm run upload:tc
```

## 📁 Scripts Reference

All scripts are located in the `scripts/` directory. Key scripts include:

| Script | Purpose |
|--------|---------|
| `gen-bug-cards.mjs` | Generate bug cards from test failures |
| `gen-evidence-pack.mjs` | Package evidence (screenshots, logs, etc.) |
| `upload-testcases.mjs` | Upload test cases to Lark base |
| `ask-po.mjs` | Create PO feedback questions in Lark |
| `poll-po.mjs` | Poll Lark for PO responses |
| `lark-oauth.mjs` | Configure Lark authentication |
| `gen-testcases.mjs` | Generate test cases |
| `sync-tc-lark.mjs` | Sync test case metadata to Lark |

## ⚙️ Configuration

Ensure `.env` file is configured with necessary credentials (see `.env.example` for template).
