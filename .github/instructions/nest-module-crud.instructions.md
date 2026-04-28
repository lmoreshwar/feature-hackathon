---
applyTo: "backend/src/modules/**,backend/src/common/schemas/**,backend/src/app.module.ts"
description: "Enforce repository CRUD conventions from the existing User module when creating or updating any backend module."
---

Follow the CRUD architecture used by the `user` module.

Rules:

- Create module files with controller, service, repository, interfaces, and DTOs.
- Keep controller thin; business logic in service; persistence in repository.
- Expose CRUD endpoints with standard response shape:
  - `{ success: boolean, message: string, data?: T }`
- Add DTO validation using `class-validator` and query transformation with `class-transformer`.
- Add Swagger decorators to DTOs (`@ApiProperty`, `@ApiPropertyOptional`) with examples.
- Validate Mongo ObjectId in service and throw explicit Nest exceptions.
- Keep repository focused on data access and pagination/search implementation.
- Never expose sensitive fields in API responses.
- Register new schema in `common/schemas`, wire with `MongooseModule.forFeature`, and import module in `AppModule`.
- Do not add auth guards to CRUD routes unless explicitly requested.
- After changes, run `cd backend && npm run build` and fix introduced compile errors.
