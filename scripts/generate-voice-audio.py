"""Generate bundled voice-guide MP3s (Hindi + Tamil) for each app section using
gTTS (free Google TTS, correct pronunciation). Reads scripts/voice-manifest.json.
Skips 'home' so the premium hand-picked Home recordings are preserved.

Run:  python scripts/generate-voice-audio.py
"""
import json
import os
import sys
import time

from gtts import gTTS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "scripts", "voice-manifest.json")
AUDIO_ROOT = os.path.join(ROOT, "public", "audio", "assistant")
SKIP_PAGES = {"home"}  # keep the existing premium Home recordings


def main():
    with open(MANIFEST, encoding="utf-8") as handle:
        manifest = json.load(handle)

    made, skipped, failed = 0, 0, 0
    for item in manifest:
        lang, page, text = item["lang"], item["page"], item["text"]
        if page in SKIP_PAGES:
            skipped += 1
            continue

        target_dir = os.path.join(AUDIO_ROOT, lang)
        os.makedirs(target_dir, exist_ok=True)
        out = os.path.join(target_dir, f"{page}.mp3")

        for attempt in (1, 2, 3):
            try:
                gTTS(text=text, lang=lang).save(out)
                print(f"  {lang}/{page}.mp3  ({os.path.getsize(out)} bytes)")
                made += 1
                break
            except Exception as error:  # noqa: BLE001 - report and retry
                if attempt == 3:
                    print(f"  FAILED {lang}/{page}: {error}")
                    failed += 1
                else:
                    time.sleep(2 * attempt)
        time.sleep(0.6)  # be gentle with the free endpoint

    print(f"\ngenerated={made} skipped={skipped} failed={failed}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
