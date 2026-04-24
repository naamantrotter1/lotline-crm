# Contacts Module — Phase 1

## Overview
First-class contact management scoped per organization with full RLS, lifecycle stages, multi-type tagging, and deal linking.

## Schema

### `contacts`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| organization_id | uuid FK | organizations.id |
| first_name / last_name | text | |
| email / phone / secondary_phone | text | |
| company / title | text | |
| address | jsonb | {street, city, state, zip, country} |
| lead_source | text | Referral, Website, etc. |
| owner_user_id | uuid FK | auth.users |
| tags | text[] | |
| custom_fields | jsonb | Phase 7 extension point |
| lifecycle_stage | text | new\|working\|qualified\|customer\|dormant |
| do_not_contact | boolean | |
| notes | text | |
| last_contacted_at | timestamptz | |
| created_at / updated_at | timestamptz | |
| deleted_at | timestamptz | soft delete |
| import_batch_id | uuid | Phase 5 import wizard |

### `contact_types`
Many-to-one per contact. Values: lead\|seller\|buyer\|investor\|attorney\|contractor\|agent\|vendor\|other.

### `contact_relationships`
Bidirectional relationships between contacts (spouse, referrer, attorney_for, etc.).

### `contact_deals`
Links contacts to deals with a role (seller, buyer, investor, attorney, contractor, primary, other).

## Permissions
| Capability | Owner | Admin | Operator | Viewer |
|-----------|-------|-------|----------|--------|
| contact.view | ✓ | ✓ | ✓ | ✓ |
| contact.create | ✓ | ✓ | ✓ | |
| contact.update | ✓ | ✓ | ✓ | |
| contact.delete | ✓ | ✓ | | |
| contact.bulk_edit | ✓ | ✓ | ✓ | |
| contact.export | ✓ | ✓ | | |
| contact.merge | ✓ | ✓ | | |

## RLS
- SELECT: active org members see non-deleted contacts in their org.
- INSERT/UPDATE: owner, admin, operator roles only.
- Hard DELETE: blocked at RLS level (service role only). Use soft delete (updated_at deleted_at).

## API (client-side, Supabase RLS)
All CRUD is performed via `src/lib/contactsData.js` directly against Supabase.
No Vercel serverless routes needed for basic CRUD.

## UI Routes
- `/contacts` — table + kanban views, search, filter by type/stage
- `/contacts/:id` — three-column detail (profile | timeline | related)

## Keyboard Shortcuts
- `C` from any page (not in input) → quick-create contact modal

## Extension Guide
- **Custom fields**: stored in `contacts.custom_fields` jsonb. Phase 7 renders them dynamically.
- **Import**: Phase 5 sets `import_batch_id` for rollback support.
- **Email compose**: Phase 3 adds "Send Email" from contact detail timeline.
- **Tasks**: Phase 2 adds Tasks tab to contact detail.
