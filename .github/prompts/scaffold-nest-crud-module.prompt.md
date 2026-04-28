---
mode: ask
description: "Scaffold a new NestJS CRUD module using this repo's User-module pattern (controller, service, repository, DTOs, schema wiring, AppModule import, Swagger metadata)."
---

Create a complete NestJS CRUD module in the backend using the repository conventions from the existing `user` module.

## Inputs

Ask for these values before coding if they are not already provided:

1. `entityNameSingular` (example: `product`)
2. `entityNamePlural` (example: `products`)
3. `uniqueField` (example: `name` or `email`)
4. `fields` with type and validation rules
5. whether the module needs authentication guards (default: no)

## Required Output

Generate and wire these files under `backend/src/modules/<entityNameSingular>/`:

- `<entityNameSingular>.module.ts`
- `<entityNameSingular>.controller.ts`
- `<entityNameSingular>.service.ts`
- `<entityNameSingular>.repository.ts`
- `<entityNameSingular>.interface.ts`
- `dto/create-<entityNameSingular>.dto.ts`
- `dto/update-<entityNameSingular>.dto.ts`
- `dto/list-<entityNamePlural>.query.dto.ts`

Also:

- create schema in `backend/src/common/schemas/`
- export schema in `backend/src/common/schemas/index.ts`
- import module in `backend/src/app.module.ts`

## Implementation Rules

1. Match controller response shape used in `user.controller.ts`:
   - `{ success: boolean, message: string, data?: T }`
2. Use CRUD endpoints:
   - `POST /<entityNamePlural>`
   - `GET /<entityNamePlural>`
   - `GET /<entityNamePlural>/:id`
   - `PATCH /<entityNamePlural>/:id`
   - `DELETE /<entityNamePlural>/:id`
3. Keep controller thin; place business logic in service.
4. Put database access logic in repository only.
5. Validate ObjectId in service.
6. Use explicit Nest exceptions (`BadRequestException`, `NotFoundException`, `ConflictException`).
7. Use `class-validator` and `class-transformer` in DTOs.
8. Add Swagger decorators for body/query fields (`@ApiProperty`, `@ApiPropertyOptional`).
9. Do not expose sensitive fields in responses.
10. Do not add auth guards unless explicitly requested.

## Validation Steps

After generating files:

1. Run `cd backend && npm run build`.
2. Fix compile errors if any.
3. Confirm new routes appear in Swagger (`/api/docs`).
4. Summarize created files and endpoints.

## Final Response Format

Return:

1. List of files created/updated.
2. List of endpoints added.
3. Any assumptions made for fields/validations.
4. Build verification result.
