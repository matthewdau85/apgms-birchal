# API gateway role matrix

All API gateway routes require an `x-role` header indicating the caller's role. Missing headers return **401 Unauthorized** and roles below the minimum threshold return **403 Forbidden**.

| Route | Viewer | Analyst | Admin |
| --- | --- | --- | --- |
| `GET /health` | ✅ 200 | ✅ 200 | ✅ 200 |
| `GET /users` | ❌ 403 | ❌ 403 | ✅ 200 |
| `GET /bank-lines` | ✅ 200 | ✅ 200 | ✅ 200 |
| `POST /bank-lines` | ❌ 403 | ✅ 200 | ✅ 200 |

The expectations above are enforced by `services/api-gateway/test/authz.matrix.spec.ts`.
