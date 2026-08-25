# Secure messaging and Android delivery workflow

This is a release gate, not a feature checklist. A missed gate blocks release.

## 0. Threat model sign-off

- Threats covered: lost device, malicious relay, account takeover, replay, message
  injection, metadata exposure, compromised network, and compromised client.
- Explicitly not solved: traffic-analysis anonymity, endpoint malware, or a user
  who accepts a changed safety number without verification.
- Publish a plain-language privacy statement that says exactly what metadata is
  retained and for how long.

## 1. Cryptographic implementation gate

- Use a maintained, independently reviewed Signal-compatible implementation;
  do not implement PQXDH/X3DH, Double Ratchet, or attachment encryption from
  scratch.
- Use post-quantum session establishment where the selected maintained library
  supports it, then Double Ratchet with authenticated encryption and header
  protection.
- Generate device identity keys locally. On Android, wrap local session state
  with a non-exportable Android Keystore key; require device unlock for access.
- Verify safety numbers after pairing and on every identity-key change.
- Delete one-time prekeys, consumed invitations, message keys, and expired
  ciphertext on schedule. Do not log plaintext, key material, QR secrets, or
  decrypted error objects.

## 2. Backend gate

- Apply `20260825012000_secure_messaging_foundation.sql` only in a staging
  project first.
- Implement authenticated Edge Functions for `pair`, `prekey-bundle`,
  `enqueue-envelope`, `ack-envelope`, and `revoke-device`.
- Every function verifies the caller's JWT, ownership/device binding, pairing,
  expiry, replay protection, size limits, and rate limits.
- Database and Realtime are private-only. Push notifications contain no sender,
  message text, link, or conversation id—only a generic wake-up signal.
- Run migrations and function tests against staging before production.

## 3. Android gate

- Minimum Android version and supported-device policy are documented.
- Build a native Kotlin app, not a WebView holder for private keys.
- Store identity/session wrapping keys in Android Keystore; prefer hardware-backed
  protection when available and show users when the device cannot provide it.
- Use certificate pinning only with a documented rotation strategy; otherwise use
  standard platform TLS validation. Disable cleartext traffic, screenshots on
  sensitive screens, backups of secrets, and debug logging in release builds.
- Sign release APKs with a dedicated upload/release key held outside the repo;
  produce SHA-256 checksums and a signed release manifest.

## 4. Verification gate

- Unit and known-answer tests supplied by the selected crypto implementation.
- Pairing tests: expiry, replay, wrong QR secret, duplicate scan, revoked device,
  safety-number change.
- Delivery tests: offline recipient, retry, duplicates, out-of-order envelopes,
  1 MB limit, expiry, acknowledgement, device loss.
- Real Android devices on Wi-Fi↔cellular, separate Wi-Fi networks, roaming/VPN,
  and temporary network loss. Verify that plaintext is absent from Supabase,
  logs, notification payloads, and crash reporting.
- Dynamic Android assessment aligned with OWASP MASVS, dependency/SBOM scan, and
  an independent cryptography/mobile-security review.

## 5. Release gate

- All CI checks green and release candidate signed reproducibly.
- Independent review findings resolved or explicitly accepted in writing.
- Controlled beta with revocation/kill-switch and incident-response contacts.
- Only then call the product “end-to-end encrypted.”
