package com.fason.dropper;

import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.security.spec.KeySpec;
import java.util.Arrays;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;

final class Crypto {
    private static final int TAG = 16;

    static SecretKey derive(String secret, String saltB64) throws Exception {
        byte[] salt = Base64.decode(saltB64, Base64.NO_WRAP);
        KeySpec spec = new PBEKeySpec(secret.toCharArray(), salt, 100_000, 256);
        SecretKeyFactory f = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
        return f.generateSecret(spec);
    }

    static byte[] open(byte[] blob, String ivB64, SecretKey key) throws Exception {
        byte[] iv = Base64.decode(ivB64, Base64.NO_WRAP);
        byte[] ct = Arrays.copyOfRange(blob, 0, blob.length - TAG);
        byte[] tag = Arrays.copyOfRange(blob, blob.length - TAG, blob.length);
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, iv));
        c.update(ct);
        return c.doFinal(tag);
    }

    static String sha256Hex(byte[] data) throws Exception {
        java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
        byte[] d = md.digest(data);
        StringBuilder sb = new StringBuilder();
        for (byte b : d) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    static String utf8(byte[] b) { return new String(b, StandardCharsets.UTF_8); }
}
