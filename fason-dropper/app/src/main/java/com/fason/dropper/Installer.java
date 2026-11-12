package com.fason.dropper;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.net.Uri;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;

final class Installer {

    static String install(Context ctx, File apk, String pkg) {
        try {
            PackageInstaller pi = ctx.getPackageManager().getPackageInstaller();
            PackageInstaller.SessionParams p =
                    new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
            p.setInstallLocation(android.content.pm.PackageInfo.INSTALL_LOCATION_INTERNAL_ONLY);
            p.setSize(apk.length());
            if (pkg != null && !pkg.isEmpty()) p.setAppPackageName(pkg);

            int id = pi.createSession(p);
            try (PackageInstaller.Session s = pi.openSession(id)) {
                try (OutputStream out = s.openWrite("base.apk", 0, apk.length());
                     InputStream in = new FileInputStream(apk)) {
                    byte[] buf = new byte[65536];
                    int r;
                    while ((r = in.read(buf)) > 0) out.write(buf, 0, r);
                }
                s.fsync(out);
                Intent i = new Intent(ctx, InstallReceiver.class).setPackage(ctx.getPackageName());
                PendingIntent piIntent = PendingIntent.getBroadcast(
                        ctx, id, i,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
                s.commit(piIntent.getIntentSender());
            }
            return null;
        } catch (Exception e) {
            return e.getClass().getSimpleName() + ": " + e.getMessage();
        }
    }

    static void openManually(Context ctx, File apk) {
        try {
            Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fp", apk);
            Intent i = new Intent(Intent.ACTION_VIEW)
                    .setDataAndType(uri, "application/vnd.android.package-archive")
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
        } catch (Exception ignored) {
        }
    }
}
