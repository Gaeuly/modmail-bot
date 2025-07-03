# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Development:**
```bash
bun start                 # Start the bot
bun test                  # Run test suite
```

**Database:**
```bash
bun run db:generate       # Generate migrations from schema changes
bun run db:migrate        # Apply pending migrations
```

## Architecture Overview

This is a Discord modmail bot using Discord.js v14 with forum channels for thread organization. Users DM the bot, which creates/updates forum threads for staff to respond through.

**Tech Stack:**
- **Runtime**: Bun (development and production)
- **Database**: SQLite with Drizzle ORM
- **Discord**: Discord.js v14 with Components v2 support
- **Testing**: Bun's built-in test runner

## Key Architecture Patterns

**Command System**: Text-based commands (no slash commands) using inheritance-based handlers in `src/commands/`. All commands extend `TextCommandHandler` and route through `CommandRouter` with permission checking.

**Modmail Flow**:
1. User DM → `DMController` → `ThreadService` creates/updates forum thread
2. Staff reply in forum → `MessageRelayService` sends to user DM
3. Forum tags (Open/Closed) manage thread lifecycle

**Event-Driven**: Main event handlers in `src/events.ts` delegate to controllers (`DMController`, `SnippetController`, etc.) for separation of concerns.

**Database Schema**: Core entities are `threads` (forum↔user mapping), `messages` (bidirectional relay tracking), `messageEdits` (version history), `snippets` (reusable responses), and `runtimeConfig` (per-guild settings).

## Core Services

**ThreadService**: Forum thread management, automatic tag creation, thread lifecycle
**MessageRelayService**: Bidirectional message relay with attachment handling, edit/delete sync
**SnippetService**: Reusable message templates with anonymous sending support

## Configuration

Required environment variables: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DATABASE_URI`, `MAIL_GUILD_ID`

Runtime configuration stored in database via `runtimeConfig` table - forum channels, notification settings, custom prefixes managed through Discord modals.

## Testing

Uses Bun test with heavy mocking of Discord.js. Test files mirror source structure in `src/tests/`. Mock utilities in `src/tests/utils/`.

## Views & UI

**StaffThreadView**: Rich message display with Components v2, user metadata, attachment galleries
**UserThreadView**: Clean user-facing formatting, anonymous message support

Forum integration uses Discord's native threading with automatic tag management and message relay between platforms.