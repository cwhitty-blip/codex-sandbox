package chat.cwhitty.calculator.secure;

import android.app.Activity;
import android.os.Bundle;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.graphics.Color;
import android.view.Gravity;

public final class MainActivity extends Activity {
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
    LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setGravity(Gravity.CENTER); root.setPadding(56,56,56,56); root.setBackgroundColor(Color.rgb(16,21,34));
    TextView title = new TextView(this); title.setText("Calendar"); title.setTextSize(30); title.setTextColor(Color.WHITE); title.setGravity(Gravity.CENTER);
    TextView copy = new TextView(this); copy.setText("Secure messaging is being configured.\n\nThis release will not send messages until device pairing, encrypted delivery, and independent security review are complete."); copy.setTextSize(17); copy.setTextColor(Color.rgb(210,218,238)); copy.setGravity(Gravity.CENTER); copy.setPadding(0,28,0,0);
    root.addView(title); root.addView(copy); setContentView(root);
    try { DeviceKeyStore.getOrCreate(); } catch (Exception ignored) { /* fail closed: messaging remains unavailable */ }
  }
}
