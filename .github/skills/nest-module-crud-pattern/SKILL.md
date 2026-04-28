---
name: nest-module-crud-pattern
description: "Use when creating a new NestJS module with CRUD endpoints in this repository. Triggers on requests like: create module, scaffold CRUD, add <entity> module, add DTO/service/repository/controller for Nest + Mongoose."
---

# Nest Module CRUD Pattern

## Goal

Create new backend modules that follow the exact architecture and conventions used by the existing `user` module in this repository.

## Apply This Pattern

Use this skill whenever a new domain module is requested, for example:

- "create product module"
- "add CRUD for orders"
- "scaffold category API"

## Required File Structure

For an entity `<entity>` under `backend/src/modules/<entity>/`, create:

- `<entity>.module.ts`
- `<entity>.controller.ts`
- `<entity>.service.ts`
- `<entity>.repository.ts`
- `<entity>.interface.ts`
- `dto/create-<entity>.dto.ts`
- `dto/update-<entity>.dto.ts`
- `dto/list-<entity>s.query.dto.ts`

If schema is needed:

- add schema under `backend/src/common/schemas/`
- export schema from `backend/src/common/schemas/index.ts`
- wire schema in `<entity>.module.ts` with `MongooseModule.forFeature`

## Controller Conventions

- Use REST endpoints:
  - `POST /<entities>` create
  - `GET /<entities>` list (with pagination/search query DTO)
  - `GET /<entities>/:id` get by id
  - `PATCH /<entities>/:id` update
  - `DELETE /<entities>/:id` delete
- Return response shape:
  - `{ success: boolean, message: string, data?: T }`
- Use `@HttpCode(HttpStatus.CREATED)` for create endpoint.
- Keep controller thin; business logic belongs in service.

## DTO Conventions

- Use `class-validator` decorators for validation.
- Use `class-transformer` for numeric query parsing when needed.
- Add Swagger decorators:
  - `@ApiProperty` for required body fields.
  - `@ApiPropertyOptional` for optional fields/query params.
- Include meaningful examples and descriptions.

## Service Conventions

- Perform business validation in service layer.
- Validate Mongo ObjectId with `Types.ObjectId.isValid`.
- Throw explicit Nest exceptions:
  - `BadRequestException`
  - `NotFoundException`
  - `ConflictException`
- Normalize searchable fields (e.g., lowercase + trim for emails/unique text fields).
- Return safe DTO/interface objects, never sensitive fields.

## Repository Conventions

- Keep pure data-access logic in repository.
- Use Mongoose model injection via `@InjectModel`.
- Implement methods:
  - `create`
  - `findById`
  - `findAll` (pagination + optional search)
  - `update`
  - `delete`
  - `existsBy<UniqueField>` where applicable
- Use `updatedAt: Date.now()` on updates.

## Module Conventions

- Register schema with `MongooseModule.forFeature`.
- Provide and export service + repository.
- Import module in `backend/src/app.module.ts`.

## Naming Rules

- Class names: PascalCase (`ProductService`).
- Files: kebab-case (`product.service.ts`).
- DTOs: `CreateXDto`, `UpdateXDto`, `ListXsQueryDto`.
- Service method names:
  - `createX`
  - `listXs`
  - `getXById`
  - `updateX`
  - `deleteX`

## Definition of Done

Before finishing, always:

1. Ensure module is imported in `AppModule`.
2. Ensure schema exports are updated when schema is added.
3. Run backend build:
   - `cd backend && npm run build`
4. Fix any compile errors introduced by changes.
5. Verify endpoints appear in Swagger (`/api/docs`) with proper body/query metadata.

## Non-Negotiable Rules

- Do not add auth guards to CRUD endpoints unless explicitly requested.
- Do not expose secrets/sensitive fields in API responses.
- Do not bypass validation decorators for input DTOs.
- Do not move business rules into controller or repository.
