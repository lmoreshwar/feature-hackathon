# Hackathon Application

This workspace currently contains a NestJS backend and Docker configuration for MongoDB.

## Project Structure

- `backend/`: NestJS API with JWT authentication and Swagger
- `docker/`: Docker Compose setup for MongoDB
- `frontend/`: Frontend folder placeholder

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- Docker Desktop, or another Docker runtime, if you want to run MongoDB with Docker

## Backend Setup

1. Open a terminal in the workspace root.
2. Install backend dependencies:

```bash
cd backend
npm install
```

3. Create the backend environment file:

```bash
copy .env.example .env
```

If you are using Git Bash on Windows, use:

```bash
cp .env.example .env
```

4. Update `backend/.env` if needed. At minimum, verify these values:

- `PORT`: API port, default `3000`
- `MONGO_URI`: MongoDB connection string
- `JWT_ACCESS_SECRET`: secret used to sign access tokens
- `JWT_REFRESH_SECRET`: secret used to sign refresh tokens

## Run MongoDB With Docker

From the workspace root:

```bash
docker compose -f docker/docker-compose.yml up -d
```

This starts MongoDB on port `27017` by default.

## Run The Backend

From the `backend/` folder:

```bash
npm run start:dev
```

Useful scripts:

- `npm run start:dev`: run the API in watch mode for development
- `npm run start`: run the Nest application normally
- `npm run build`: compile the backend into `backend/dist`
- `npm run start:prod`: run the compiled build
- `npm run test`: run tests

## Swagger

When the backend is running, Swagger is available at:

```text
http://localhost:3000/api/docs
```

If you change `PORT` in `backend/.env`, update the port in the URL accordingly.

## Authentication Notes

- Access tokens are valid for 4 hours
- Refresh tokens are used to obtain a new token pair
- Swagger includes the auth endpoints under `/api/auth`

## Production Start

To build and run the compiled backend:

```bash
cd backend
npm run build
npm run start:prod
```

## Troubleshooting

- If MongoDB connection fails, verify the `MONGO_URI` in `backend/.env`
- If Docker MongoDB does not start, check whether port `27017` is already in use
- If Swagger does not load, make sure the backend is running and the configured port matches your `.env`