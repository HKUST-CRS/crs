# service

## Package Structure

```
service/
├── models
├── db
├── repos
├── lib
├── templates
└── __tests__
```

- `models` contains the data models of the application, such as user, course and requests.
- `db` defines database connection utilities.
- `repos` interacts with the database directly. Database queries and main logic are defined here. It is supposed to be used by `lib`.
- `lib` contains all services that the `server` package needs. Permissions are checked at this layer.
- `templates` contains email templates for `NotificationService`.
- `__tests__` contains tests of the service package.

## Notes

- `UserService`, `CourseService` and `RequestService` are expected to be used through `auth`, and they will check the user's permission accordingly.
- `NotificationService` does not take authorization into consideration, and it is `server`'s responsibility to use it correctly, after some operation is known to be successful.