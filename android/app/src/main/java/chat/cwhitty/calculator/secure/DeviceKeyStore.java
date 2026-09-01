package chat.cwhitty.calculator.secure;

import android.os.Build;
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
    KeyGenParameterSpec.Builder parameters = new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setKeySize(256)
      .setUserAuthenticationRequired(true)
      .setRandomizedEncryptionRequired(true);
    if (Build.VERSION.SDK_INT >= 30) {
      parameters.setUserAuthenticationParameters(30, KeyProperties.AUTH_BIOMETRIC_STRONG | KeyProperties.AUTH_DEVICE_CREDENTIAL);
    } else {
      parameters.setUserAuthenticationValidityDurationSeconds(30);
    }
    generator.init(parameters.build());
    return generator.generateKey();
  }
}
