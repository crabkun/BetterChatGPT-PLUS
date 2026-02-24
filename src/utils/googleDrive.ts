/**
 * Google Drive sync utility.
 *
 * Uses Google Identity Services (GIS) for OAuth2 token-based auth
 * and the Google Drive REST API v3.  All files are stored inside the
 * hidden "appDataFolder" so the app never touches the user's regular
 * Drive files.
 */

const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const SYNC_FILENAME = 'betterchatgpt-sync.json.gz';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL =
    'https://www.googleapis.com/upload/drive/v3/files';

/* ------------------------------------------------------------------ */
/*  Google Identity Services loader                                    */
/* ------------------------------------------------------------------ */

let gisLoaded = false;

/**
 * Dynamically inject the GIS `<script>` tag and wait until the global
 * `google.accounts` object is ready.
 */
export const loadGisClient = (): Promise<void> => {
    if (gisLoaded && window.google?.accounts) return Promise.resolve();

    return new Promise((resolve, reject) => {
        // Avoid double-loading
        if (document.getElementById('gis-script')) {
            const check = setInterval(() => {
                if (window.google?.accounts) {
                    gisLoaded = true;
                    clearInterval(check);
                    resolve();
                }
            }, 100);
            return;
        }

        const script = document.createElement('script');
        script.id = 'gis-script';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            const check = setInterval(() => {
                if (window.google?.accounts) {
                    gisLoaded = true;
                    clearInterval(check);
                    resolve();
                }
            }, 100);
        };
        script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
        document.head.appendChild(script);
    });
};

/* ------------------------------------------------------------------ */
/*  OAuth2 access-token retrieval (with in-memory cache)               */
/* ------------------------------------------------------------------ */

let cachedToken: string | null = null;
let tokenExpiresAt = 0; // Unix ms

/**
 * Show the Google consent popup and return an access token.
 * Reuses a cached token if it has not expired yet.
 * @param clientId — the user-provided OAuth 2.0 Web Client ID
 */
export const requestAccessToken = (clientId: string): Promise<string> => {
    if (!clientId) {
        return Promise.reject(
            new Error('Google Client ID is not configured.')
        );
    }

    // Return cached token if still valid (with 60 s safety margin)
    if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
        return Promise.resolve(cachedToken);
    }

    return new Promise((resolve, reject) => {
        const client = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: SCOPES,
            callback: (response: any) => {
                if (response.error) {
                    reject(new Error(response.error));
                    return;
                }
                // Cache the token; expires_in is in seconds (typically 3600)
                cachedToken = response.access_token as string;
                const expiresIn = (response.expires_in ?? 3600) as number;
                tokenExpiresAt = Date.now() + expiresIn * 1000;
                resolve(cachedToken);
            },
            error_callback: (error: any) => {
                reject(new Error(error?.message || 'OAuth error'));
            },
        });
        client.requestAccessToken();
    });
};

/* ------------------------------------------------------------------ */
/*  Gzip compression helpers (browser-native)                          */
/* ------------------------------------------------------------------ */

/**
 * Compress a string into a gzip Uint8Array using the browser-native
 * CompressionStream API.
 */
const gzipCompress = async (input: string): Promise<ArrayBuffer> => {
    const blob = new Blob([input]);
    const cs = new CompressionStream('gzip');
    const stream = blob.stream().pipeThrough(cs);
    return new Response(stream).arrayBuffer();
};

/**
 * Decompress a gzip ArrayBuffer back to a string using the browser-native
 * DecompressionStream API.
 */
const gzipDecompress = async (input: ArrayBuffer): Promise<string> => {
    const blob = new Blob([input]);
    const ds = new DecompressionStream('gzip');
    const stream = blob.stream().pipeThrough(ds);
    return new Response(stream).text();
};

/* ------------------------------------------------------------------ */
/*  Drive helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Search for the sync file in appDataFolder and return its file id,
 * or `null` if it does not exist yet.
 */
const findSyncFile = async (token: string): Promise<string | null> => {
    const params = new URLSearchParams({
        spaces: 'appDataFolder',
        q: `name='${SYNC_FILENAME}' and trashed=false`,
        fields: 'files(id)',
        pageSize: '1',
    });

    const res = await fetch(`${DRIVE_FILES_URL}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);

    const body = await res.json();
    return body.files?.[0]?.id ?? null;
};

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Upload (create or update) the sync data to Google Drive.
 * The JSON is gzip-compressed before uploading.
 * @param clientId — user-provided Google OAuth Client ID
 * @param data — the JSON data to upload
 */
export const uploadToGoogleDrive = async (
    clientId: string,
    data: object
): Promise<void> => {
    await loadGisClient();
    const token = await requestAccessToken(clientId);

    const existingId = await findSyncFile(token);
    const compressed = await gzipCompress(JSON.stringify(data));

    if (existingId) {
        // PATCH – update existing file content
        const res = await fetch(
            `${DRIVE_UPLOAD_URL}/${existingId}?uploadType=media`,
            {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/gzip',
                },
                body: compressed,
            }
        );
        if (!res.ok) throw new Error(`Drive update failed: ${res.status}`);
    } else {
        // Multipart create – metadata + binary content
        const metadata = {
            name: SYNC_FILENAME,
            parents: ['appDataFolder'],
        };

        const metadataPart = JSON.stringify(metadata);
        const boundary = '----betterchatgpt_boundary';

        // Build multipart body with binary gzip content
        const encoder = new TextEncoder();
        const header =
            `--${boundary}\r\n` +
            `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
            `${metadataPart}\r\n` +
            `--${boundary}\r\n` +
            `Content-Type: application/gzip\r\n\r\n`;
        const footer = `\r\n--${boundary}--`;

        const headerBytes = encoder.encode(header);
        const footerBytes = encoder.encode(footer);
        const compressedBytes = new Uint8Array(compressed);

        const body = new Uint8Array(
            headerBytes.length + compressedBytes.length + footerBytes.length
        );
        body.set(headerBytes, 0);
        body.set(compressedBytes, headerBytes.length);
        body.set(footerBytes, headerBytes.length + compressedBytes.length);

        const res = await fetch(
            `${DRIVE_UPLOAD_URL}?uploadType=multipart`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': `multipart/related; boundary=${boundary}`,
                },
                body: body.buffer as ArrayBuffer,
            }
        );
        if (!res.ok) throw new Error(`Drive create failed: ${res.status}`);
    }
};

/**
 * Download the sync data from Google Drive and decompress it.
 * Returns `null` when no sync file exists yet.
 * @param clientId — user-provided Google OAuth Client ID
 */
export const downloadFromGoogleDrive = async (
    clientId: string
): Promise<object | null> => {
    await loadGisClient();
    const token = await requestAccessToken(clientId);

    const fileId = await findSyncFile(token);
    if (!fileId) return null;

    const res = await fetch(`${DRIVE_FILES_URL}/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);

    const buf = await res.arrayBuffer();
    const jsonStr = await gzipDecompress(buf);
    return JSON.parse(jsonStr);
};

/* ------------------------------------------------------------------ */
/*  TypeScript ambient declarations for GIS                            */
/* ------------------------------------------------------------------ */

declare global {
    interface Window {
        google: {
            accounts: {
                oauth2: {
                    initTokenClient: (config: any) => { requestAccessToken: () => void };
                };
            };
        };
    }
}
