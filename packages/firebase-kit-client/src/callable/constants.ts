/**
 * Largest request body, in bytes, the keepalive caller sends. The Fetch
 * standard caps the keepalive budget at 64 KiB per page, shared by every
 * keepalive request still in flight. A body over this limit is reported to
 * `onError` and not sent.
 */
export const KeepaliveBodyLimitBytes = 65_536
