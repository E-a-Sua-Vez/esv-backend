# Security Report

## Executive Summary

This document outlines security vulnerabilities and recommendations for the ESV Backend project. The analysis includes dependency vulnerabilities, code-level security issues, and recommended fixes.

## Dependency Vulnerabilities

### Critical & High Severity

#### 1. Axios (High Severity)
- **Versions Affected**: `<=0.30.1 || 1.0.0 - 1.11.0`
- **Issues**:
  - Cross-Site Request Forgery (CSRF) vulnerability
  - Server-Side Request Forgery (SSRF) vulnerability
  - Credential leakage via absolute URLs
  - Denial of Service (DoS) through lack of data size check
- **Impact**: High - Used by multiple dependencies (ett-events-lib, twilio)
- **Recommendation**:
  - Update axios to latest version (if available)
  - Review and restrict axios usage to trusted endpoints
  - Implement request size limits
  - Use axios interceptors to validate URLs

#### 2. Body-Parser (High Severity)
- **Versions Affected**: `<1.20.3`
- **Issue**: Denial of Service when URL encoding is enabled
- **Impact**: High - Used by Express/NestJS
- **Recommendation**:
  - Update to `@nestjs/platform-express@11.1.9` (breaking change)
  - Or update body-parser directly
  - Implement request size limits in `main.ts`

#### 3. Braces (High Severity)
- **Versions Affected**: `<=3.0.2`
- **Issues**:
  - Regular Expression Denial of Service (ReDoS)
  - Uncontrolled resource consumption
- **Impact**: Medium - Used in build tools
- **Recommendation**: Run `npm audit fix` to update

### Moderate Severity

#### 4. @nestjs/common (Moderate)
- **Versions Affected**: `<10.4.16`
- **Issue**: Remote code execution via Content-Type header
- **Impact**: High - Core framework dependency
- **Recommendation**:
  - Update to `@nestjs/common@11.1.9` (breaking change)
  - Test thoroughly after upgrade
  - Review Content-Type validation

#### 5. @grpc/grpc-js (Moderate)
- **Versions Affected**: `<1.8.22`
- **Issue**: Memory allocation above configured limits
- **Impact**: Medium - Used by Firebase/Firestore
- **Recommendation**:
  - Update Firebase dependencies
  - Monitor memory usage
  - Configure gRPC limits

#### 6. @babel/runtime (Moderate)
- **Versions Affected**: `<7.26.10`
- **Issue**: Inefficient RegExp complexity
- **Impact**: Low - Build-time dependency
- **Recommendation**: Run `npm audit fix`

## Code-Level Security Issues

### 1. Input Validation

**Issue**: Controllers accept `any` types instead of DTOs with validation.

**Examples**:
```typescript
// Current (insecure)
@Post()
public async createBooking(@Body() body: any): Promise<Booking> {
  // No validation
}

// Should be
@Post()
public async createBooking(@Body() dto: CreateBookingDto): Promise<Booking> {
  // Validated by class-validator
}
```

**Recommendation**:
- Create DTOs for all endpoints
- Use `class-validator` decorators
- Enable `ValidationPipe` globally (already done in `main.ts`)

### 2. Authentication Bypass

**Issue**: Auth guard can be bypassed in local environment.

**Location**: `src/auth/auth.guard.ts`

```typescript
if (environment !== 'local' && validateAuth === '1') {
  // Auth validation
}
return true; // Always returns true in local
```

**Recommendation**:
- Never bypass auth in production
- Use separate test environment
- Add logging for auth bypass events
- Consider using different guard for local development

### 3. CORS Configuration

**Issue**: Manual CORS headers allow all origins in some cases.

**Location**: `src/main.ts`

```typescript
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // ⚠️ Allows all origins
  // ...
});
```

**Recommendation**:
- Remove manual CORS headers
- Rely only on `enableCors()` configuration
- Ensure CORS config matches environment

### 4. Environment Variables

**Issue**: No validation of required environment variables at startup.

**Recommendation**:
- Use `@nestjs/config` with schema validation
- Fail fast if required vars are missing
- Document all required environment variables

### 5. Error Messages

**Issue**: Error messages may leak sensitive information.

**Examples**:
```typescript
throw new HttpException(`Error: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
```

**Recommendation**:
- Sanitize error messages in production
- Log detailed errors server-side only
- Return generic messages to clients

### 6. SQL Injection (Firestore)

**Status**: ✅ Protected - FireORM uses parameterized queries

**Note**: Firestore queries are generally safe, but ensure:
- No string concatenation in queries
- Use FireORM methods (whereEqualTo, etc.)
- Validate input before querying

### 7. Rate Limiting

**Issue**: No rate limiting on endpoints.

**Recommendation**:
- Implement `@nestjs/throttler`
- Add rate limits per endpoint
- Configure different limits for authenticated vs anonymous

### 8. Request Size Limits

**Issue**: Body parser limit is 10mb, but no validation on individual fields.

**Location**: `src/main.ts`

```typescript
app.use(bodyParser.json({ limit: '10mb' }));
```

**Recommendation**:
- Reduce limit if possible
- Validate file upload sizes separately
- Add timeout for large requests

### 9. Secrets Management

**Issue**: Private keys stored in environment variables as JSON strings.

**Location**: `src/auth/auth.guard.ts`

```typescript
const { KEY } = JSON.parse(process.env.PRIVATE_KEY);
```

**Recommendation**:
- Use secret management service (Google Secret Manager, AWS Secrets Manager)
- Never log secrets
- Rotate keys regularly
- Use separate keys per environment

### 10. HTTPS Enforcement

**Issue**: No explicit HTTPS enforcement in code.

**Recommendation**:
- Use reverse proxy (nginx, Cloud Load Balancer) for HTTPS
- Add HSTS headers
- Redirect HTTP to HTTPS in production

## Security Best Practices Recommendations

### Immediate Actions (High Priority)

1. **Update Dependencies**
   ```bash
   npm audit fix
   # Review breaking changes before updating major versions
   ```

2. **Add Input Validation**
   - Create DTOs for all endpoints
   - Add validation decorators
   - Test validation rules

3. **Fix CORS Configuration**
   - Remove manual CORS headers
   - Use only `enableCors()` configuration

4. **Add Rate Limiting**
   ```bash
   npm install @nestjs/throttler
   ```

5. **Environment Variable Validation**
   - Add schema validation
   - Fail on missing required vars

### Medium Priority

1. **Error Handling**
   - Sanitize error messages
   - Add structured logging
   - Implement error tracking (Sentry, etc.)

2. **Authentication**
   - Review auth bypass logic
   - Add audit logging
   - Implement refresh tokens if needed

3. **Monitoring**
   - Add security event logging
   - Monitor failed auth attempts
   - Track unusual patterns

### Low Priority

1. **Documentation**
   - Document security practices
   - Create security runbook
   - Add security checklist to PR template

2. **Testing**
   - Add security tests
   - Test input validation
   - Test auth flows

## Dependency Update Plan

### Safe Updates (Non-Breaking)
```bash
npm audit fix
```

### Breaking Updates (Requires Testing)
- `@nestjs/common`: 9.x → 11.x
- `@nestjs/platform-express`: 9.x → 11.x
- `firebase`: May require updates for @grpc/grpc-js fix

**Recommendation**:
1. Create feature branch
2. Update dependencies incrementally
3. Run full test suite
4. Test in staging environment
5. Monitor for issues

## Security Checklist

- [ ] Update all dependencies (run `npm audit fix`)
- [ ] Review and update breaking changes
- [ ] Add DTOs with validation for all endpoints
- [ ] Fix CORS configuration
- [ ] Add rate limiting
- [ ] Validate environment variables
- [ ] Sanitize error messages
- [ ] Review auth bypass logic
- [ ] Add security logging
- [ ] Implement request size limits
- [ ] Add HTTPS enforcement
- [ ] Review secrets management
- [ ] Add security tests
- [ ] Document security practices

## References

- [NestJS Security Best Practices](https://docs.nestjs.com/security/authentication)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [npm audit documentation](https://docs.npmjs.com/cli/v8/commands/npm-audit)

---

**Last Updated**: $(date)
**Next Review**: Quarterly

