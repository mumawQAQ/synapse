# Contributing to Synapse

First off, thank you for considering contributing to Synapse! People like you make Synapse an amazing open-source framework.

## Code of Conduct

By participating in this project, you agree to abide by the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Getting Started

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/synapse.git
   cd synapse
   ```
3. **Install dependencies** using pnpm:
   ```bash
   pnpm install
   ```

## Development Workflow

Synapse is structured as a monorepo powered by Turborepo.

To start developing locally:

1. Create a deeply descriptive feature branch:
   ```bash
   git checkout -b feature/my-amazing-feature
   ```
2. Start the development server (runs the TypeScript compiler and auto-restarts):
   ```bash
   pnpm dev
   ```
3. Run the playground and react application to test changes:
   Make sure you run the `apps/playground-server` and `apps/playground-web` to verify your code behaves correctly.

## Publishing Changes

We use [Changesets](https://github.com/changesets/changesets) for versioning and publishing packages.

If your PR introduces a user-facing change or fixes a bug in `@mumaw/synapse-client`, `@mumaw/synapse-protocol`, or `@mumaw/synapse-server`:

1. Run the changeset CLI:
   ```bash
   pnpm changeset
   ```
2. Follow the prompts to select the packages you modified and input a summary of your changes.
3. Commit the generated markdown file in the `.changeset` directory along with your pull request.

## Pull Request Guidelines

- Ensure your code follows the existing style (we use Prettier and ESLint, which you can run via `pnpm lint`).
- Include the `changeset` file if you are submitting a bug fix or new feature for the core packages.
- Provide a clear, detailed description explaining exactly what your PR changes and why. Include screenshots or videos if the UI was affected.
- Keep PRs small and focused. If you are doing a massive refactor, open an issue first to discuss it with the maintainers.

## Questions?

If you're unsure about how to implement a feature or run the project, please open a GitHub Discussion or simply submit a Draft PR so we can talk through the approach together!
