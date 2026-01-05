# Security Policy

## Supported Versions

Currently, only the latest stable release of GitCanopy is supported for security updates.

| Version | Supported          |
| ------- | ------------------ |
| v1.0.x  | :white_check_mark: |
| < v1.0  | :x:                |

## Reporting a Vulnerability

We take the security of GitCanopy seriously. If you discover a security vulnerability, please do **not** open a public issue. Instead, follow these steps:

1.  **Private Reporting:** Use GitHub's [Private Vulnerability Reporting](https://github.com/TainYanTun/GitCanopy/security/advisories/new) feature if available.
2.  **Direct Contact:** If private reporting is unavailable, please contact the maintainer directly via GitHub or at [leotainyan18@gail.com](mailto:leotainyan18@gail.com) (placeholder - please update with your preferred contact).

### What to include:
*   A description of the vulnerability.
*   Steps to reproduce the issue.
*   Potential impact of the vulnerability.
*   Any suggested fixes or mitigations.

## Our Process

*   We will acknowledge receipt of your report within **48 hours**.
*   We will provide an estimated timeline for a fix.
*   Once fixed, we will publish a security advisory and credit you for the discovery (unless you prefer to remain anonymous).

## Principles

*   **Local Data:** GitCanopy is designed to work locally. It should never transmit your code or Git credentials to external servers, except when performing standard Git operations (Push/Pull) to your configured remotes.
*   **Minimal Permissions:** The application only requests the permissions necessary to manage your local Git repositories.
