-- Receipts are written in the same transaction as the exact document version.
-- The opaque client key identifies an upload attempt, not a global file hash.
CREATE TABLE IF NOT EXISTS pld_file_upload_receipts (
  actorId TEXT NOT NULL REFERENCES user(id),
  companyId TEXT NOT NULL REFERENCES pld_companies(id),
  moduleKey TEXT NOT NULL,
  uploadKey TEXT NOT NULL CHECK(length(uploadKey)=64),
  requestHash TEXT NOT NULL CHECK(length(requestHash)=64),
  versionId TEXT NOT NULL UNIQUE REFERENCES pld_file_versions(id),
  createdAt TEXT NOT NULL,
  PRIMARY KEY(actorId, companyId, moduleKey, uploadKey)
);
