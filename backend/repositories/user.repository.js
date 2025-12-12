import { v4 as uuidv4 } from "uuid";
import { query } from "../database/postgres.js";

const USER_FIELDS = `id, name, email, role, created_at AS "createdAt", updated_at AS "updatedAt"`;
export const USER_ROLES = {
  USER: "USER",
  ADMIN: "ADMIN",
};

export const createUser = async ({ name, email, password, role = USER_ROLES.USER }) => {
  const id = uuidv4();
  const { rows } = await query(
    `
    INSERT INTO users (id, name, email, password, role)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING ${USER_FIELDS};
  `,
    [id, name, email, password, role]
  );

  return rows[0];
};

export const findUserByEmail = async (email) => {
  const { rows } = await query(
    `
    SELECT ${USER_FIELDS}
    FROM users
    WHERE email = $1;
  `,
    [email]
  );

  return rows[0];
};

export const findUserWithPasswordByEmail = async (email) => {
  const { rows } = await query(
    `
    SELECT ${USER_FIELDS}, password
    FROM users
    WHERE email = $1;
  `,
    [email]
  );

  return rows[0];
};

export const findUserById = async (id) => {
  const { rows } = await query(
    `
    SELECT ${USER_FIELDS}
    FROM users
    WHERE id = $1;
  `,
    [id]
  );

  return rows[0];
};

export const listUsers = async () => {
  const { rows } = await query(
    `
    SELECT ${USER_FIELDS}
    FROM users
    ORDER BY created_at DESC;
  `
  );

  return rows;
};

export const updateUserRole = async (id, role) => {
  const { rows } = await query(
    `
    UPDATE users
    SET role = $2,
        updated_at = NOW()
    WHERE id = $1
    RETURNING ${USER_FIELDS};
  `,
    [id, role]
  );

  return rows[0];
};

export const updateUser = async (id, fields = {}) => {
  const updates = [];
  const values = [];
  let index = 1;

  if (fields.name) {
    updates.push(`name = $${index++}`);
    values.push(fields.name);
  }

  if (fields.email) {
    updates.push(`email = $${index++}`);
    values.push(fields.email);
  }

  if (fields.role) {
    updates.push(`role = $${index++}`);
    values.push(fields.role);
  }

  if (fields.password) {
    updates.push(`password = $${index++}`);
    values.push(fields.password);
  }

  if (updates.length === 0) {
    return findUserById(id);
  }

  updates.push(`updated_at = NOW()`);

  values.push(id);
  const { rows } = await query(
    `
    UPDATE users
    SET ${updates.join(", ")}
    WHERE id = $${index}
    RETURNING ${USER_FIELDS};
  `,
    values
  );

  return rows[0];
};

export const deleteUserById = async (id) => {
  const { rows } = await query(
    `
    DELETE FROM users
    WHERE id = $1
    RETURNING ${USER_FIELDS};
  `,
    [id]
  );

  return rows[0];
};

export const countUsersByRole = async () => {
  const { rows } = await query(
    `
    SELECT role, COUNT(*)::INT AS count
    FROM users
    GROUP BY role;
  `
  );

  return rows;
};

export const countTotalUsers = async () => {
  const { rows } = await query(
    `
    SELECT COUNT(*)::INT AS count
    FROM users;
  `
  );

  return rows[0]?.count ?? 0;
};

