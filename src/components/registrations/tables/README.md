# Registration table components

Registration tables must converge on the shared table foundation in `src/components/all/tables`.

Feature-specific table components belong here when extracted:
- `RegistrationTable.vue`
- `people/PeopleTable.vue`
- `vehicles/VehiclesTable.vue`
- `drivers/DriversTable.vue`
- `providers/ProvidersTable.vue`
- `branches/BranchesTable.vue`

Do not duplicate table chrome, pagination, loading, empty state, or action patterns.
