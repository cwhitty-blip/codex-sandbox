package chat.cwhitty.calculator.secure;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import org.signal.libsignal.protocol.IdentityKeyPair;
import org.signal.libsignal.protocol.SessionBuilder;
import org.signal.libsignal.protocol.SessionCipher;
import org.signal.libsignal.protocol.SignalProtocolAddress;
import org.signal.libsignal.protocol.ecc.ECKeyPair;
import org.signal.libsignal.protocol.kem.KEMKeyPair;
import org.signal.libsignal.protocol.kem.KEMKeyType;
import org.signal.libsignal.protocol.message.CiphertextMessage;
import org.signal.libsignal.protocol.message.PreKeySignalMessage;
import org.signal.libsignal.protocol.message.SignalMessage;
import org.signal.libsignal.protocol.state.KyberPreKeyRecord;
import org.signal.libsignal.protocol.state.PreKeyBundle;
import org.signal.libsignal.protocol.state.PreKeyRecord;
import org.signal.libsignal.protocol.state.SignedPreKeyRecord;
import org.signal.libsignal.protocol.state.impl.InMemorySignalProtocolStore;

/** Runs only synthetic in-memory protocol checks. It never handles user messages. */
final class SignalProtocolSelfTest {
  static final class Report {
    final String safetyNumber;
    final int firstType;
    final int replyType;

    Report(String safetyNumber, int firstType, int replyType) {
      this.safetyNumber = safetyNumber;
      this.firstType = firstType;
      this.replyType = replyType;
    }
  }

  private static final SecureRandom RANDOM = new SecureRandom();

  static Report run() throws Exception {
    Endpoint alice = endpoint("self-test-alice");
    Endpoint bob = endpoint("self-test-bob");

    new SessionBuilder(bob.store, alice.address, bob.address).process(alice.bundle);
    SessionCipher bobCipher = new SessionCipher(bob.store, bob.address, alice.address);
    SessionCipher aliceCipher = new SessionCipher(alice.store, alice.address, bob.address);

    byte[] firstPlaintext = "calculator secure protocol self-test one".getBytes(StandardCharsets.UTF_8);
    CiphertextMessage first = bobCipher.encrypt(firstPlaintext);
    if (first.getType() != CiphertextMessage.PREKEY_TYPE) throw new IllegalStateException("First envelope was not a pre-key message");
    byte[] firstResult = aliceCipher.decrypt(new PreKeySignalMessage(first.serialize()));
    if (!MessageDigest.isEqual(firstPlaintext, firstResult)) throw new IllegalStateException("First round trip failed");

    byte[] replyPlaintext = "calculator secure protocol self-test reply".getBytes(StandardCharsets.UTF_8);
    CiphertextMessage reply = aliceCipher.encrypt(replyPlaintext);
    if (reply.getType() != CiphertextMessage.WHISPER_TYPE) throw new IllegalStateException("Reply did not use the established session");
    byte[] replyResult = bobCipher.decrypt(new SignalMessage(reply.serialize()));
    if (!MessageDigest.isEqual(replyPlaintext, replyResult)) throw new IllegalStateException("Reply round trip failed");

    byte[] nextPlaintext = "calculator secure protocol self-test ratchet".getBytes(StandardCharsets.UTF_8);
    CiphertextMessage next = bobCipher.encrypt(nextPlaintext);
    byte[] nextResult = aliceCipher.decrypt(new SignalMessage(next.serialize()));
    if (!MessageDigest.isEqual(nextPlaintext, nextResult)) throw new IllegalStateException("Ratchet round trip failed");

    return new Report(safetyNumber(alice.identity, bob.identity), first.getType(), reply.getType());
  }

  private static Endpoint endpoint(String name) throws Exception {
    IdentityKeyPair identity = IdentityKeyPair.generate();
    int registrationId = 1 + RANDOM.nextInt(16380);
    InMemorySignalProtocolStore store = new InMemorySignalProtocolStore(identity, registrationId);

    int preKeyId = 1;
    ECKeyPair preKeyPair = ECKeyPair.generate();
    store.storePreKey(preKeyId, new PreKeyRecord(preKeyId, preKeyPair));

    int signedPreKeyId = 1;
    ECKeyPair signedPreKeyPair = ECKeyPair.generate();
    byte[] signedPreKeySignature = identity.getPrivateKey().calculateSignature(signedPreKeyPair.getPublicKey().serialize());
    store.storeSignedPreKey(signedPreKeyId, new SignedPreKeyRecord(signedPreKeyId, System.currentTimeMillis(), signedPreKeyPair, signedPreKeySignature));

    int kyberPreKeyId = 1;
    KEMKeyPair kyberPreKeyPair = KEMKeyPair.generate(KEMKeyType.KYBER_1024);
    byte[] kyberSignature = identity.getPrivateKey().calculateSignature(kyberPreKeyPair.getPublicKey().serialize());
    store.storeKyberPreKey(kyberPreKeyId, new KyberPreKeyRecord(kyberPreKeyId, System.currentTimeMillis(), kyberPreKeyPair, kyberSignature));

    PreKeyBundle bundle = new PreKeyBundle(
      registrationId,
      1,
      preKeyId,
      preKeyPair.getPublicKey(),
      signedPreKeyId,
      signedPreKeyPair.getPublicKey(),
      signedPreKeySignature,
      identity.getPublicKey(),
      kyberPreKeyId,
      kyberPreKeyPair.getPublicKey(),
      kyberSignature
    );
    return new Endpoint(identity, store, new SignalProtocolAddress(name, 1), bundle);
  }

  private static String safetyNumber(IdentityKeyPair first, IdentityKeyPair second) throws Exception {
    byte[] a = first.getPublicKey().serialize();
    byte[] b = second.getPublicKey().serialize();
    byte[] left = compare(a, b) <= 0 ? a : b;
    byte[] right = left == a ? b : a;
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    digest.update(left);
    byte[] hash = digest.digest(right);
    StringBuilder number = new StringBuilder();
    for (int i = 0; i < 30; i++) {
      if (i > 0 && i % 5 == 0) number.append(' ');
      number.append((char) ('0' + ((hash[i % hash.length] & 0xff) % 10)));
    }
    Arrays.fill(hash, (byte) 0);
    return number.toString();
  }

  private static int compare(byte[] a, byte[] b) {
    for (int i = 0; i < Math.min(a.length, b.length); i++) {
      int result = Integer.compare(a[i] & 0xff, b[i] & 0xff);
      if (result != 0) return result;
    }
    return Integer.compare(a.length, b.length);
  }

  private static final class Endpoint {
    final IdentityKeyPair identity;
    final InMemorySignalProtocolStore store;
    final SignalProtocolAddress address;
    final PreKeyBundle bundle;

    Endpoint(IdentityKeyPair identity, InMemorySignalProtocolStore store, SignalProtocolAddress address, PreKeyBundle bundle) {
      this.identity = identity;
      this.store = store;
      this.address = address;
      this.bundle = bundle;
    }
  }
}
