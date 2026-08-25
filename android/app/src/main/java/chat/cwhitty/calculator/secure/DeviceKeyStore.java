package chat.cwhitty.calculator.secure;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import java.security.KeyStore;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;

/** Wraps locally persisted session state. Private messaging keys never leave the device. */
final class DeviceKeyStore {
  private static final String STORE = "AndroidKeyStore";
  private static final String ALIAS = "calculator-secure-state-v1";

  static SecretKey getOrCreate() throws Exception {
    KeyStore keyStore = KeyStore.getInstance(STORE);
    keyStore.load(null);
    if (keyStore.containsAlias(ALIAS)) return ((KeyStore.SecretKeyEntry) keyStore.getEntry(ALIAS, null)).getSecretKey();
    KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, STORE);
    generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setKeySize(256)
      .setUserAuthenticationRequired(true)
      .setUserAuthenticationParameters(30, KeyProperties.AUTH_BIOMETRIC_STRONG | KeyProperties.AUTH_DEVICE_CREDENTIAL)
      .setRandomizedEncryptionRequired(true)
      .build());
    return generator.generateKey();
  }
}
