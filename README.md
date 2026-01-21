<div align="center">

<img src="assets/logo.png" width="280" alt="GitCanopy Interface" />

# GitCanopy: The Intelligent Git Client for Professional Engineers

**Stop managing Git. Start engineering.** 
GitCanopy combines high-performance visualization with a cognitive AI engine to automate commit hygiene, resolve complex conflicts, and audit code quality in real-time.

[![Version](https://img.shields.io/badge/version-1.2.0_Stable-1f2937?style=flat&logo=git)](https://github.com/TainYanTun/GitCanopy/releases)
[![AI Engine](https://img.shields.io/badge/AI-Gemini%20%7C%20OpenAI%20%7C%20Claude-7c3aed?style=flat)](documentation.md)
[![Build](https://img.shields.io/badge/build-passing-success?style=flat)](https://github.com/TainYanTun/GitCanopy/actions)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat)](LICENSE)

[Features](#-features) • [Download](#-download) • [Usage](#-usage) • [System Architecture](#-system-architecture)

<img src="src/renderer/public/interface.png" width="850" alt="GitCanopy Interface" />

</div>

---

## 🧠 Why GitCanopy is Smart

GitCanopy isn't just a wrapper around `git`. It is an **active development partner** that understands your code.

### 🛡️ Proactive Quality Control
Most clients let you push bad code. GitCanopy's **AI Code Reviewer** analyzes your staged diffs against security best practices and performance standards, giving you a **Quality Score (0-100)** before you ever hit commit.

### ⚡ Intent-Based Conflict Resolution
Merge conflicts are logic problems, not text problems. GitCanopy's **Prompted Resolver** lets you use natural language (e.g., *"Keep the logging from branch A but the variable naming from branch B"*) to synthesize a syntactically correct merge.

### 📝 Semantic Context Extraction
Stop writing "fix bug" commits. The **Context Engine** reads your diffs, understands the architectural change, and generates semantic, Conventional Commits compliant messages automatically.

---

## ✨ Features

- **🤖 AI & Automation:**
    - **Smart Commit Generator:** Generate semantic messages from diffs using Gemini, OpenAI, or Claude.
    - **Intelligent Conflict Resolver:** Resolve complex merge conflicts with natural language instructions.
    - **AI Code Reviewer:** Get a pre-commit quality score (0-100) and catch security bugs before you push.
- **Visualization Engine:** Lane-persistent commit graphs with semantic coloring and lineage tracing.
- **Actions Explorer:** Real-time GitHub Actions monitoring with instant sync and branch filtering.
- **Professional Performance:** 60FPS virtualized rendering and background worker-powered layouts.
- **Seamless Workflow:** Atomic staging, high-fidelity diffs, and integrated remote synchronization.
- **Deep Insights:** Contributor metrics, file hotspots, and a visual stash gallery with file previews.

---

## 📦 Download

GitCanopy is an open-source project hosted on GitHub. You can find the latest installers for macOS, Windows, and Linux on our **Releases** page:

👉 **[Download GitCanopy from GitHub](https://github.com/TainYanTun/GitCanopy/releases)**

> **Note for macOS users:** Since the app is currently unsigned, you will need to **Right-Click > Open** the first time you launch it to bypass the security verification.
>
> If you see a message saying **"GitCanopy is damaged and can't be opened"**:
> 1. Open your Terminal.
> 2. Run the following command:
    ```bash
    sudo xattr -cr /Applications/GitCanopy.app
    ```

### 🛠️ Development Setup
For developers looking to build from source or contribute, please refer to the [Setup Guide](setup.md).

---

## 🏗️ System Architecture

GitCanopy leverages a modern, type-safe stack designed for security, performance, and AI-enhanced productivity.

```mermaid
graph TD
    subgraph "Electron Application"
        Renderer["🖼️ React Renderer<br/>(UI Layer)"]
        Main["⚙️ Main Process<br/>(Node.js Environment)"]
        Preload["🌉 Preload Script<br/>(Secure IPC Bridge)"]
        
        Renderer <--> Preload <--> Main
    end

    subgraph "Core Services (Main)"
        GitService["📂 Git Service"]
        AiService["🧠 AI Service"]
        Settings["🔧 Settings"]
        Watcher["👀 Repo Watcher"]
        
        Main --> GitService
        Main --> AiService
        Main --> Settings
        Main --> Watcher
    end

    subgraph "External Integrations"
        GitCLI["Build-in Git Binary"]
        GeminiAPI["✨ Google Gemini API<br/>(v1beta/v1)"]
        OpenAI_API["OpenAI API"]
        Claude_API["Anthropic Claude API"]
        GitHubAPI["GitHub API"]
        
        GitService <--> GitCLI
        AiService <--> GeminiAPI
        AiService <--> OpenAI_API
        AiService <--> Claude_API
        Main <--> GitHubAPI
    end

    style Renderer fill:#0891b2,stroke:#06b6d4,stroke-width:2px,color:#fff
    style Main fill:#1f2937,stroke:#3b82f6,stroke-width:2px,color:#fff
    style AiService fill:#7c3aed,stroke:#a78bfa,stroke-width:2px,color:#fff
    style GeminiAPI fill:#ea4335,stroke:#fca5a5,stroke-width:2px,color:#fff
```

### 🧠 AI Integration Flow

1.  **Renderer** sends a request (e.g., "Generate Commit Message") via IPC.
2.  **Main Process** captures the current context (staged diffs, conflict markers).
3.  **AI Service** constructs a prompt and selects the provider (Gemini 2.5/2.0, OpenAI, or Claude) based on user settings.
4.  **External API** processes the request and returns semantic text or code.
5.  **Response** flows back to the UI for user review.

---

## 🗺️ Roadmap

- [ ] **Visual Interactive Rebase:** Drag-and-drop history management and rewriting.
- [ ] **Conflict Resolution UI:** Advanced tools for solving complex merges.
- [ ] **Ecosystem Integration:** First-class support for GitHub, GitLab, and Bitbucket.
- [ ] **Extensibility:** Custom themes and commit classification plugin system.

---

## 🤝 Contributing

Everyone is welcome for contributions from the community! Whether it's bug reports, feature requests, or code contributions, every bit helps make GitCanopy better. Refer to our [Development Guide](setup.md) to get started.

---

## 💖 Support the Project

GitCanopy is a solo developer project built with passion. If you find it useful, please consider supporting its growth:

- ⭐ **Star this repository** to help others discover the project.
- 🚀 **Share GitCanopy** with your team or on social media.
- 🤝 **[Sponsor the Developer](https://github.com/sponsors/TainYanTun)** on GitHub.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

```
MIT License - feel free to use GitCanopy in your projects,
modify it, and distribute it as you see fit.
```

---

<div align="center">

{ [Report Bug](https://github.com/TainYanTun/GitCanopy/issues/new?template=bug_report.md) • [Request Feature](https://github.com/TainYanTun/GitCanopy/issues/new?template=feature_request.md) • [Documentation](documentation.md) }

</div>