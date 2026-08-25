# Secure Messaging foundation

Status: **not released; no end-to-end encryption claim may be made yet.**

## Security boundary

The browser generates and retains private device keys locally. Supabase may hold
only public keys, one-time invitation hashes, and encrypted envelopes. It must
never receive plaintext messages, private keys, recovery phrases, or unencrypted
attachments.

## Pairing

1. Phone A creates a 256-bit random invitation and displays it as a QR code.
2. Only `SHA-256(invitation)` is stored, with a maximum 15-minute expiry.
3. Phone B scans the code, signs in, and invokes an authenticated Edge Function.
4. That function atomically verifies the hash, expiry, and unused state; it binds
   Phone B once and deletes/consumes the invitation.
5. Both phones display a safety number derived from their verified public keys.
   Users must compare it out-of-band before trusting the contact.

## Encryption and delivery

Implement a reviewed Signal-compatible protocol (X3DH/PQXDH plus Double Ratchet)
before enabling send. WebCrypto AES-GCM alone is not sufficient: it lacks secure
session establishment, forward secrecy, and break-in recovery. Envelopes are
durable ciphertext records with acknowledgement and expiry; Realtime/push only
wake clients and never carry plaintext previews.

## Explicit non-goals for the first release

- No promise of anonymity: a service can still observe IP addresses, timing, and
  ciphertext sizes.
- No insecure fallback to Calculator Numbers or public broadcast channels.
- No background delivery claim until platform push notifications are configured.
- No release until an external security review and two-device, cross-network tests
  have passed.
