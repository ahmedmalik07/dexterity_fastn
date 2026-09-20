"""Join the rendered cover and body into the final documentation PDF.

The two halves are printed separately so the cover carries no page number, which is
the one thing Chrome's print footer cannot be told to skip.

    node scripts/make-pdf.cjs && python scripts/merge-pdf.py
"""

import os
import sys

from pypdf import PdfWriter, PdfReader

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))

COVER = os.path.join(ROOT, ".cover.pdf")
BODY = os.path.join(ROOT, ".body.pdf")
OUT = os.path.join(ROOT, "HireLoop-documentation.pdf")


def main():
    for part in (COVER, BODY):
        if not os.path.exists(part):
            print(f"missing {os.path.basename(part)} - run scripts/make-pdf.cjs first")
            return 1

    writer = PdfWriter()
    for part in (COVER, BODY):
        for page in PdfReader(part).pages:
            writer.add_page(page)

    writer.add_metadata(
        {
            "/Title": "HireLoop - post once, hire anywhere",
            "/Author": "Team vibe - Madni Munnay, Ahmed Malik, Maimoona Islam",
            "/Subject": "Build with Fastn hackathon - Track 04, Cross-Platform Publisher",
        }
    )

    with open(OUT, "wb") as handle:
        writer.write(handle)

    for part in (COVER, BODY):
        os.remove(part)

    size = os.path.getsize(OUT) / 1048576
    print(f"written {os.path.basename(OUT)} ({len(writer.pages)} pages, {size:.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
