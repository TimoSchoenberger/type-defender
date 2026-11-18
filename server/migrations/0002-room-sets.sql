-- For databases created before rooms could prescribe key sets (schema.sql already has the column).
ALTER TABLE rooms ADD COLUMN sets TEXT;
