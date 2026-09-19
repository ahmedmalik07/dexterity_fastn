# Windows launch status

The current build is **blocked on the development PC**. It is not ready for a live EXE demonstration there.

## Confirmed cause

On 12 September 2026, Windows Code Integrity event 3033 reported that `release-v1.7/win-unpacked/Dexterity.exe` did not meet the **Enterprise signing level requirements**. Authenticode inspection reports `NotSigned`. No code-signing certificate was available in the current-user or local-machine personal certificate stores.

Automatic approval review also rejected starting `Start Dexterity.cmd` with `blocked by policy`. The updated app was not started by another route. Security settings were not changed.

## Build correction included

The packaging configuration previously explicitly disabled executable signing. It now allows signing, and `npm run dist:signed` enables `forceCodeSigning` so a release cannot silently fall back to an unsigned EXE. The ordinary development build can still be unsigned if no certificate is configured; it does not resolve this PC's block.

An authorized release maintainer must supply a trusted code-signing identity supported by electron-builder (for example, `CSC_LINK` and `CSC_KEY_PASSWORD` supplied privately by the build environment). Never commit a certificate, its password, or provider keys. Then run:

```powershell
npm run dist:signed
Get-AuthenticodeSignature -LiteralPath release-v1.7/win-unpacked/Dexterity.exe
```

Signing alone does not guarantee acceptance by an Enterprise policy: the identity must also be allowed by that policy. An authorized administrator may need to approve the publisher/build. A self-signed certificate is not evidence of that approval. Re-test the launch, native helper, microphone and four tasks on the presentation machine after approval.

## Demo readiness

The source integration checks passed existing-browser navigation/session preservation, accessible form fields, and highlighted-text output. The live provider rehearsal passed three tasks; the revised form approval handoff still needs a live re-test. See [the full demo guide](../DEMO.md). README images are renderer previews with sample data, not a recording of a working signed release.
