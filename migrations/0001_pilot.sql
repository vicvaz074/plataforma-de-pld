PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS user (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 emailVerified INTEGER NOT NULL DEFAULT 0, image TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL,
 platformRole TEXT NOT NULL DEFAULT 'user' CHECK(platformRole IN ('superadmin','user')),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
 requiresPasswordChange INTEGER NOT NULL DEFAULT 1, twoFactorEnabled INTEGER NOT NULL DEFAULT 0, mfaEnrolledAt INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS session (
 id TEXT PRIMARY KEY, expiresAt INTEGER NOT NULL, token TEXT NOT NULL UNIQUE,
 createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, ipAddress TEXT, userAgent TEXT,
 userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS session_user ON session(userId);
CREATE TABLE IF NOT EXISTS account (
 id TEXT PRIMARY KEY, accountId TEXT NOT NULL, providerId TEXT NOT NULL,
 userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
 accessToken TEXT, refreshToken TEXT, idToken TEXT, accessTokenExpiresAt INTEGER,
 refreshTokenExpiresAt INTEGER, scope TEXT, password TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS account_user ON account(userId);
CREATE TABLE IF NOT EXISTS pld_user_preferences (
 userId TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
 preferences TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(preferences)), updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS verification (
 id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL, expiresAt INTEGER NOT NULL,
 createdAt INTEGER, updatedAt INTEGER
);
CREATE INDEX IF NOT EXISTS verification_identifier ON verification(identifier);
CREATE TABLE IF NOT EXISTS twoFactor (
 id TEXT PRIMARY KEY, secret TEXT NOT NULL, backupCodes TEXT NOT NULL,
 userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, verified INTEGER NOT NULL DEFAULT 0,
 failedVerificationCount INTEGER NOT NULL DEFAULT 0, lockedUntil INTEGER
);
CREATE INDEX IF NOT EXISTS two_factor_user ON twoFactor(userId);
CREATE TABLE IF NOT EXISTS rateLimit (
 id TEXT PRIMARY KEY, key TEXT UNIQUE NOT NULL, count INTEGER NOT NULL, lastRequest INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS pld_organizations (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, mfaEnabled INTEGER NOT NULL DEFAULT 0,
 createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pld_companies (
 id TEXT PRIMARY KEY, organizationId TEXT NOT NULL REFERENCES pld_organizations(id),
 name TEXT NOT NULL, rfc TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')), isInbox INTEGER NOT NULL DEFAULT 0,
 createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pld_companies_org ON pld_companies(organizationId);
CREATE TABLE IF NOT EXISTS pld_memberships (
 userId TEXT NOT NULL REFERENCES user(id), organizationId TEXT NOT NULL REFERENCES pld_organizations(id),
 role TEXT NOT NULL CHECK(role IN ('admin','compliance','capture','viewer')),
 PRIMARY KEY(userId, organizationId)
);
CREATE TABLE IF NOT EXISTS pld_grants (
 userId TEXT NOT NULL REFERENCES user(id), companyId TEXT NOT NULL REFERENCES pld_companies(id),
 role TEXT NOT NULL DEFAULT 'viewer', permissions TEXT NOT NULL DEFAULT '{}',
 PRIMARY KEY(userId, companyId)
);
CREATE TABLE IF NOT EXISTS pld_records (
 companyId TEXT NOT NULL REFERENCES pld_companies(id), collection TEXT NOT NULL, id TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision > 0), payload TEXT NOT NULL CHECK(json_valid(payload)),
 deleted INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, updatedBy TEXT NOT NULL REFERENCES user(id),
 PRIMARY KEY(companyId, collection, id)
);
CREATE INDEX IF NOT EXISTS pld_records_company ON pld_records(companyId, collection);
CREATE TABLE IF NOT EXISTS pld_record_versions (
 companyId TEXT NOT NULL, collection TEXT NOT NULL, id TEXT NOT NULL, revision INTEGER NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload)), deleted INTEGER NOT NULL DEFAULT 0,
 createdAt TEXT NOT NULL, actorId TEXT NOT NULL REFERENCES user(id),
 PRIMARY KEY(companyId,collection,id,revision)
);
CREATE TABLE IF NOT EXISTS pld_revision_guard (id TEXT PRIMARY KEY, valid INTEGER NOT NULL CHECK(valid=1));
CREATE TABLE IF NOT EXISTS pld_audit (
 id TEXT PRIMARY KEY, organizationId TEXT, companyId TEXT, actorId TEXT NOT NULL,
 action TEXT NOT NULL, entityType TEXT NOT NULL, entityId TEXT NOT NULL,
 details TEXT NOT NULL DEFAULT '{}', createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pld_audit_org ON pld_audit(organizationId, createdAt);
CREATE TABLE IF NOT EXISTS pld_documents (
 id TEXT PRIMARY KEY, companyId TEXT NOT NULL REFERENCES pld_companies(id), moduleKey TEXT NOT NULL,
 title TEXT NOT NULL, relatedType TEXT, relatedId TEXT, revision INTEGER NOT NULL,
 createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pld_file_versions (
 id TEXT PRIMARY KEY, documentId TEXT NOT NULL REFERENCES pld_documents(id), companyId TEXT NOT NULL REFERENCES pld_companies(id),
 version INTEGER NOT NULL, objectKey TEXT NOT NULL UNIQUE, sha256 TEXT NOT NULL, fileName TEXT NOT NULL,
 mimeType TEXT NOT NULL, size INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
 createdAt TEXT NOT NULL, uploadedBy TEXT NOT NULL REFERENCES user(id), reviewedBy TEXT, reviewedAt TEXT, reason TEXT,
 UNIQUE(documentId,version)
);
CREATE INDEX IF NOT EXISTS pld_versions_company ON pld_file_versions(companyId, documentId);
CREATE TABLE IF NOT EXISTS pld_import_jobs (
 id TEXT PRIMARY KEY, companyId TEXT NOT NULL REFERENCES pld_companies(id), actorId TEXT NOT NULL REFERENCES user(id),
 fileVersionId TEXT NOT NULL REFERENCES pld_file_versions(id), status TEXT NOT NULL,
 moduleKey TEXT NOT NULL, idempotencyKey TEXT NOT NULL,
 result TEXT NOT NULL DEFAULT '{}', error TEXT, attempts INTEGER NOT NULL DEFAULT 0,
 createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
 UNIQUE(companyId,idempotencyKey)
);
CREATE TABLE IF NOT EXISTS pld_import_outbox (
 jobId TEXT PRIMARY KEY REFERENCES pld_import_jobs(id), dispatchedAt TEXT
);
