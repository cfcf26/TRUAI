# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TruAI is a fact-checking and source verification system that analyzes deep research URLs, extracts content into paragraphs, and verifies the credibility of each paragraph against its cited sources using AI.

**Core Functionality:**
- Accepts research article URLs and parses them into structured paragraphs with source links
- Performs real-time verification of each paragraph against its cited sources
- Provides confidence ratings (high/medium/low) with detailed reasoning
- Displays results with an interactive UI that updates as verification completes

**Technical Stack:**
- Next.js 14 with TypeScript and App Router
- Tailwind CSS + shadcn/ui for UI components
- ScrapingBee for web scraping
- GPT-5 for content verification and confidence assessment

For detailed architecture and data flow, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Development Commands

```bash
# Start development server (runs on http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Architecture

### Framework Configuration

- **Next.js 14.2.33**: Uses App Router (not Pages Router)
- **TypeScript**: Strict mode enabled with modern ESNext compilation
- **Tailwind CSS**: Custom design system with CSS variables for theming
- **shadcn/ui**: Component library with customizable UI components

### Project Structure

```
src/
├── app/              # Next.js App Router directory
│   ├── layout.tsx    # Root layout with font configuration
│   ├── page.tsx      # Home page
│   ├── globals.css   # Global styles and Tailwind directives
│   └── fonts/        # Local font files (Geist Sans & Mono)
├── components/       # React components
│   └── ui/           # shadcn/ui components
└── lib/              # Utility functions
    └── utils.ts      # cn() helper for className merging
```

### Path Aliases

TypeScript is configured with the following path alias:
- `@/*` → `./src/*`

Example: `import { Button } from "@/components/ui/button"`

### Design System

The project uses a CSS variable-based theming system defined in `src/app/globals.css`. All colors reference HSL values through CSS custom properties:

- Semantic color tokens (primary, secondary, accent, destructive, etc.)
- Dark mode support via class-based theming (`darkMode: ["class"]`)
- Consistent border radius system using `--radius` variable

### shadcn/ui Configuration

Components are installed via `npx shadcn@latest add [component]` and stored in `src/components/ui/`.

Configuration (components.json):
- Style: default
- Base color: slate
- CSS variables: enabled
- RSC: enabled (React Server Components)

When adding new shadcn/ui components, they will automatically use the configured aliases and styling.

### Fonts

The app uses Geist font family (Sans and Mono) loaded as local fonts via `next/font/local`. Font variables are applied globally in the root layout:
- `--font-geist-sans`
- `--font-geist-mono`

## Key Dependencies

- **UI Components**: @radix-ui/react-slot, lucide-react
- **Styling**: class-variance-authority, clsx, tailwind-merge
- **Type Safety**: Full TypeScript coverage with strict mode

## Application Architecture

The system follows a three-layer architecture:

1. **UI Layer**: Displays parsed paragraphs and real-time confidence updates
   - Shows paragraph cards with color-coded confidence levels (green/yellow/red)
   - Provides tooltips with source details and verification reasoning
   - Updates incrementally as backend verification completes

2. **Backend Logic 1 (Ingest/Parse)**: `/api/ingest`
   - Receives research URL
   - Scrapes content via ScrapingBee
   - Separates main content from references/citations
   - Maps paragraphs to their source links
   - Returns structured data immediately to UI
   - Triggers background verification job

3. **Backend Logic 2 (Verification)**: Background worker
   - Crawls up to 5 source links per paragraph (parallel)
   - Feeds paragraph + source content to GPT-5
   - Generates confidence rating and reasoning
   - Streams results back to UI incrementally

### Key API Contracts

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed API schemas and data structures.

## Development Notes

- This is a Server Component-first architecture; use 'use client' directive only when necessary
- The `cn()` utility function in `@/lib/utils` should be used for conditional className merging
- All UI components follow the shadcn/ui pattern with variant-based styling using class-variance-authority
- For real-time updates, consider SSE/WebSocket or polling (initial implementation can use 3s polling)

## Working with Claude Code Agents

When working on this project with Claude Code, leverage specialized agents for better efficiency:

- **Exploration Tasks**: Use the `Explore` agent (Task tool with subagent_type=Explore) when:
  - Searching for how specific features are implemented across the codebase
  - Understanding the overall codebase structure
  - Finding patterns or conventions used in the project
  - Locating files related to a particular functionality

- **Planning Tasks**: Use the `Plan` agent for:
  - Breaking down complex feature implementations
  - Planning multi-step refactoring operations
  - Designing new API endpoints or components

- **Build & Validation**: Use the `build-lint-validator` agent to:
  - Run build checks after significant code changes
  - Validate TypeScript and linting rules
  - Ensure code quality before commits

- **Git Operations**: Use the `git-commit-pusher` agent when:
  - Committing completed features with proper commit messages
  - Preparing code for pull requests

Always prefer using these specialized agents over running individual search or build commands directly, as they provide more comprehensive and efficient results.
