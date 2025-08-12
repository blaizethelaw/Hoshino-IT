# Contributing to Hoshino IT

Thank you for your interest in contributing to Hoshino IT. This document provides guidance to help you craft high‑quality contributions and avoid common pitfalls such as accidentally adding unsupported files.

## Working with the Repository

- **Create feature branches.** Always start new work on a fresh branch based on the latest `main`. Keeping changes isolated makes reviews faster and reduces merge conflicts.
- **Write descriptive commit messages.** Summaries should explain what the change does and why it is necessary. Avoid vague phrases such as "update" or "fix".
- **Structure changes logically.** Small, well‑scoped commits are easier to review than large ones that combine unrelated modifications.

## Avoid Binary Files

Binary files (for example, images, PDFs, or compiled artifacts) are not supported in pull requests for this repository. Attempting to include them will result in errors during PR creation. To keep contributions compatible:

1. **Commit only text‑based content.** Source code, configuration, and documentation are ideal candidates.
2. **Use external storage for binaries.** If your contribution relies on assets such as images or videos, store them in an external service and reference them through URLs.
3. **Consider Git LFS for large files.** When binary assets must reside in the repo, configure [Git Large File Storage](https://git-lfs.com/) to manage them. LFS keeps the main repository lean by storing binaries separately.
4. **Never track build outputs.** Add temporary or generated files to `.gitignore` so they are not accidentally committed.

## Testing and Verification

Before submitting a pull request:

- Run `npm test` to execute the test suite. Even when the project has limited tests, running the script validates that the environment is configured correctly.
- Review your changes with `git status` and `git diff` to ensure no unintended files are included.

## Documentation Standards

- Update relevant documentation whenever behavior changes or new features are introduced.
- Write in clear, concise language and prefer Markdown formatting for readability.

## Communication

Open and respectful communication helps maintain a welcoming community. If you encounter problems or have questions about how to proceed, open an issue or start a discussion so others can assist.

By following these guidelines you help keep the project maintainable and friendly to both new and experienced contributors. Happy coding!
