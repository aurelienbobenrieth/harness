# Listing image fixtures

The two plain 1200×1200 gray images were created for these tests using the Windows System.Drawing PNG and JPEG encoders. They contain no third-party artwork or metadata. Keeping complete encoded files makes the dimension-reader tests independent of the synthetic header builders. Tests read these files on every supported operating system; System.Drawing is not a runtime dependency.
