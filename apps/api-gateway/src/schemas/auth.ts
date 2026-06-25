import { Schema } from 'effect'

export const RegisterBodySchema = Schema.Struct({
  email: Schema.String.pipe(
    Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
      message: () => 'Invalid email address',
    }),
  ),
  password: Schema.String.pipe(
    Schema.minLength(8, {
      message: () => 'Password must be at least 8 characters',
    }),
  ),
  firstName: Schema.String.pipe(Schema.minLength(1)),
  lastName: Schema.String.pipe(Schema.minLength(1)),
  middleName: Schema.optional(Schema.String),
})

export const LoginBodySchema = Schema.Struct({
  email: Schema.String,
  password: Schema.String,
})
