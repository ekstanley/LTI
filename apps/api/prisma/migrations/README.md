# LTIP Database Migrations

This directory contains Prisma migrations for the LTIP database schema.

## Migration Strategy

1. **Schema changes**: Use `pnpm db:migrate` to generate and apply migrations
2. **Custom SQL**: Add triggers, indexes, and functions in post-migration scripts
3. **Seed data**: Use `pnpm db:seed` to populate initial data

## Custom SQL Triggers

After the initial migration, the following triggers are created:

### Full-Text Search Triggers
- `bills_search_update`: Maintains `search_vector` on bills table
- `legislators_search_update`: Maintains `search_vector` on legislators table

### Denormalization Triggers
- `bill_sponsor_count_trigger`: Updates sponsor counts on bill_sponsors changes
- `bill_vote_count_trigger`: Updates vote counts on votes changes
- `bill_amendment_count_trigger`: Updates amendment counts

## Running Migrations

```bash
# Development
pnpm db:migrate

# Production (apply only)
pnpm prisma migrate deploy

# Reset database (development only)
pnpm db:reset
```
