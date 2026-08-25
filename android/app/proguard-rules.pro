# Preserve no secret material in logs. Add narrowly scoped rules only when a
# reviewed cryptography dependency is chosen.
-dontwarn org.conscrypt.**
