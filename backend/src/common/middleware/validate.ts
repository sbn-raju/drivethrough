import type { z } from 'zod';

/** Parse and throw ZodError (handled centrally) on failure. */
export const parse = <S extends z.ZodType>(schema: S, data: unknown): z.output<S> => schema.parse(data);
