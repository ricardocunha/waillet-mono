# AUTHENTICATION (SIWE + JWT)

Users prove wallet ownership by signing a message, then receive JWT tokens for API access.

## Flow Diagram

![Authentication Flow](auth_flow.png)

**Steps:**
1. Extension requests nonce from backend
2. Backend generates random nonce
3. Nonce stored in database (expires in 10 min)
4. Backend returns SIWE message to sign
5. Extension signs message with wallet's private key
6. Signature returned to extension
7. Extension sends message + signature to backend
8. Backend verifies cryptographic signature
9. Nonce marked as used (prevents replay)
10. JWT tokens returned to extension

## Error Codes

| Status | Code | Meaning |
|--------|------|---------|
| `400` | Bad Request | Missing or malformed fields |
| `401` | Unauthorized | Token missing, expired, or invalid |
| `403` | Forbidden | Valid token but insufficient permissions |
| `409` | Conflict | Nonce already used (replay attempt) |
| `500` | Internal Server Error | Unexpected backend failure |

## Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/auth/nonce?wallet_address=0x...` | No | Get nonce and SIWE message |
| `POST` | `/api/auth/verify` | No | Verify signature, get tokens |
| `POST` | `/api/auth/refresh` | No | Refresh access token |
| `GET` | `/api/auth/me` | Yes | Get current user |
| `POST` | `/api/auth/logout` | Yes | Logout |

## Protected Routes

Require `Authorization: Bearer <access_token>`:

- `/api/favorites/*`
- `/api/policies/*`
- `/api/ai/*`
- `/api/simulate/*`
- `/api/settings/*`

## Token Response

```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "expires_in": 900,
  "token_type": "Bearer"
}
```

## Configuration

```env
JWT_SECRET=your-32-char-minimum-secret-key
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=168h
AUTH_NONCE_TTL=10m
AUTH_DOMAIN=localhost
# Optional: set to "production" to enforce HTTPS-only cookies
APP_ENV=development
```

> Generate a strong secret with: `openssl rand -hex 32`

## Example

```bash
# 1. Get nonce
curl "http://localhost:8000/api/auth/nonce?wallet_address=0x742d..."

# 2. Sign message with wallet, then verify
curl -X POST "http://localhost:8000/api/auth/verify" \
  -H "Content-Type: application/json" \
  -d '{"message": "...", "signature": "0x..."}'

# 3. Use token for protected routes
curl "http://localhost:8000/api/favorites" \
  -H "Authorization: Bearer eyJ..."

# 4. Refresh access token when it expires
curl -X POST "http://localhost:8000/api/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "eyJ..."}'
```

## Extension Integration

The extension auto-authenticates when the wallet is unlocked:

1. User unlocks wallet → `App.tsx` calls `authenticate()`
2. `AuthService` signs SIWE message with private key
3. Tokens stored in `chrome.storage.local`
4. `api.ts` auto-includes JWT in protected requests

## Security Notes

- Nonces are single-use and expire in 10 minutes — prevents replay attacks
- Access tokens have a short TTL (15 min); refresh tokens live 7 days
- JWT secret must be at least 32 characters — use a strong random value in production
- All token storage is local to the extension; nothing is sent to third parties

---

*Diagram generated with [diagrams](https://diagrams.mingrammer.com/) - see `auth_diagram.py`*
