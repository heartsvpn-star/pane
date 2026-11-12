import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { FastifyInstance } from 'fastify';
import AdmZip from 'adm-zip';
import sharp from 'sharp';
import { getDb, getSqliteDb, dbHelpers } from '../db/index.js';
import { buildRecords } from '../db/schema.js';
import { paths, ensureDataDir, createBuildDir } from '../config/paths.js';
import { getConfig } from '../config/index.js';
import { eq, and } from 'drizzle-orm';
import { requirePermission, getRequestUser } from '../middleware/auth.js';
import { log } from '../utils/logger.js';
import { socketService } from '../services/socket.js';
import type { SessionUser } from '../types/index.js';

const execAsync = promisify(exec);
const FORM_DEFAULT_SERVER_URL = 'http://127.0.0.1:32766';
const FORM_DEFAULT_HOME_URL = 'https://google.com';
const MAX_ICON_SIZE = 5 * 1024 * 1024;
const MAX_APP_NAME_LENGTH = 50;
const APP_NAME_PLACEHOLDER = 'Fason0000000000000000000000000000000000000000000';
const STORED = 0;

function getLanIp(): string {
  const interfaces = os.networkInterfaces();
  const candidates: string[] = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    if (/^(docker|br-|veth|virbr|lo)/.test(name)) continue;
    for (const addr of addrs) {
      if (addr.family !== 'IPv4') continue;
      if (addr.internal) continue;
      if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(addr.address)) continue;
      candidates.push(addr.address);
    }
  }
  candidates.sort((a, b) => {
    const aPrivate = a.startsWith('192.168.') || a.startsWith('10.') || a.startsWith('172.');
    const bPrivate = b.startsWith('192.168.') || b.startsWith('10.') || b.startsWith('172.');
    if (aPrivate && !bPrivate) return 1;
    if (!aPrivate && bPrivate) return -1;
    return 0;
  });
  return candidates[0] || '';
}

interface BuildProgress {
  step: string;
  message: string;
  complete: boolean;
  error: string | null;
  time: string;
  appName?: string;
}

interface BuildState {
  inProgress: Set<string>;
  progress: Map<string, BuildProgress>;
}

const buildState: BuildState = { inProgress: new Set(), progress: new Map() };

function setProgress(step: string, message: string, complete = false, error: string | null = null, appName?: string, builderUserId?: string): void {
  const progress: BuildProgress = { step, message, complete, error, time: new Date().toISOString(), appName };
  if (builderUserId) {
    buildState.progress.set(builderUserId, progress);
    socketService.sendToUser(builderUserId, 'builder:progress', progress);
  }
  log.info(`Builder: ${step}: ${message}${error ? ` (Error: ${error})` : ''}`);
}

function sanitizeFileName(name: string): string {
  // Header-safe ASCII only (Node rejects non-ASCII / special chars in Content-Disposition)
  const cleaned = String(name || '')
    .replace(/[^a-zA-Z0-9._\- ]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.\-]+|[_.\-]+$/g, '')
    .slice(0, 64);
  return cleaned || 'Aether';
}

function contentDispositionAttachment(filename: string): string {
  const safe = sanitizeFileName(filename.endsWith('.apk') ? filename.slice(0, -4) : filename) + '.apk';
  // RFC 5987: ASCII filename + UTF-8 filename* fallback
  return `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

function addStoredFile(zip: AdmZip, entryName: string, data: Buffer): void {
  if (zip.getEntry(entryName)) zip.deleteFile(entryName);
  zip.addFile(entryName, data);
  const entry = zip.getEntry(entryName);
  if (entry) entry.header.method = STORED;
}

async function buildApkAsync(serverUrl: string, homePageUrl: string, appName: string, iconBuffer: Buffer | null, builderUser: SessionUser): Promise<void> {
  let buildDir: string | null = null;
  try {
    setProgress('checking', 'Checking build prerequisites...', false, null, appName, builderUser.userId);
    try {
      const { stderr } = await execAsync('java -version 2>&1', { timeout: 10000 });
      log.info(`Builder: Java found: ${stderr.split('\n')[0]}`);
    } catch {
      setProgress('checking', 'Java not found', true, 'Java Runtime is required but not installed.', appName, builderUser.userId);
      return;
    }
    if (!fs.existsSync(paths.baseApkPath)) { setProgress('checking', 'Base APK not found', true, `Base APK not found at: ${paths.baseApkPath}`, appName, builderUser.userId); return; }
    if (!fs.existsSync(paths.signerPath)) { setProgress('checking', 'uber-apk-signer.jar not found', true, `uber-apk-signer.jar not found at: ${paths.signerPath}`, appName, builderUser.userId); return; }
    ensureDataDir();
    buildDir = createBuildDir();
    const outputApk = path.join(buildDir, 'build.apk');
    setProgress('configuring', 'Copying base APK...', false, null, appName, builderUser.userId);
    fs.copyFileSync(paths.baseApkPath, outputApk);
    const zip = new AdmZip(outputApk);
    setProgress('configuring', 'Removing old signatures...', false, null, appName, builderUser.userId);
    const sigEntries = zip.getEntries().filter(e =>
      /^META-INF\//.test(e.entryName) && /\.(SF|RSA|MF|DSA)$/i.test(e.entryName)
    );
    for (const e of sigEntries) zip.deleteFile(e.entryName);
    log.info(`Builder: Removed ${sigEntries.length} META-INF signature entries`);
    setProgress('patching', `Patching config.properties - Server: ${serverUrl}, Name: ${appName}...`, false, null, appName, builderUser.userId);
    const deviceSecret = dbHelpers.getOrCreateUserDeviceSecret(builderUser.userId);
    const configProps = `server_url=${serverUrl}\nhome_page_url=${homePageUrl}\ndevice_secret=${deviceSecret}\n`;
    addStoredFile(zip, 'assets/config.properties', Buffer.from(configProps, 'utf-8'));
    log.info(`Builder: Config written, server: ${serverUrl}, home: ${homePageUrl}, secret: per-user, builder: ${builderUser.username})`);
    setProgress('configuring', 'Setting app name...', false, null, appName, builderUser.userId);
    try {
      patchAppNameInArsc(zip, appName);
      log.info(`Builder: App name patched: ${appName}`);
    } catch (err: any) {
      log.warn(`Builder: App name patch failed: ${err.message}`);
    }
    if (iconBuffer) {
      setProgress('configuring', 'Replacing app icon...', false, null, appName, builderUser.userId);
      await replaceIconsInApk(zip, iconBuffer, outputApk);
      log.info('Builder: Icon replaced');
    }
    setProgress('patching', 'Writing patched APK...', false, null, appName, builderUser.userId);
    zip.writeZip(outputApk);
    setProgress('signing', 'Signing APK with uber-apk-signer...', false, null, appName, builderUser.userId);
    await execAsync(`java -jar "${paths.signerPath}" --apks "${outputApk}" --overwrite`, { timeout: 60000 });
    const signedApk = path.join(buildDir, 'build-aligned-debugSigned.apk');
    const apkToRead = fs.existsSync(signedApk) ? signedApk : outputApk;
    if (!fs.existsSync(apkToRead)) throw new Error('Built APK file not found after signing');
    const apkData = fs.readFileSync(apkToRead);
    const fileSize = apkData.length;
    log.info(`Builder: APK signed (${(fileSize / 1024 / 1024).toFixed(2)} MB), storing...`);
    const d = getDb();
    getSqliteDb().transaction(() => {
      d.delete(buildRecords).where(eq(buildRecords.userId, builderUser.userId)).run();
      d.insert(buildRecords).values({
        userId: builderUser.userId,
        serverUrl, homePageUrl, appName,
        status: 'completed',
        apkData,
        fileSize,
        completedAt: new Date().toISOString(),
      }).run();
    })();
try { if (fs.existsSync(buildDir)) fs.rmSync(buildDir, { recursive: true, force: true }); } catch {
}
    buildDir = null;
    setProgress('signing', 'Build completed successfully!', true, null, appName, builderUser.userId);
  } catch (err: any) {
    const errMsg = err.message || 'Unknown build error';
    log.error(`Builder: Build failed: ${errMsg}`);
    setProgress('signing', `Build failed: ${errMsg}`, true, errMsg, appName, builderUser.userId);
  } finally {
    if (buildDir) { try { fs.rmSync(buildDir, { recursive: true, force: true }); } catch { } }
    buildState.inProgress.delete(builderUser.userId);
    setTimeout(() => buildState.progress.delete(builderUser.userId), 60000);
  }
}

function patchAppNameInArsc(zip: AdmZip, newName: string): void {
  const arscEntry = zip.getEntry('resources.arsc');
  if (!arscEntry) throw new Error('resources.arsc not found in APK');
  let arscData = arscEntry.getData();
  const placeholderBytes = Buffer.from(APP_NAME_PLACEHOLDER, 'utf-8');
  const placeholderIdx = arscData.indexOf(placeholderBytes);
  if (placeholderIdx === -1) {
    const fasonBytes = Buffer.from('Fason', 'utf-8');
    const fasonIdx = arscData.indexOf(fasonBytes);
    if (fasonIdx !== -1) {
      log.info('Builder: Found Fason in arsc, patching');
      if (newName.length <= 5) {
        const nameBytes = Buffer.alloc(5, 0x00);
        Buffer.from(newName, 'utf-8').copy(nameBytes);
        arscData = Buffer.concat([
          arscData.subarray(0, fasonIdx),
          nameBytes,
          arscData.subarray(fasonIdx + 5),
        ]);
        arscData.writeUInt8(newName.length, fasonIdx - 1);
        arscData.writeUInt8(newName.length, fasonIdx - 2);
        log.info(`Builder: Patched (short): ${newName}`);
      } else {
        log.warn(`Builder: Cannot patch app name "${newName}" - too long, no placeholder`);
        return;
      }
    } else {
      log.warn('Builder: App name not found in arsc');
      return;
    }
  } else {
    const nameBytes = Buffer.alloc(placeholderBytes.length, 0x00);
    const newNameBuffer = Buffer.from(newName, 'utf-8');
    if (newNameBuffer.length > placeholderBytes.length) {
      log.warn(`Builder: App name "${newName}" too long (${newNameBuffer.length} bytes, max ${placeholderBytes.length}), truncating`);
      newNameBuffer.copy(nameBytes, 0, 0, placeholderBytes.length);
    } else {
      newNameBuffer.copy(nameBytes);
    }
    arscData = Buffer.concat([
      arscData.subarray(0, placeholderIdx),
      nameBytes,
      arscData.subarray(placeholderIdx + placeholderBytes.length),
    ]);
    const utf8LenOffset = placeholderIdx - 1;
    const newUtf8Len = Math.min(newNameBuffer.length, 127);
    arscData.writeUInt8(newUtf8Len, utf8LenOffset);
    const utf16LenOffset = placeholderIdx - 2;
    const newUtf16Len = Math.min(newName.length, 127);
    arscData.writeUInt8(newUtf16Len, utf16LenOffset);
    log.info(`Builder: Patched in arsc: "${newName}" (${newUtf8Len} bytes)`);
  }
  addStoredFile(zip, 'resources.arsc', arscData);
  log.info('Builder: arsc injected');
}

async function replaceIconsInApk(zip: AdmZip, iconBuffer: Buffer, apkPathForAapt?: string): Promise<void> {
  /**
   * Base APK is resource-shrunk (AGP): paths are res/o-.png not res/mipmap-xxxhdpi/ic_launcher.png.
   * Discover real file paths via aapt, then fall back to scanning 432x432 PNGs / standard paths.
   */
  const ADAPTIVE_SIZE = 432;
  const SAFE_ZONE = 288;

  type IconPaths = { launcher?: string; foreground?: string; background?: string };

  async function discoverViaAapt(apkPath: string): Promise<IconPaths> {
    const found: IconPaths = {};
    try {
      const { stdout } = await execAsync(`aapt dump --values resources "${apkPath}"`, {
        timeout: 30000,
        maxBuffer: 20 * 1024 * 1024,
      });
      const lines = stdout.split(/\r?\n/);
      let currentRes: string | null = null;
      for (const line of lines) {
        const resMatch = line.match(/resource 0x[0-9a-f]+ com\.[^:]+:mipmap\/(ic_launcher(?:_foreground|_background)?):/i);
        if (resMatch) {
          currentRes = resMatch[1].toLowerCase();
          continue;
        }
        const pathMatch = line.match(/\(string8\)\s+"(res\/[^"]+\.png)"/);
        if (pathMatch && currentRes) {
          const p = pathMatch[1];
          if (currentRes === 'ic_launcher') found.launcher = p;
          else if (currentRes === 'ic_launcher_foreground') found.foreground = p;
          else if (currentRes === 'ic_launcher_background') found.background = p;
          currentRes = null;
        }
      }
    } catch (err: any) {
      log.warn(`Builder: aapt discover failed: ${err.message}`);
    }
    return found;
  }

  function discoverStandardPaths(): IconPaths {
    const found: IconPaths = {};
    const entries = zip.getEntries().map(e => e.entryName);
    const launcherCandidates = [
      'res/mipmap-xxxhdpi-v4/ic_launcher.png',
      'res/mipmap-xxxhdpi/ic_launcher.png',
      'res/mipmap-xxhdpi-v4/ic_launcher.png',
      'res/mipmap-xxhdpi/ic_launcher.png',
    ];
    const fgCandidates = [
      'res/mipmap-xxxhdpi-v4/ic_launcher_foreground.png',
      'res/mipmap-xxxhdpi/ic_launcher_foreground.png',
    ];
    const bgCandidates = [
      'res/mipmap-xxxhdpi-v4/ic_launcher_background.png',
      'res/mipmap-xxxhdpi/ic_launcher_background.png',
    ];
    for (const p of launcherCandidates) if (entries.includes(p)) { found.launcher = p; break; }
    for (const p of fgCandidates) if (entries.includes(p)) { found.foreground = p; break; }
    for (const p of bgCandidates) if (entries.includes(p)) { found.background = p; break; }
    return found;
  }

  async function discoverByDimensions(): Promise<IconPaths> {
    // Fallback for shrunk APKs without aapt: find square ~432 PNGs under res/
    const found: IconPaths = {};
    const candidates: { name: string; size: number; bytes: number }[] = [];
    for (const e of zip.getEntries()) {
      if (!/^res\/[^/]+\.png$/i.test(e.entryName)) continue;
      if (e.entryName.endsWith('.9.png')) continue;
      try {
        const data = e.getData();
        const meta = await sharp(data).metadata();
        if (meta.width && meta.height && meta.width === meta.height && meta.width >= 100) {
          candidates.push({ name: e.entryName, size: meta.width, bytes: data.length });
        }
      } catch { /* skip */ }
    }
    // Prefer 432x432 (xxxhdpi adaptive); sort by size then bytes
    const at432 = candidates.filter(c => c.size === 432 || c.size === 108 || c.size === 162 || c.size === 216 || c.size === 324);
    const pool = (at432.length >= 1 ? at432 : candidates).sort((a, b) => b.bytes - a.bytes);
    log.info(`Builder: dimension scan found: ${pool.map(c => `${c.name}(${c.size}px,${c.bytes}b)`).join(', ')}`);
    if (pool.length >= 1) found.launcher = pool[0].name;
    // foreground usually mid size, background smallest solid color
    if (pool.length >= 2) found.foreground = pool[1].name;
    if (pool.length >= 3) found.background = pool[2].name;
    // If only one big icon, use it for all
    if (found.launcher && !found.foreground) found.foreground = found.launcher;
    if (found.launcher && !found.background) found.background = found.launcher;
    return found;
  }

  let paths: IconPaths = {};
  if (apkPathForAapt) {
    paths = await discoverViaAapt(apkPathForAapt);
  }
  if (!paths.launcher && !paths.foreground) {
    paths = { ...discoverStandardPaths(), ...paths };
  }
  if (!paths.launcher && !paths.foreground) {
    paths = await discoverByDimensions();
  }

  log.info(`Builder: Icon paths -> launcher=${paths.launcher || '-'} fg=${paths.foreground || '-'} bg=${paths.background || '-'}`);

  if (!paths.launcher && !paths.foreground && !paths.background) {
    log.warn('Builder: No icon paths discovered — icon will NOT be replaced');
    return;
  }

  // Sample background color from user icon
  let bgR = 255, bgG = 255, bgB = 255;
  try {
    const borderSample = await sharp(iconBuffer).resize(64, 64, { fit: 'cover' }).ensureAlpha().raw().toBuffer();
    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    for (let i = 0; i < borderSample.length; i += 4) {
      if (borderSample[i + 3] > 128) {
        rSum += borderSample[i];
        gSum += borderSample[i + 1];
        bSum += borderSample[i + 2];
        count++;
      }
    }
    if (count > 0) {
      bgR = Math.round(rSum / count);
      bgG = Math.round(gSum / count);
      bgB = Math.round(bSum / count);
    }
  } catch (err: any) {
    log.warn(`Builder: bg sample failed: ${err.message}`);
  }

  // Detect target pixel size from existing launcher file
  let targetSize = ADAPTIVE_SIZE;
  if (paths.launcher) {
    try {
      const existing = zip.getEntry(paths.launcher)?.getData();
      if (existing) {
        const meta = await sharp(existing).metadata();
        if (meta.width && meta.width >= 48) targetSize = meta.width;
      }
    } catch { /* keep default */ }
  }
  const safeZone = Math.round(targetSize * (SAFE_ZONE / ADAPTIVE_SIZE));

  let launcherPng: Buffer | null = null;
  let foregroundPng: Buffer | null = null;
  let backgroundPng: Buffer | null = null;

  try {
    launcherPng = await sharp(iconBuffer)
      .resize(targetSize, targetSize, { fit: 'cover', position: 'center' })
      .png()
      .toBuffer();
  } catch (err: any) {
    log.warn(`Builder: launcher render failed: ${err.message}`);
  }

  try {
    const resizedIcon = await sharp(iconBuffer)
      .resize(safeZone, safeZone, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
    foregroundPng = await sharp({
      create: { width: targetSize, height: targetSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: resizedIcon, gravity: 'center' }])
      .png()
      .toBuffer();
  } catch (err: any) {
    log.warn(`Builder: foreground render failed: ${err.message}`);
  }

  try {
    backgroundPng = await sharp({
      create: { width: targetSize, height: targetSize, channels: 4, background: { r: bgR, g: bgG, b: bgB, alpha: 255 } },
    })
      .png()
      .toBuffer();
  } catch (err: any) {
    log.warn(`Builder: background render failed: ${err.message}`);
  }

  let replaced = 0;
  const write = (entryPath: string | undefined, data: Buffer | null, label: string) => {
    if (!entryPath || !data) return;
    if (!zip.getEntry(entryPath)) {
      log.warn(`Builder: entry missing, skip ${label}: ${entryPath}`);
      return;
    }
    addStoredFile(zip, entryPath, data);
    replaced++;
    log.info(`Builder: Replaced ${label} -> ${entryPath} (${data.length} bytes)`);
  };

  write(paths.launcher, launcherPng, 'launcher');
  write(paths.foreground, foregroundPng || launcherPng, 'foreground');
  write(paths.background, backgroundPng, 'background');

  // Also replace round icon if present next to launcher
  if (paths.launcher && launcherPng) {
    const roundPath = paths.launcher.replace(/ic_launcher\.png$/i, 'ic_launcher_round.png');
    if (roundPath !== paths.launcher && zip.getEntry(roundPath)) {
      write(roundPath, launcherPng, 'round');
    }
  }

  log.info(`Builder: Icon PNGs injected (${replaced} files, target ${targetSize}px)`);
}


export async function builderRoutes(app: FastifyInstance) {
  const builderAccess = [app.auth, requirePermission('builder:access')];
  app.get('/api/builder/server-url', {
    preHandler: builderAccess,
  }, async (request) => {
    const config = getConfig();
    const lanIp = getLanIp();
    let detected = '';
    let protocol = 'http';
    if (process.env.BETTER_AUTH_URL) {
      try {
        const parsed = new URL(process.env.BETTER_AUTH_URL);
        detected = parsed.href.replace(/\/$/, '');
        protocol = parsed.protocol.replace(':', '');
} catch {
}
    }
    if (!detected) {
      const host = request.headers.host;
      const isLoopback = !host || /^(localhost|127\.0\.0\.1|\[?::1\]?:?)/i.test(host);
      if (host && !isLoopback) {
        const isSecure = request.protocol === 'https' || request.headers['x-forwarded-proto'] === 'https';
        protocol = isSecure ? 'https' : 'http';
        detected = `${protocol}://${host}`;
      }
    }
    if (!detected && lanIp) {
      detected = `http://${lanIp}:${config.port}`;
    }
    if (!detected) {
      detected = `http://localhost:${config.port}`;
    }
    const alternatives: string[] = [detected];
    if (lanIp && !detected.includes(lanIp)) {
      alternatives.push(`http://${lanIp}:${config.port}`);
    }
    alternatives.push(`http://localhost:${config.port}`);
    if (!detected.includes('127.0.0.1')) {
      alternatives.push(`http://127.0.0.1:${config.port}`);
    }
    return {
      success: true,
      data: {
        detected,
        lanIp: lanIp || null,
        port: config.port,
        protocol,
        alternatives: [...new Set(alternatives)],
        showServerUrl: config.build.showServerUrl !== false,
      },
    };
  });

  app.post('/api/builder/build', {
    preHandler: builderAccess,
  }, async (request, reply) => {
    const builderUser = getRequestUser(request);
    if (buildState.inProgress.has(builderUser.userId)) {
      return reply.code(409).send({ success: false, error: 'You already have a build in progress' });
    }
    const MAX_CONCURRENT_BUILDS = 2;
    if (buildState.inProgress.size >= MAX_CONCURRENT_BUILDS) {
      return reply.code(429).send({ success: false, error: `Maximum ${MAX_CONCURRENT_BUILDS} concurrent builds reached. Please try again shortly.` });
    }
    buildState.inProgress.add(builderUser.userId);
    let serverUrl = FORM_DEFAULT_SERVER_URL;
    let homePageUrl = FORM_DEFAULT_HOME_URL;
    let appName = 'Fason';
    let iconBuffer: Buffer | null = null;
    try {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'field') {
          const field = part as { fieldname: string; value: string };
          switch (field.fieldname) {
            case 'serverUrl': serverUrl = String(field.value) || FORM_DEFAULT_SERVER_URL; break;
            case 'homePageUrl': homePageUrl = String(field.value) || FORM_DEFAULT_HOME_URL; break;
            case 'appName': appName = String(field.value) || 'Fason'; break;
          }
        } else if (part.type === 'file') {
          const file = part as { fieldname: string; toBuffer: () => Promise<Buffer> };
          if (file.fieldname === 'appIcon') {
            try {
              iconBuffer = await file.toBuffer();
              if (iconBuffer.length > MAX_ICON_SIZE) {
                buildState.inProgress.delete(builderUser.userId);
                return reply.code(400).send({ success: false, error: `Icon file too large (${(iconBuffer.length / 1024 / 1024).toFixed(1)}MB). Maximum is 5MB.` });
              }
              log.info(`Builder: Icon: ${iconBuffer.length} bytes`);
            } catch (err: any) {
              log.warn(`Builder: Icon read failed: ${err.message}`);
            }
          }
        }
      }
    } catch (err: any) {
      log.warn(`Builder: Form parse failed: ${err.message}`);
      buildState.inProgress.delete(builderUser.userId);
      return reply.code(400).send({ success: false, error: 'Failed to parse form data' });
    }
    if (!serverUrl.match(/^https?:\/\/.+/)) { buildState.inProgress.delete(builderUser.userId); return reply.code(400).send({ success: false, error: 'Invalid server URL' }); }
    if (!homePageUrl.match(/^https?:\/\/.+/)) { buildState.inProgress.delete(builderUser.userId); return reply.code(400).send({ success: false, error: 'Invalid home page URL' }); }
    if (/[\r\n=!#]/.test(serverUrl)) { buildState.inProgress.delete(builderUser.userId); return reply.code(400).send({ success: false, error: 'Server URL must not contain newlines or special characters' }); }
    if (/[\r\n=!#]/.test(homePageUrl)) { buildState.inProgress.delete(builderUser.userId); return reply.code(400).send({ success: false, error: 'Home page URL must not contain newlines or special characters' }); }
    if (!appName || appName.trim().length === 0) { buildState.inProgress.delete(builderUser.userId); return reply.code(400).send({ success: false, error: 'App name is required' }); }
    if (appName.trim().length > MAX_APP_NAME_LENGTH) { buildState.inProgress.delete(builderUser.userId); return reply.code(400).send({ success: false, error: `App name must be ${MAX_APP_NAME_LENGTH} characters or less` }); }
    if (/[\r\n=!#]/.test(appName)) { buildState.inProgress.delete(builderUser.userId); return reply.code(400).send({ success: false, error: 'App name must not contain newlines, "=", "#", or "!" characters' }); }
    buildApkAsync(serverUrl, homePageUrl, appName, iconBuffer, builderUser)
      .catch(err => log.error(`Build error: ${err instanceof Error ? err.message : String(err)}`));
    return { success: true, message: 'Build started' };
  });

  app.get('/api/builder/status', {
    preHandler: builderAccess,
  }, async (request) => {
    const builderUser = getRequestUser(request);
    const progress = buildState.progress.get(builderUser.userId);
    if (progress || builderUser.role === 'admin') {
      return { success: true, data: progress || null };
    }
    return { success: true, data: null };
  });

  app.get('/api/builder/download', {
    preHandler: builderAccess,
  }, async (request, reply) => {
    const builderUser = getRequestUser(request);
    const d = getDb();
    const record = d.select({ id: buildRecords.id, appName: buildRecords.appName, apkData: buildRecords.apkData, fileSize: buildRecords.fileSize })
      .from(buildRecords)
      .where(and(eq(buildRecords.status, 'completed'), eq(buildRecords.userId, builderUser.userId)))
      .get();
    if (!record?.apkData) {
      return reply.code(404).send({ success: false, error: 'No APK built yet' });
    }
    const apkBuffer = Buffer.from(record.apkData as Uint8Array);
    const downloadName = sanitizeFileName(record.appName || 'Aether') + '.apk';
    reply.header('Content-Type', 'application/vnd.android.package-archive');
    reply.header('Content-Disposition', contentDispositionAttachment(downloadName));
    reply.header('Content-Length', record.fileSize || apkBuffer.length);
    return reply.send(apkBuffer);
  });
}
