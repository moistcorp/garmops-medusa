# Private file security

1. The authenticated customer requests a presigned PUT for one declared file kind, MIME type, size, and target. The object key is generated server-side and includes a random file ID.
2. Finalization verifies the R2 object metadata, exact byte length, and optional SHA-256. The record enters `uploaded` + `scan_pending`.
3. Medusa streams the private R2 object to the separate ClamAV service over `INSTREAM`; it never stores customer artwork permanently on local disk.
4. Only `clean` files become `finalized`. Scanner timeout, R2 failure, malformed response, and exhausted retries remain unusable (`pending`/`failed`). `infected` files are rejected/quarantined and cannot be approved or downloaded.
5. Founder/Operations artwork approval is accepted only for `clean` + `finalized` files. Customer and Foundry downloads require ownership or staff permission and issue a five-minute signed R2 URL only after the clean gate.

`garmops-malware-scan-recovery` retries pending uploaded files once per minute with a maximum of three attempts. ClamAV is a separate Compose service; R2 remains the source of truth for object bytes.
