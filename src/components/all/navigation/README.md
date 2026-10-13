# Navigation components

The current navigation behavior is intentionally preserved inside `src/app/layouts/MainLayout.vue` during the zero-baseline refactor.

Target extraction contract:
- `AppTopbar.vue`: global product modules, global search, theme and account.
- `AppSidebar.vue`: navigation inside the selected product module.
- `PageTopbar.vue`: page/module tabs and contextual navigation.

Extract these only with browser regression coverage so organization work does not change navigation behavior.
