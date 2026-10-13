# Frontend zero-baseline refactor

Structural changes only.

- Moved runtime source from `resources/js` to `src`.
- Grouped Pages by product module and child feature.
- Grouped Components into shared and feature-specific trees.
- Moved HTTP and realtime integrations into separate service folders.
- Grouped pure business helpers under `domain`.
- Renamed source files/folders to English while preserving Portuguese UI copy and runtime behavior.
- Extracted every Vue `<style scoped>` block into a matching external CSS file.
- Split global palette variables into `css_color_variables.css`.
- Added a clean `.gitignore`.
- Removed generated dependencies/builds/secrets/old delivery patches from the distributable package.
- Existing unit-test baseline remains 102 passing / 2 pre-existing failing tests in this snapshot:
  1. `people/model.test.js` expects `PESSOAS_SESSAO_KEY`, which the source snapshot does not export.
  2. ESL tolerant simulation expects an external CSV file not included in the frontend package.

The Linux sandbox cannot run the Windows-native Rolldown/Vite binding embedded in the uploaded `node_modules`. Vue SFC parsing and internal import resolution were validated after the move. Run `npm install` and `npm run build` on the Windows project after replacing the folder.
