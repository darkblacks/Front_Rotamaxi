# RotaMaxi Frontend Architecture

This folder structure is the new organization baseline. The refactor is intentionally structural: routes, API contracts, business behavior, and UI copy remain unchanged.

## Runtime flow

```text
Page
  -> Feature component
    -> Store / domain helper
      -> API service or realtime service
        -> RotaMaxi AWS backend
```

Components should not create ad-hoc Axios or socket clients. HTTP lives under `src/services/api`; realtime communication lives under `src/services/realtime`.

## Navigation layers

The product has three navigation levels:

1. `App Topbar` — global modules and account actions.
2. `App Sidebar` — navigation inside the selected module.
3. `Page Topbar` — tabs/context navigation for the current feature.

Today these behaviors remain hosted by `src/app/layouts/MainLayout.vue` to preserve behavior during the zero-baseline refactor. Future extraction must preserve the same public behavior and move them to `src/components/all/navigation` without redesigning the screen.

## Pages

`src/pages` contains routable screens only.

```text
pages/
  overview/
  operations/
    manifests/
    gate/
    pallets/
    incidents/
    divergences/
    driver-loans/
  registrations/
    people/
    vehicles/
  settings/
  auth/
  dev/
  shared/
```

A Page owns route-level orchestration. Reusable visual blocks belong in Components.

## Components

`src/components/all` is the shared component layer.

```text
components/all/
  ui/
  tables/
  filters/
  media/
  status/
```

Feature components mirror their owning module:

```text
components/
  overview/
  operations/
  registrations/
    vehicles/
      details/
      fipe/
      esl/
```

## Table standard

Shared table behavior must evolve from `components/all/tables/BaseTable.vue` and `TablePagination.vue`.

Registration screens should reuse one consistent table language:
- header,
- toolbar,
- search,
- filters,
- loading state,
- empty state,
- row actions,
- pagination.

Feature tables may change columns and cell renderers, but should not create a new visual table system.

Future dedicated registration table components belong under:

```text
components/registrations/tables/
  RegistrationTable.vue
  people/
  vehicles/
  drivers/
  providers/
  branches/
```

Do not extract a table only to move markup. Extract when the component has a stable, reusable contract.

## Styles

Every Vue Page and Component has a matching external CSS file under `src/styles`, mirroring the source tree.

Examples:

```text
src/pages/registrations/vehicles/FleetPage.vue
src/styles/pages/registrations/vehicles/fleet_page.css

src/components/registrations/vehicles/details/VehicleValuation.vue
src/styles/components/registrations/vehicles/details/vehicle_valuation.css
```

Global palette tokens live only in:

```text
src/styles/css_color_variables.css
```

Typography tokens live in:

```text
src/styles/css_typography_variables.css
```

Global resets and framework imports live in:

```text
src/styles/global.css
```

Component/page CSS should prefer global variables such as `var(--panel)`, `var(--ink)`, `var(--line)`, and `var(--accent)` instead of duplicating palette literals.

## Domain

Business helpers are grouped by business domain:

```text
domain/
  branches/
  company/
  drivers/
  people/
  registrations/
  vehicles/
    brands/
    esl/
    fipe/
```

UI components should not become the source of truth for business semantics such as ownership, vehicle classification, or FIPE matching.

## Services

```text
services/
  api/
  realtime/
```

`api/http.js` is the canonical HTTP client configuration.
No Page or Component should instantiate a second Axios client.

## Stores

Pinia stores live under `src/stores` and use the `.store.js` suffix.

## Assets

Static source assets live under `src/assets`.
Generated build output is not source code and is excluded from Git.

## Tests

Tests are organized by intent:

```text
tests/
  unit/
  integration/
```

The reorganization preserved the original test code and its existing baseline. Browser/E2E tests should be added separately rather than treating unit tests as proof that a user interaction works.

## Deleted from the clean baseline

The clean package intentionally excludes:
- `node_modules`;
- `dist`;
- `.env*`;
- old delivery/patch packages under `docs/entregas`;
- backup/archive artifacts.

Dependencies are restored with `npm install`.
