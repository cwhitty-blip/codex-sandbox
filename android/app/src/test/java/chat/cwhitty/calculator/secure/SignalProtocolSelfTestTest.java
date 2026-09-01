package chat.cwhitty.calculator.secure;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;
import org.signal.libsignal.protocol.message.CiphertextMessage;

public final class SignalProtocolSelfTestTest {
  @Test public void pqxdhAndDoubleRatchetRoundTrip() throws Exception {
    SignalProtocolSelfTest.Report report = SignalProtocolSelfTest.run();
    assertNotNull(report);
    assertEquals(CiphertextMessage.PREKEY_TYPE, report.firstType);
    assertEquals(CiphertextMessage.WHISPER_TYPE, report.replyType);
    assertTrue(report.safetyNumber.matches("[0-9]{5}( [0-9]{5}){5}"));
  }
}
