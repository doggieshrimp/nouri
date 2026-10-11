package com.nouri.dailylog;

import android.graphics.Color;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Matches the system bar areas to the reader's chosen background (see src/lib/appearance.ts).
 * MainActivity pads the web view away from the bars, so the window background shows behind them.
 */
@CapacitorPlugin(name = "AppTheme")
public class AppThemePlugin extends Plugin {

    @PluginMethod
    public void setColors(PluginCall call) {
        String background = call.getString("background");
        boolean darkIcons = Boolean.TRUE.equals(call.getBoolean("darkIcons", true));
        int color;
        try {
            color = Color.parseColor(background);
        } catch (IllegalArgumentException | NullPointerException e) {
            call.reject("Invalid background colour: " + background);
            return;
        }

        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            window.getDecorView().setBackgroundColor(color);
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
            controller.setAppearanceLightStatusBars(darkIcons);
            controller.setAppearanceLightNavigationBars(darkIcons);
            call.resolve();
        });
    }
}
