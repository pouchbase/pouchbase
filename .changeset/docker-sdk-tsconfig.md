---
'pouchbase': patch
---

Fix the Docker image build, which failed because the JS SDK's tsconfig was left out of the build context.
