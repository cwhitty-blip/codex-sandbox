package chat.cwhitty.calculator.secure;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.window.OnBackInvokedDispatcher;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Hosts the current Calculator UI. Secure messaging is intentionally disabled in
 * the web layer: future identity and session keys stay behind native code and the
 * Android Keystore after the pairing, delivery-test, and security-review gates.
 */
public final class MainActivity extends Activity {
  private static final String APP_HOST = "appassets.androidplatform.net";
  private static final int FILE_PICKER_REQUEST = 41;
  private static final int WEB_PERMISSION_REQUEST = 42;

  private WebView webView;
  private ValueCallback<Uri[]> filePickerCallback;
  private PermissionRequest pendingWebPermission;
  private final ExecutorService protocolExecutor = Executors.newSingleThreadExecutor();
  private boolean secureLabVisible;

  @SuppressLint("SetJavaScriptEnabled")
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
    try { DeviceKeyStore.getOrCreate(); } catch (Exception ignored) { /* Secure features remain closed. */ }

    webView = new WebView(this);
    WebSettings settings = webView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(true);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    settings.setMediaPlaybackRequiresUserGesture(true);
    settings.setSupportZoom(false);

    webView.setWebViewClient(new CalculatorWebViewClient());
    webView.setWebChromeClient(new CalculatorChromeClient());
    webView.addJavascriptInterface(new CalculatorAndroidBridge(), "CalculatorAndroid");
    setContentView(webView);
    webView.loadUrl("https://" + APP_HOST + "/assets/index.html?android=1");
    if (Build.VERSION.SDK_INT >= 33) {
      getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
    }
  }

  @SuppressLint("GestureBackNavigation")
  @Override public void onBackPressed() {
    handleBack();
  }

  private void handleBack() {
    if (secureLabVisible) {
      secureLabVisible = false;
      setContentView(webView);
      return;
    }
    if (webView != null) {
      webView.evaluateJavascript(
        "(()=>{const c=document.getElementById('calc');if(c&&!c.classList.contains('active')){window.CalculatorCore?.lock?.();return true}return false})()",
        value -> { if (!"true".equals(value)) finish(); }
      );
      return;
    }
    finish();
  }

  @Override protected void onDestroy() {
    protocolExecutor.shutdownNow();
    if (webView != null) {
      webView.stopLoading();
      webView.destroy();
      webView = null;
    }
    super.onDestroy();
  }

  private int dp(int value) {
    return Math.round(value * getResources().getDisplayMetrics().density);
  }

  private TextView label(String value, float size, int color) {
    TextView text = new TextView(this);
    text.setText(value);
    text.setTextSize(size);
    text.setTextColor(color);
    return text;
  }

  private View labCard(String title, String detail, int detailColor) {
    LinearLayout card = new LinearLayout(this);
    card.setOrientation(LinearLayout.VERTICAL);
    card.setPadding(dp(18), dp(16), dp(18), dp(16));
    card.setBackgroundColor(Color.WHITE);
    TextView heading = label(title, 18, Color.rgb(25, 25, 30));
    heading.setTypeface(Typeface.DEFAULT_BOLD);
    TextView body = label(detail, 14, detailColor);
    body.setPadding(0, dp(6), 0, 0);
    card.addView(heading);
    card.addView(body);
    LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
    params.bottomMargin = dp(12);
    card.setLayoutParams(params);
    return card;
  }

  private void showSecureMessagingLab() {
    secureLabVisible = true;
    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setPadding(dp(22), dp(42), dp(22), dp(24));
    root.setBackgroundColor(Color.rgb(242, 242, 247));

    Button back = new Button(this);
    back.setText("‹ Calculator Home");
    back.setAllCaps(false);
    back.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
    back.setTextColor(Color.rgb(0, 102, 220));
    back.setBackgroundColor(Color.TRANSPARENT);
    back.setOnClickListener(view -> handleBack());
    root.addView(back, new LinearLayout.LayoutParams(-1, dp(48)));

    TextView title = label("Secure Messaging Lab", 31, Color.rgb(20, 20, 24));
    title.setTypeface(Typeface.DEFAULT_BOLD);
    root.addView(title);
    TextView subtitle = label("Two-device test foundation", 15, Color.rgb(95, 95, 104));
    subtitle.setPadding(0, dp(5), 0, dp(22));
    root.addView(subtitle);

    root.addView(labCard("Signal Protocol", "Official maintained Android library 0.99.1 included", Color.rgb(52, 120, 70)));
    root.addView(labCard("Private keys", "Native-only; the Calculator web interface cannot read them", Color.rgb(52, 120, 70)));
    root.addView(labCard("Messages & Calls", "OFF until pairing, two-device delivery tests, and security review pass", Color.rgb(180, 90, 0)));

    TextView result = label("Self-test has not run yet.", 15, Color.rgb(80, 80, 88));
    result.setPadding(dp(4), dp(12), dp(4), dp(12));
    root.addView(result);

    Button run = new Button(this);
    run.setText("Run Encrypted Round-Trip Self-Test");
    run.setAllCaps(false);
    run.setTextSize(16);
    run.setTextColor(Color.WHITE);
    run.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(20, 92, 230)));
    run.setOnClickListener(view -> {
      run.setEnabled(false);
      result.setText("Running PQXDH and Double Ratchet checks…");
      protocolExecutor.execute(() -> {
        try {
          SignalProtocolSelfTest.Report report = SignalProtocolSelfTest.run();
          runOnUiThread(() -> {
            result.setText("PASS — encrypted pre-key message, reply, and ratchet message decrypted correctly.\n\nSynthetic safety number:\n" + report.safetyNumber);
            result.setTextColor(Color.rgb(30, 125, 62));
            run.setText("Run Again");
            run.setEnabled(true);
          });
        } catch (Throwable error) {
          runOnUiThread(() -> {
            result.setText("FAILED — secure messaging remains locked. No user message was sent.");
            result.setTextColor(Color.rgb(190, 45, 45));
            run.setText("Try Again");
            run.setEnabled(true);
          });
        }
      });
    });
    LinearLayout.LayoutParams runParams = new LinearLayout.LayoutParams(-1, dp(58));
    runParams.topMargin = dp(6);
    root.addView(run, runParams);
    setContentView(root);
  }

  private final class CalculatorAndroidBridge {
    @JavascriptInterface public void openSecureMessagingLab() {
      runOnUiThread(() -> showSecureMessagingLab());
    }
  }

  @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);
    if (requestCode != FILE_PICKER_REQUEST || filePickerCallback == null) return;
    Uri[] result = null;
    if (resultCode == RESULT_OK && data != null) {
      ClipData clips = data.getClipData();
      if (clips != null) {
        result = new Uri[clips.getItemCount()];
        for (int i = 0; i < clips.getItemCount(); i++) result[i] = clips.getItemAt(i).getUri();
      } else if (data.getData() != null) {
        result = new Uri[] { data.getData() };
      }
    }
    filePickerCallback.onReceiveValue(result);
    filePickerCallback = null;
  }

  @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
    super.onRequestPermissionsResult(requestCode, permissions, results);
    if (requestCode != WEB_PERMISSION_REQUEST || pendingWebPermission == null) return;
    boolean granted = results.length > 0;
    for (int result : results) granted &= result == PackageManager.PERMISSION_GRANTED;
    if (granted) pendingWebPermission.grant(pendingWebPermission.getResources());
    else pendingWebPermission.deny();
    pendingWebPermission = null;
  }

  private final class CalculatorWebViewClient extends WebViewClient {
    @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
      Uri uri = request.getUrl();
      if (!APP_HOST.equals(uri.getHost()) || !uri.getPath().startsWith("/assets/")) return null;
      String path = uri.getPath().substring("/assets/".length());
      if (path.contains("..")) return new WebResourceResponse("text/plain", "UTF-8", null);
      try {
        InputStream input = getAssets().open(path);
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store");
        headers.put("X-Content-Type-Options", "nosniff");
        return new WebResourceResponse(mimeType(path), "UTF-8", 200, "OK", headers, input);
      } catch (IOException error) {
        return null;
      }
    }

    @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
      Uri uri = request.getUrl();
      if (APP_HOST.equals(uri.getHost())) return false;
      String scheme = uri.getScheme();
      if ("http".equals(scheme) || "https".equals(scheme)) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) { }
        return true;
      }
      return false;
    }
  }

  private final class CalculatorChromeClient extends WebChromeClient {
    @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
      if (filePickerCallback != null) filePickerCallback.onReceiveValue(null);
      filePickerCallback = callback;
      Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
      picker.addCategory(Intent.CATEGORY_OPENABLE);
      picker.setType(bestMimeType(params.getAcceptTypes()));
      picker.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
      try {
        startActivityForResult(picker, FILE_PICKER_REQUEST);
        return true;
      } catch (Exception error) {
        filePickerCallback = null;
        callback.onReceiveValue(null);
        return false;
      }
    }

    @Override public void onPermissionRequest(PermissionRequest request) {
      runOnUiThread(() -> {
        String permission = null;
        for (String resource : request.getResources()) {
          if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) permission = Manifest.permission.RECORD_AUDIO;
          if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) permission = Manifest.permission.CAMERA;
        }
        if (permission == null) { request.deny(); return; }
        if (checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED) {
          request.grant(request.getResources());
          return;
        }
        pendingWebPermission = request;
        requestPermissions(new String[] { permission }, WEB_PERMISSION_REQUEST);
      });
    }
  }

  private static String bestMimeType(String[] accepted) {
    if (accepted == null || accepted.length == 0) return "*/*";
    for (String value : accepted) if (value != null && !value.isBlank()) return value;
    return "*/*";
  }

  private static String mimeType(String path) {
    String extension = MimeTypeMap.getFileExtensionFromUrl(path);
    String detected = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
    if (detected != null) return detected;
    if (path.endsWith(".js")) return "text/javascript";
    if (path.endsWith(".webmanifest")) return "application/manifest+json";
    if (path.endsWith(".svg")) return "image/svg+xml";
    return "application/octet-stream";
  }
}
