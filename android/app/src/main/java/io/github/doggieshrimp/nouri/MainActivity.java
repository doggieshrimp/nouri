package io.github.doggieshrimp.nouri;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Draw edge-to-edge on every Android version, as Android 15+ does by default, so the
        // layout below behaves the same everywhere. Transparent bars with dark icons suit the
        // default cream theme; AppThemePlugin switches icons for the dark theme.
        // Called after super.onCreate: enabling earlier creates the window under the launch
        // theme, before Capacitor switches to its no-action-bar theme, so a title bar appears.
        registerPlugin(AppThemePlugin.class);
        super.onCreate(savedInstanceState);
        SystemBarStyle barStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT);
        EdgeToEdge.enable(this, barStyle, barStyle);

        // Keep the web content clear of the status bar, navigation bar, notches and the
        // keyboard by padding its container natively. CSS safe-area values are unreliable
        // across Android WebView versions (some report 0, so content slid under the clock).
        // The cream window background shows through behind the bars.
        View content = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(content, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
            return WindowInsetsCompat.CONSUMED;
        });
    }
}
