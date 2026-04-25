const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "database.sqlite");

const AUTH_SECRET =
  process.env.AUTH_SECRET || crypto.createHash("sha256").update(`${DB_PATH}:turnosmed`).digest("hex");

const TORRES_PISOS = {
  "Torre 2": ["t2p6", "t2p8", "t2p9", "t2p10", "t2p11"],
  "Torre 3": ["t3p4", "t3p5", "t3p6", "t3p7", "t3p8", "t3p9"],
  "Torre 4": ["t4p7"],
};

const TIPOS_TURNO_VALIDOS = ["DIA", "CENIZO", "FDS"];

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10mb" }));

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("Error abriendo base de datos:", err.message);
  } else {
    console.log("Base de datos conectada:", DB_PATH);
  }
});

/* ============================================================================
   HELPERS DB
============================================================================ */
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function callback(err) {
      if (err) {
        reject(err);
      } else {
        resolve({
          id: this.lastID,
          changes: this.changes,
        });
      }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row || null);
      }
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
}

async function ensureColumn(table, column, definition) {
  const columns = await all(`PRAGMA table_info(${table})`);
  const exists = columns.some((c) => c.name === column);

  if (!exists) {
    try {
      await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    } catch (error) {
      if (String(error.message || "").includes("non-constant default")) {
        await run(`ALTER TABLE ${table} ADD COLUMN ${column} TEXT`);
        return;
      }

      throw error;
    }
  }
}

async function hasColumn(table, column) {
  const columns = await all(`PRAGMA table_info(${table})`);
  return columns.some((c) => c.name === column);
}

async function insertDynamic(table, valuesByColumn) {
  const columnsInfo = await all(`PRAGMA table_info(${table})`);
  const available = new Set(columnsInfo.map((c) => c.name));
  const columns = Object.keys(valuesByColumn).filter((column) => available.has(column));

  if (!columns.length) {
    throw new Error(`No hay columnas compatibles para insertar en ${table}`);
  }

  const placeholders = columns.map(() => "?");
  const params = columns.map((column) => valuesByColumn[column]);

  return run(
    `
    INSERT INTO ${table} (
      ${columns.join(", ")}
    )
    VALUES (${placeholders.join(", ")})
    `,
    params
  );
}

async function ensureIndex(name, sql) {
  try {
    await run(`CREATE INDEX IF NOT EXISTS ${name} ${sql}`);
  } catch (error) {
    console.error(`No se pudo crear Ã­ndice ${name}:`, error.message);
  }
}

async function ensureSolicitudesSchema() {
  await ensureColumn("solicitudes_cambio_turno", "medico_solicitante_id", "INTEGER");
  await ensureColumn("solicitudes_cambio_turno", "medico_destino_id", "INTEGER");
  await ensureColumn("solicitudes_cambio_turno", "fecha_origen", "TEXT");
  await ensureColumn("solicitudes_cambio_turno", "tipo_turno_origen", "TEXT");
  await ensureColumn("solicitudes_cambio_turno", "fecha_destino", "TEXT");
  await ensureColumn("solicitudes_cambio_turno", "tipo_turno_destino", "TEXT");
  await ensureColumn("solicitudes_cambio_turno", "mensaje", "TEXT");
  await ensureColumn("solicitudes_cambio_turno", "estado", "TEXT DEFAULT 'pendiente'");
  await ensureColumn("solicitudes_cambio_turno", "fecha_solicitud", "TEXT DEFAULT CURRENT_TIMESTAMP");
  await ensureColumn("solicitudes_cambio_turno", "updated_at", "TEXT");

  await ensureColumn("solicitudes_cesion_turno", "medico_solicitante_id", "INTEGER");
  await ensureColumn("solicitudes_cesion_turno", "medico_receptor_id", "INTEGER");
  await ensureColumn("solicitudes_cesion_turno", "fecha", "TEXT");
  await ensureColumn("solicitudes_cesion_turno", "tipo_turno", "TEXT");
  await ensureColumn("solicitudes_cesion_turno", "mensaje", "TEXT");
  await ensureColumn("solicitudes_cesion_turno", "estado", "TEXT DEFAULT 'pendiente'");
  await ensureColumn("solicitudes_cesion_turno", "fecha_solicitud", "TEXT DEFAULT CURRENT_TIMESTAMP");
  await ensureColumn("solicitudes_cesion_turno", "updated_at", "TEXT");

  await ensureColumn("solicitudes_horario", "medico_id", "INTEGER");
  await ensureColumn("solicitudes_horario", "year", "INTEGER");
  await ensureColumn("solicitudes_horario", "mes", "INTEGER");
  await ensureColumn("solicitudes_horario", "mes_programacion", "INTEGER");
  await ensureColumn("solicitudes_horario", "mensaje", "TEXT");
  await ensureColumn("solicitudes_horario", "estado", "TEXT DEFAULT 'pendiente'");
  await ensureColumn("solicitudes_horario", "fecha_solicitud", "TEXT DEFAULT CURRENT_TIMESTAMP");
  await ensureColumn("solicitudes_horario", "updated_at", "TEXT");
}

async function ensurePacientesCargoSchema() {
  await run(`
    CREATE TABLE IF NOT EXISTS pacientes_cargo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medico_id INTEGER NOT NULL,
      torre TEXT,
      piso TEXT,
      cama TEXT NOT NULL,
      nombre_paciente TEXT NOT NULL,
      diagnostico TEXT,
      pendientes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    )
  `);

  await ensureColumn("pacientes_cargo", "medico_id", "INTEGER");
  await ensureColumn("pacientes_cargo", "torre", "TEXT");
  await ensureColumn("pacientes_cargo", "piso", "TEXT");
  await ensureColumn("pacientes_cargo", "cama", "TEXT");
  await ensureColumn("pacientes_cargo", "nombre_paciente", "TEXT");
  await ensureColumn("pacientes_cargo", "diagnostico", "TEXT");
  await ensureColumn("pacientes_cargo", "pendientes", "TEXT");
  await ensureColumn("pacientes_cargo", "created_at", "TEXT DEFAULT CURRENT_TIMESTAMP");
  await ensureColumn("pacientes_cargo", "updated_at", "TEXT");
}

function ok(res, data) {
  return res.json(data);
}

function fail(res, error, status = 500) {
  console.error(error);

  return res.status(status).json({
    error: error?.message || "OcurriÃ³ un error con el servidor",
  });
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function toNull(value) {
  const v = cleanText(value);
  return v ? v : null;
}

function fechaActualSql() {
  return new Date().toISOString();
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signToken(payload) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
    })
  );
  const signature = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(`${header}.${body}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const expected = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(`${header}.${body}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const received = Buffer.from(signature);
  const valid = Buffer.from(expected);

  if (received.length !== valid.length || !crypto.timingSafeEqual(received, valid)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("hex");
  return `pbkdf2$${salt}$${hash}`;
}

function passwordMatches(storedPassword, plainPassword) {
  const stored = String(storedPassword || "");
  const plain = String(plainPassword || "");

  if (stored.startsWith("pbkdf2$")) {
    const [, salt, hash] = stored.split("$");
    if (!salt || !hash) return false;

    const candidate = crypto.pbkdf2Sync(plain, salt, 120000, 32, "sha256").toString("hex");
    const a = Buffer.from(candidate);
    const b = Buffer.from(hash);

    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  return stored === plain;
}

function getStoredPassword(usuario) {
  return usuario?.password || usuario?.password_hash || "";
}

async function maybeUpgradePassword(usuario, plainPassword) {
  const storedPassword = getStoredPassword(usuario);

  if (!usuario?.id || String(storedPassword || "").startsWith("pbkdf2$")) {
    return;
  }

  await updateUserPassword(usuario.id, plainPassword);
}

async function updateUserPassword(userId, plainPassword) {
  const hashed = hashPassword(plainPassword);
  const sets = [];
  const params = [];

  if (await hasColumn("usuarios", "password")) {
    sets.push("password = ?");
    params.push(hashed);
  }

  if (await hasColumn("usuarios", "password_hash")) {
    sets.push("password_hash = ?");
    params.push(hashed);
  }

  if (!sets.length) {
    throw new Error("La tabla usuarios no tiene columna de contraseña");
  }

  params.push(userId);

  await run(
    `
    UPDATE usuarios
    SET ${sets.join(", ")}
    WHERE id = ?
    `,
    params
  );
}

async function insertUsuario({ username, password, rol, medico_id, cedula, nombre }) {
  const hashed = hashPassword(password);
  const columns = ["username", "rol", "medico_id", "cedula", "nombre", "activo"];
  const placeholders = ["?", "?", "?", "?", "?", "1"];
  const params = [username, rol, medico_id, cedula, nombre];

  if (await hasColumn("usuarios", "password")) {
    columns.splice(1, 0, "password");
    placeholders.splice(1, 0, "?");
    params.splice(1, 0, hashed);
  }

  if (await hasColumn("usuarios", "password_hash")) {
    columns.splice(1, 0, "password_hash");
    placeholders.splice(1, 0, "?");
    params.splice(1, 0, hashed);
  }

  return run(
    `
    INSERT INTO usuarios (
      ${columns.join(", ")}
    )
    VALUES (${placeholders.join(", ")})
    `,
    params
  );
}

async function upsertConfig(clave, valor) {
  const hasUpdatedAt = await hasColumn("configuracion", "updated_at");
  const existente = await get("SELECT clave FROM configuracion WHERE clave = ?", [clave]);

  if (existente) {
    if (hasUpdatedAt) {
      await run(
        `
        UPDATE configuracion
        SET valor = ?,
            updated_at = ?
        WHERE clave = ?
        `,
        [String(valor), fechaActualSql(), clave]
      );
    } else {
      await run(
        `
        UPDATE configuracion
        SET valor = ?
        WHERE clave = ?
        `,
        [String(valor), clave]
      );
    }
  } else if (hasUpdatedAt) {
    await run(
      "INSERT INTO configuracion (clave, valor, updated_at) VALUES (?, ?, ?)",
      [clave, String(valor), fechaActualSql()]
    );
  } else {
    await run("INSERT INTO configuracion (clave, valor) VALUES (?, ?)", [
      clave,
      String(valor),
    ]);
  }
}

function buildAuthResponse(usuario, medico = null, overrides = {}) {
  const safeUser = {
    ...publicUser(usuario),
    ...overrides,
  };

  return {
    usuario: safeUser,
    medico,
    token: signToken({
      id: safeUser.id,
      username: safeUser.username,
      rol: normalizeRol(safeUser.rol),
      medico_id: safeUser.medico_id || null,
      cedula: safeUser.cedula || null,
    }),
  };
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = verifyToken(token);

  if (!payload) {
    return fail(res, new Error("SesiÃ³n invÃ¡lida o vencida"), 401);
  }

  req.auth = payload;
  return next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!isAdminRol(req.auth?.rol)) {
      return fail(res, new Error("No tienes permisos de coordinador"), 403);
    }

    return next();
  });
}

function canManageMedico(req, medicoId) {
  return isAdminRol(req.auth?.rol) || Number(req.auth?.medico_id) === Number(medicoId);
}

function normalizeRol(rol) {
  const r = cleanText(rol).toLowerCase();

  if (r === "administrador") return "coordinador";
  if (r === "admin") return "coordinador";
  if (r === "coordinador") return "coordinador";
  if (r === "medico") return "medico";
  if (r === "mÃ©dico") return "medico";

  return r || "medico";
}

function normalizeEstado(estado) {
  const e = cleanText(estado).toLowerCase();

  if (e === "aprobado") return "aprobado";
  if (e === "rechazado") return "rechazado";

  return "pendiente";
}

function isAdminRol(rol) {
  const r = normalizeRol(rol);
  return r === "coordinador";
}

function isTipoTurnoValido(tipo) {
  return TIPOS_TURNO_VALIDOS.includes(cleanText(tipo));
}

function normalizeSolicitudCambio(row) {
  if (!row) return null;

  return {
    ...row,
    medico_solicitante_id: row.medico_solicitante_id || row.medico_id,
    medico_destino_id: row.medico_destino_id || row.medico_receptor_id,
    fecha_origen: row.fecha_origen || row.fecha_solicitante,
    tipo_turno_origen:
      row.tipo_turno_origen || row.tipo_turno_solicitante || row.turno_solicitante,
    fecha_destino: row.fecha_destino || row.fecha_receptor,
    tipo_turno_destino:
      row.tipo_turno_destino || row.tipo_turno_receptor || row.turno_destino,
  };
}

function normalizeSolicitudCesion(row) {
  if (!row) return null;

  return {
    ...row,
    medico_solicitante_id: row.medico_solicitante_id || row.medico_id,
    medico_receptor_id: row.medico_receptor_id || row.medico_destino_id,
    fecha: row.fecha || row.fecha_turno || row.fecha_origen || row.fecha_solicitante,
    tipo_turno:
      row.tipo_turno || row.turno || row.tipo_turno_origen || row.tipo_turno_solicitante,
  };
}

function publicUser(row) {
  if (!row) return null;

  return {
    id: row.id,
    username: row.username,
    rol: normalizeRol(row.rol),
    medico_id: row.medico_id,
    cedula: row.cedula,
    nombre: row.nombre,
    activo: row.activo,
    created_at: row.created_at,
    es_admin: normalizeRol(row.rol) === "coordinador",
    es_medico: !!row.medico_id || normalizeRol(row.rol) === "medico",
  };
}

function medicoPayloadFromBody(body) {
  return {
    nombre: cleanText(body.nombre),
    apellido: cleanText(body.apellido),
    documento: cleanText(body.documento),
    tipo_doc: cleanText(body.tipo_doc) || "CC",
    especialidad: cleanText(body.especialidad),
    registro_medico: cleanText(body.registro_medico),
    telefono: cleanText(body.telefono),
    email: cleanText(body.email),
    fecha_ingreso: cleanText(body.fecha_ingreso),
    cargo: cleanText(body.cargo),
    color: cleanText(body.color) || "#4f8ef7",
    torre_asignada: toNull(body.torre_asignada || body.torre || body.torre_encargada),
    piso_asignado: toNull(body.piso_asignado || body.piso || body.piso_encargado),
  };
}

function validarTorrePiso(torre, piso) {
  if (!torre && !piso) {
    return true;
  }

  if (!torre || !piso) {
    return false;
  }

  if (!TORRES_PISOS[torre]) {
    return false;
  }

  return TORRES_PISOS[torre].includes(piso);
}

async function buscarMedicoPorDocumento(documento) {
  const doc = cleanText(documento);

  if (!doc) return null;

  return get(
    `
    SELECT *
    FROM medicos
    WHERE documento = ?
      AND activo = 1
    LIMIT 1
    `,
    [doc]
  );
}

async function contarAdministradoresActivos() {
  const row = await get(
    `
    SELECT COUNT(*) AS total
    FROM usuarios
    WHERE activo = 1
      AND (rol = 'coordinador' OR rol = 'administrador' OR rol = 'admin')
    `
  );

  return Number(row?.total || 0);
}

async function buscarAdminActivoPorMedicoOCedula(medicoId, cedula) {
  const doc = toNull(cedula);
  const id = medicoId ? Number(medicoId) : null;

  if (!id && !doc) return null;

  return get(
    `
    SELECT *
    FROM usuarios
    WHERE activo = 1
      AND (rol = 'coordinador' OR rol = 'administrador' OR rol = 'admin')
      AND (
        (? IS NOT NULL AND medico_id = ?)
        OR (? IS NOT NULL AND cedula = ?)
      )
    LIMIT 1
    `,
    [id, id, doc, doc]
  );
}

/* ============================================================================
   INIT DB
============================================================================ */
async function initDB() {
  await run("PRAGMA foreign_keys = ON");

  await run(`
    CREATE TABLE IF NOT EXISTS medicos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      documento TEXT UNIQUE NOT NULL,
      tipo_doc TEXT DEFAULT 'CC',
      especialidad TEXT,
      registro_medico TEXT,
      telefono TEXT,
      email TEXT,
      fecha_ingreso TEXT,
      cargo TEXT,
      color TEXT,
      torre_asignada TEXT,
      piso_asignado TEXT,
      activo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'medico',
      medico_id INTEGER,
      cedula TEXT,
      nombre TEXT,
      activo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS turnos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medico_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      tipo_turno TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(medico_id, fecha, tipo_turno)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS horas_adicionales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medico_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      horas REAL DEFAULT 0,
      motivo TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT,
      UNIQUE(medico_id, fecha)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS pacientes_cargo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medico_id INTEGER NOT NULL,
      torre TEXT,
      piso TEXT,
      cama TEXT NOT NULL,
      nombre_paciente TEXT NOT NULL,
      diagnostico TEXT,
      pendientes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS solicitudes_cambio_turno (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medico_solicitante_id INTEGER NOT NULL,
      medico_destino_id INTEGER NOT NULL,
      fecha_origen TEXT NOT NULL,
      tipo_turno_origen TEXT NOT NULL,
      fecha_destino TEXT NOT NULL,
      tipo_turno_destino TEXT NOT NULL,
      mensaje TEXT,
      estado TEXT DEFAULT 'pendiente',
      fecha_solicitud TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS solicitudes_cesion_turno (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medico_solicitante_id INTEGER NOT NULL,
      medico_receptor_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      tipo_turno TEXT NOT NULL,
      mensaje TEXT,
      estado TEXT DEFAULT 'pendiente',
      fecha_solicitud TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS solicitudes_horario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medico_id INTEGER NOT NULL,
      year INTEGER,
      mes INTEGER,
      mes_programacion INTEGER,
      mensaje TEXT NOT NULL,
      estado TEXT DEFAULT 'pendiente',
      fecha_solicitud TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    )
  `);

  await ensureColumn("medicos", "tipo_doc", "TEXT DEFAULT 'CC'");
  await ensureColumn("medicos", "especialidad", "TEXT");
  await ensureColumn("medicos", "registro_medico", "TEXT");
  await ensureColumn("medicos", "telefono", "TEXT");
  await ensureColumn("medicos", "email", "TEXT");
  await ensureColumn("medicos", "fecha_ingreso", "TEXT");
  await ensureColumn("medicos", "cargo", "TEXT");
  await ensureColumn("medicos", "color", "TEXT");
  await ensureColumn("medicos", "torre_asignada", "TEXT");
  await ensureColumn("medicos", "piso_asignado", "TEXT");
  await ensureColumn("medicos", "activo", "INTEGER DEFAULT 1");
  await ensureColumn("medicos", "created_at", "TEXT DEFAULT CURRENT_TIMESTAMP");

  await ensureColumn("usuarios", "medico_id", "INTEGER");
  await ensureColumn("usuarios", "password", "TEXT");
  await ensureColumn("usuarios", "cedula", "TEXT");
  await ensureColumn("usuarios", "nombre", "TEXT");
  await ensureColumn("usuarios", "activo", "INTEGER DEFAULT 1");
  await ensureColumn("usuarios", "created_at", "TEXT DEFAULT CURRENT_TIMESTAMP");

  await ensureColumn("turnos", "created_at", "TEXT DEFAULT CURRENT_TIMESTAMP");

  await ensureColumn("configuracion", "updated_at", "TEXT DEFAULT CURRENT_TIMESTAMP");

  await ensureColumn("horas_adicionales", "motivo", "TEXT");
  await ensureColumn("horas_adicionales", "created_at", "TEXT DEFAULT CURRENT_TIMESTAMP");
  await ensureColumn("horas_adicionales", "updated_at", "TEXT");

  await ensureSolicitudesSchema();
  await ensurePacientesCargoSchema();

  await ensureIndex(
    "idx_medicos_documento",
    "ON medicos(documento)"
  );

  await ensureIndex(
    "idx_usuarios_username",
    "ON usuarios(username)"
  );

  await ensureIndex(
    "idx_usuarios_cedula",
    "ON usuarios(cedula)"
  );

  await ensureIndex(
    "idx_turnos_fecha",
    "ON turnos(fecha)"
  );

  await ensureIndex(
    "idx_turnos_medico_fecha",
    "ON turnos(medico_id, fecha)"
  );

  await ensureIndex(
    "idx_solicitudes_cambio_estado",
    "ON solicitudes_cambio_turno(estado)"
  );

  await ensureIndex(
    "idx_solicitudes_cesion_estado",
    "ON solicitudes_cesion_turno(estado)"
  );

  await ensureIndex(
    "idx_solicitudes_horario_estado",
    "ON solicitudes_horario(estado)"
  );

  await ensureIndex(
    "idx_pacientes_cargo_medico",
    "ON pacientes_cargo(medico_id)"
  );

  const configTarifa = await get(
    "SELECT clave, valor FROM configuracion WHERE clave = ?",
    ["tarifa_hora"]
  );

  if (!configTarifa) {
    await upsertConfig("tarifa_hora", "119800");
  }

  console.log("Tablas verificadas correctamente");
}

/* ============================================================================
   HEALTH
============================================================================ */
app.get("/", (req, res) => {
  res.json({
    ok: true,
    app: "TurnosMed Backend",
    status: "running",
    version: "roles-admin-medico-torre-piso-solicitudes-hoy",
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    status: "healthy",
    database: DB_PATH,
  });
});

app.get("/torres-pisos", (req, res) => {
  res.json(TORRES_PISOS);
});

/* ============================================================================
   LOGIN
============================================================================ */
app.post("/login", async (req, res) => {
  try {
    const username = cleanText(req.body.username);
    const password = cleanText(req.body.password);

    if (!username || !password) {
      return fail(res, new Error("Usuario y contraseÃ±a son obligatorios"), 400);
    }

    const usuario = await get(
      `
      SELECT *
      FROM usuarios
      WHERE username = ?
        AND activo = 1
      `,
      [username]
    );

    if (!usuario || !passwordMatches(getStoredPassword(usuario), password)) {
      return fail(res, new Error("Usuario o contraseÃ±a incorrectos"), 401);
    }

    await maybeUpgradePassword(usuario, password);

    let medico = null;

    if (usuario.medico_id) {
      medico = await get(
        `
        SELECT *
        FROM medicos
        WHERE id = ?
          AND activo = 1
        `,
        [usuario.medico_id]
      );
    }

    return ok(res, buildAuthResponse(usuario, medico));
  } catch (error) {
    return fail(res, error);
  }
});

app.post("/login-admin", async (req, res) => {
  try {
    const cedula = cleanText(req.body.cedula);
    const password = cleanText(req.body.password);

    if (!cedula || !password) {
      return fail(res, new Error("CÃ©dula y contraseÃ±a son obligatorias"), 400);
    }

    const usuario = await get(
      `
      SELECT *
      FROM usuarios
      WHERE activo = 1
        AND (cedula = ? OR username = ?)
        AND (rol = 'coordinador' OR rol = 'administrador' OR rol = 'admin')
      `,
      [cedula, cedula]
    );

    if (!usuario || !passwordMatches(getStoredPassword(usuario), password)) {
      return fail(res, new Error("Administrador no vÃ¡lido"), 401);
    }

    await maybeUpgradePassword(usuario, password);

    let medico = null;

    if (usuario.medico_id) {
      medico = await get(
        `
        SELECT *
        FROM medicos
        WHERE id = ?
          AND activo = 1
        `,
        [usuario.medico_id]
      );
    } else if (usuario.cedula) {
      medico = await buscarMedicoPorDocumento(usuario.cedula);
    }

    return ok(
      res,
      buildAuthResponse(usuario, medico, {
        rol: "coordinador",
        medico_id: usuario.medico_id || medico?.id || null,
        es_admin: true,
        es_medico: !!(usuario.medico_id || medico?.id),
      })
    );
  } catch (error) {
    return fail(res, error);
  }
});

app.post("/login-admin-cedula", async (req, res) => {
  return fail(res, new Error("Usa el inicio de sesión de administrador con contraseña"), 405);
});

/* ============================================================================
   MEDICOS
============================================================================ */
app.get("/medicos", async (req, res) => {
  try {
    const rows = await all(
      `
      SELECT *
      FROM medicos
      WHERE activo = 1
      ORDER BY apellido COLLATE NOCASE ASC, nombre COLLATE NOCASE ASC
      `
    );

    return ok(res, rows);
  } catch (error) {
    return fail(res, error);
  }
});

app.get("/medicos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return fail(res, new Error("ID invÃ¡lido"), 400);
    }

    const medico = await get(
      `
      SELECT *
      FROM medicos
      WHERE id = ?
        AND activo = 1
      `,
      [id]
    );

    if (!medico) {
      return fail(res, new Error("MÃ©dico no encontrado"), 404);
    }

    return ok(res, medico);
  } catch (error) {
    return fail(res, error);
  }
});

app.post("/medicos", requireAdmin, async (req, res) => {
  try {
    const payload = medicoPayloadFromBody(req.body);

    if (!payload.nombre || !payload.apellido || !payload.documento) {
      return fail(res, new Error("Nombre, apellido y documento son obligatorios"), 400);
    }

    if (!payload.torre_asignada || !payload.piso_asignado) {
      return fail(res, new Error("La torre y el piso asignado son obligatorios"), 400);
    }

    if (!validarTorrePiso(payload.torre_asignada, payload.piso_asignado)) {
      return fail(res, new Error("La torre y el piso asignado no son vÃ¡lidos"), 400);
    }

    const result = await run(
      `
      INSERT INTO medicos (
        nombre,
        apellido,
        documento,
        tipo_doc,
        especialidad,
        registro_medico,
        telefono,
        email,
        fecha_ingreso,
        cargo,
        color,
        torre_asignada,
        piso_asignado,
        activo
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `,
      [
        payload.nombre,
        payload.apellido,
        payload.documento,
        payload.tipo_doc,
        payload.especialidad,
        payload.registro_medico,
        payload.telefono,
        payload.email,
        payload.fecha_ingreso,
        payload.cargo,
        payload.color,
        payload.torre_asignada,
        payload.piso_asignado,
      ]
    );

    const medico = await get("SELECT * FROM medicos WHERE id = ?", [result.id]);

    return ok(res, medico);
  } catch (error) {
    if (String(error.message || "").includes("UNIQUE")) {
      return fail(res, new Error("Ya existe un mÃ©dico con ese documento"), 400);
    }

    return fail(res, error);
  }
});

app.put("/medicos/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return fail(res, new Error("ID invÃ¡lido"), 400);
    }

    const payload = medicoPayloadFromBody(req.body);

    if (!payload.nombre || !payload.apellido || !payload.documento) {
      return fail(res, new Error("Nombre, apellido y documento son obligatorios"), 400);
    }

    if (!payload.torre_asignada || !payload.piso_asignado) {
      return fail(res, new Error("La torre y el piso asignado son obligatorios"), 400);
    }

    if (!validarTorrePiso(payload.torre_asignada, payload.piso_asignado)) {
      return fail(res, new Error("La torre y el piso asignado no son vÃ¡lidos"), 400);
    }

    await run(
      `
      UPDATE medicos
      SET nombre = ?,
          apellido = ?,
          documento = ?,
          tipo_doc = ?,
          especialidad = ?,
          registro_medico = ?,
          telefono = ?,
          email = ?,
          fecha_ingreso = ?,
          cargo = ?,
          color = ?,
          torre_asignada = ?,
          piso_asignado = ?
      WHERE id = ?
      `,
      [
        payload.nombre,
        payload.apellido,
        payload.documento,
        payload.tipo_doc,
        payload.especialidad,
        payload.registro_medico,
        payload.telefono,
        payload.email,
        payload.fecha_ingreso,
        payload.cargo,
        payload.color,
        payload.torre_asignada,
        payload.piso_asignado,
        id,
      ]
    );

    const medico = await get("SELECT * FROM medicos WHERE id = ?", [id]);

    return ok(res, medico);
  } catch (error) {
    if (String(error.message || "").includes("UNIQUE")) {
      return fail(res, new Error("Ya existe un mÃ©dico con ese documento"), 400);
    }

    return fail(res, error);
  }
});

app.delete("/medicos/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return fail(res, new Error("ID invÃ¡lido"), 400);
    }

    await run("BEGIN TRANSACTION");

    try {
      await run("DELETE FROM turnos WHERE medico_id = ?", [id]);
      await run("DELETE FROM horas_adicionales WHERE medico_id = ?", [id]);

      await run(
        `
        UPDATE usuarios
        SET medico_id = NULL
        WHERE medico_id = ?
        `,
        [id]
      );

      await run("UPDATE medicos SET activo = 0 WHERE id = ?", [id]);

      await run("COMMIT");
    } catch (error) {
      await run("ROLLBACK");
      throw error;
    }

    return ok(res, {
      ok: true,
      message: "MÃ©dico eliminado correctamente",
    });
  } catch (error) {
    return fail(res, error);
  }
});

/* ============================================================================
   USUARIOS / ADMINISTRADORES
============================================================================ */
app.get("/usuarios", requireAdmin, async (req, res) => {
  try {
    const rows = await all(
      `
      SELECT id,
             username,
             rol,
             medico_id,
             cedula,
             nombre,
             activo,
             created_at
      FROM usuarios
      WHERE activo = 1
      ORDER BY rol ASC, username ASC
      `
    );

    return ok(res, rows.map(publicUser));
  } catch (error) {
    return fail(res, error);
  }
});

app.get("/administradores", requireAdmin, async (req, res) => {
  try {
    const rows = await all(
      `
      SELECT id,
             username,
             rol,
             medico_id,
             cedula,
             nombre,
             activo,
             created_at
      FROM usuarios
      WHERE activo = 1
        AND (rol = 'coordinador' OR rol = 'administrador' OR rol = 'admin')
      ORDER BY nombre COLLATE NOCASE ASC, username COLLATE NOCASE ASC
      `
    );

    return ok(res, rows.map(publicUser));
  } catch (error) {
    return fail(res, error);
  }
});

app.post("/usuarios", requireAdmin, async (req, res) => {
  try {
    const username = cleanText(req.body.username);
    const password = cleanText(req.body.password);
    const rol = normalizeRol(req.body.rol);
    let medico_id = req.body.medico_id ? Number(req.body.medico_id) : null;
    const cedula = toNull(req.body.cedula);
    const nombre = toNull(req.body.nombre);

    if (!username || !password) {
      return fail(res, new Error("Usuario y contraseÃ±a son obligatorios"), 400);
    }

    if (rol === "medico" && !medico_id) {
      return fail(res, new Error("El usuario mÃ©dico debe estar vinculado a un mÃ©dico"), 400);
    }

    if (rol === "coordinador" && (await contarAdministradoresActivos()) >= 2) {
      return fail(res, new Error("No puede haber mÃ¡s de 2 administradores activos"), 400);
    }

    if (rol === "coordinador" && !medico_id && cedula) {
      const medicoConMismaCedula = await buscarMedicoPorDocumento(cedula);
      medico_id = medicoConMismaCedula?.id || null;
    }

    if (rol === "coordinador" && !medico_id) {
      return fail(res, new Error("El administrador debe estar vinculado a un mÃ©dico registrado"), 400);
    }

    if (medico_id) {
      const medico = await get(
        `
        SELECT id
        FROM medicos
        WHERE id = ?
          AND activo = 1
        `,
        [medico_id]
      );

      if (!medico) {
        return fail(res, new Error("El mÃ©dico vinculado no existe"), 400);
      }
    }

    if (rol === "coordinador") {
      const adminExistente = await buscarAdminActivoPorMedicoOCedula(medico_id, cedula);

      if (adminExistente) {
        return fail(res, new Error("Ese mÃ©dico ya tiene acceso de administrador"), 400);
      }
    }

    const result = await insertUsuario({
      username,
      password,
      rol,
      medico_id,
      cedula,
      nombre,
    });

    const usuario = await get(
      `
      SELECT id,
             username,
             rol,
             medico_id,
             cedula,
             nombre,
             activo,
             created_at
      FROM usuarios
      WHERE id = ?
      `,
      [result.id]
    );

    return ok(res, publicUser(usuario));
  } catch (error) {
    if (String(error.message || "").includes("UNIQUE")) {
      return fail(res, new Error("Ya existe un usuario con ese nombre de usuario"), 400);
    }

    return fail(res, error);
  }
});

app.put("/usuarios/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return fail(res, new Error("ID invÃ¡lido"), 400);
    }

    const usuarioActual = await get("SELECT * FROM usuarios WHERE id = ? AND activo = 1", [id]);

    if (!usuarioActual) {
      return fail(res, new Error("Usuario no encontrado"), 404);
    }

    const username = cleanText(req.body.username || usuarioActual.username);
    const rol = normalizeRol(req.body.rol || usuarioActual.rol);
    const medico_id =
      req.body.medico_id === "" || req.body.medico_id === null || req.body.medico_id === undefined
        ? null
        : Number(req.body.medico_id);
    const cedula = toNull(req.body.cedula ?? usuarioActual.cedula);
    const nombre = toNull(req.body.nombre ?? usuarioActual.nombre);

    if (!username) {
      return fail(res, new Error("El usuario es obligatorio"), 400);
    }

    if (!isAdminRol(usuarioActual.rol) && isAdminRol(rol) && (await contarAdministradoresActivos()) >= 2) {
      return fail(res, new Error("No puede haber mÃ¡s de 2 administradores activos"), 400);
    }

    if (medico_id) {
      const medico = await get("SELECT id FROM medicos WHERE id = ? AND activo = 1", [
        medico_id,
      ]);

      if (!medico) {
        return fail(res, new Error("El mÃ©dico vinculado no existe"), 400);
      }
    }

    await run(
      `
      UPDATE usuarios
      SET username = ?,
          rol = ?,
          medico_id = ?,
          cedula = ?,
          nombre = ?
      WHERE id = ?
      `,
      [username, rol, medico_id, cedula, nombre, id]
    );

    const usuario = await get(
      `
      SELECT id,
             username,
             rol,
             medico_id,
             cedula,
             nombre,
             activo,
             created_at
      FROM usuarios
      WHERE id = ?
      `,
      [id]
    );

    return ok(res, publicUser(usuario));
  } catch (error) {
    if (String(error.message || "").includes("UNIQUE")) {
      return fail(res, new Error("Ya existe un usuario con ese nombre de usuario"), 400);
    }

    return fail(res, error);
  }
});

app.put("/usuarios/:id/reset-password", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const nuevaPassword = cleanText(req.body.nuevaPassword || req.body.password);

    if (!id || !nuevaPassword) {
      return fail(res, new Error("Usuario y nueva contraseÃ±a son obligatorios"), 400);
    }

    const usuario = await get("SELECT * FROM usuarios WHERE id = ? AND activo = 1", [id]);

    if (!usuario) {
      return fail(res, new Error("Usuario no encontrado"), 404);
    }

    await updateUserPassword(id, nuevaPassword);

    return ok(res, {
      ok: true,
      message: "ContraseÃ±a actualizada correctamente",
    });
  } catch (error) {
    return fail(res, error);
  }
});

app.delete("/usuarios/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return fail(res, new Error("ID invÃ¡lido"), 400);
    }

    const usuario = await get("SELECT * FROM usuarios WHERE id = ? AND activo = 1", [id]);

    if (!usuario) {
      return fail(res, new Error("Usuario no encontrado"), 404);
    }

    if (isAdminRol(usuario.rol)) {
      const totalAdmins = await contarAdministradoresActivos();

      if (totalAdmins <= 1) {
        return fail(res, new Error("Debe existir al menos un administrador activo"), 400);
      }
    }

    await run("UPDATE usuarios SET activo = 0 WHERE id = ?", [id]);

    return ok(res, {
      ok: true,
      message: "Usuario eliminado correctamente",
    });
  } catch (error) {
    return fail(res, error);
  }
});

app.delete("/administradores/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return fail(res, new Error("ID invÃ¡lido"), 400);
    }

    const usuario = await get(
      `
      SELECT *
      FROM usuarios
      WHERE id = ?
        AND activo = 1
      `,
      [id]
    );

    if (!usuario) {
      return fail(res, new Error("Administrador no encontrado"), 404);
    }

    if (!isAdminRol(usuario.rol)) {
      return fail(res, new Error("Este usuario no es administrador"), 400);
    }

    const totalAdmins = await contarAdministradoresActivos();

    if (totalAdmins <= 1) {
      return fail(res, new Error("Debe existir al menos un administrador activo"), 400);
    }

    await run("UPDATE usuarios SET activo = 0 WHERE id = ?", [id]);

    return ok(res, {
      ok: true,
      message: "Administrador eliminado correctamente",
    });
  } catch (error) {
    return fail(res, error);
  }
});

/* ============================================================================
   TURNOS
============================================================================ */
app.get("/turnos", async (req, res) => {
  try {
    const rows = await all(
      `
      SELECT id,
             medico_id,
             fecha,
             tipo_turno,
             created_at
      FROM turnos
      ORDER BY fecha ASC, medico_id ASC, tipo_turno ASC
      `
    );

    return ok(res, rows);
  } catch (error) {
    return fail(res, error);
  }
});

app.get("/turnos/hoy", async (req, res) => {
  try {
    const fecha = cleanText(req.query.fecha) || new Date().toISOString().slice(0, 10);
    const tipo = cleanText(req.query.tipo);

    const params = [fecha];

    let filtroTipo = "";

    if (tipo) {
      filtroTipo = "AND t.tipo_turno = ?";
      params.push(tipo);
    }

    const rows = await all(
      `
      SELECT
        t.id AS turno_id,
        t.medico_id,
        t.fecha,
        t.tipo_turno,
        m.nombre,
        m.apellido,
        m.documento,
        m.tipo_doc,
        m.especialidad,
        m.registro_medico,
        m.telefono,
        m.email,
        m.cargo,
        m.color,
        m.torre_asignada,
        m.piso_asignado
      FROM turnos t
      INNER JOIN medicos m ON m.id = t.medico_id
      WHERE t.fecha = ?
        AND m.activo = 1
        ${filtroTipo}
      ORDER BY
        CASE t.tipo_turno
          WHEN 'DIA' THEN 1
          WHEN 'CENIZO' THEN 2
          WHEN 'FDS' THEN 3
          ELSE 4
        END,
        m.torre_asignada ASC,
        m.piso_asignado ASC,
        m.apellido COLLATE NOCASE ASC,
        m.nombre COLLATE NOCASE ASC
      `,
      params
    );

    return ok(res, rows);
  } catch (error) {
    return fail(res, error);
  }
});

app.get("/especialistas-turno-hoy", async (req, res) => {
  try {
    const fecha = cleanText(req.query.fecha) || new Date().toISOString().slice(0, 10);

    const rows = await all(
      `
      SELECT
        t.id AS turno_id,
        t.medico_id,
        t.fecha,
        t.tipo_turno,
        m.nombre,
        m.apellido,
        m.documento,
        m.tipo_doc,
        m.especialidad,
        m.registro_medico,
        m.telefono,
        m.email,
        m.cargo,
        m.color,
        m.torre_asignada,
        m.piso_asignado
      FROM turnos t
      INNER JOIN medicos m ON m.id = t.medico_id
      WHERE t.fecha = ?
        AND m.activo = 1
      ORDER BY
        m.torre_asignada ASC,
        m.piso_asignado ASC,
        m.especialidad COLLATE NOCASE ASC,
        m.apellido COLLATE NOCASE ASC
      `,
      [fecha]
    );

    return ok(res, rows);
  } catch (error) {
    return fail(res, error);
  }
});

app.post("/turnos", requireAdmin, async (req, res) => {
  try {
    const medico_id = Number(req.body.medico_id);
    const fecha = cleanText(req.body.fecha);
    const tipo_turno = cleanText(req.body.tipo_turno);

    if (!medico_id || !fecha || !tipo_turno) {
      return fail(res, new Error("MÃ©dico, fecha y tipo de turno son obligatorios"), 400);
    }

    if (!isTipoTurnoValido(tipo_turno)) {
      return fail(res, new Error("Tipo de turno invÃ¡lido"), 400);
    }

    const medico = await get("SELECT id FROM medicos WHERE id = ? AND activo = 1", [
      medico_id,
    ]);

    if (!medico) {
      return fail(res, new Error("MÃ©dico no encontrado"), 404);
    }

    await run(
      `
      INSERT INTO turnos (
        medico_id,
        fecha,
        tipo_turno
      )
      VALUES (?, ?, ?)
      `,
      [medico_id, fecha, tipo_turno]
    );

    const row = await get(
      `
      SELECT *
      FROM turnos
      WHERE medico_id = ?
        AND fecha = ?
        AND tipo_turno = ?
      `,
      [medico_id, fecha, tipo_turno]
    );

    return ok(res, row);
  } catch (error) {
    return fail(res, error);
  }
});

app.delete("/turnos", requireAdmin, async (req, res) => {
  try {
    const medico_id = Number(req.body.medico_id);
    const fecha = cleanText(req.body.fecha);
    const tipo_turno = cleanText(req.body.tipo_turno);

    if (!medico_id || !fecha || !tipo_turno) {
      return fail(res, new Error("MÃ©dico, fecha y tipo de turno son obligatorios"), 400);
    }

    await run(
      `
      DELETE FROM turnos
      WHERE medico_id = ?
        AND fecha = ?
        AND tipo_turno = ?
      `,
      [medico_id, fecha, tipo_turno]
    );

    return ok(res, {
      ok: true,
      message: "Turno eliminado correctamente",
    });
  } catch (error) {
    return fail(res, error);
  }
});

app.delete("/turnos/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return fail(res, new Error("ID invÃ¡lido"), 400);
    }

    await run("DELETE FROM turnos WHERE id = ?", [id]);

    return ok(res, {
      ok: true,
      message: "Turno eliminado correctamente",
    });
  } catch (error) {
    return fail(res, error);
  }
});

/* ============================================================================
   HORAS ADICIONALES
============================================================================ */
app.get("/horas-adicionales", async (req, res) => {
  try {
    const rows = await all(
      `
      SELECT *
      FROM horas_adicionales
      ORDER BY fecha ASC, medico_id ASC
      `
    );

    return ok(res, rows);
  } catch (error) {
    return fail(res, error);
  }
});

app.post("/horas-adicionales", requireAuth, async (req, res) => {
  try {
    const medico_id = Number(req.body.medico_id);
    const fecha = cleanText(req.body.fecha);
    const horas = Number(req.body.horas || 0);
    const motivo = cleanText(req.body.motivo);

    if (!medico_id || !fecha) {
      return fail(res, new Error("MÃ©dico y fecha son obligatorios"), 400);
    }

    if (!canManageMedico(req, medico_id)) {
      return fail(res, new Error("No puedes modificar datos de otro mÃ©dico"), 403);
    }

    if (Number.isNaN(horas) || horas < 0) {
      return fail(res, new Error("Horas adicionales invÃ¡lidas"), 400);
    }

    const existente = await get(
      `
      SELECT *
      FROM horas_adicionales
      WHERE medico_id = ?
        AND fecha = ?
      `,
      [medico_id, fecha]
    );

    if (existente) {
      await run(
        `
        UPDATE horas_adicionales
        SET horas = ?,
            motivo = ?,
            updated_at = ?
        WHERE medico_id = ?
          AND fecha = ?
        `,
        [horas, motivo, fechaActualSql(), medico_id, fecha]
      );
    } else {
      await run(
        `
        INSERT INTO horas_adicionales (
          medico_id,
          fecha,
          horas,
          motivo,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [medico_id, fecha, horas, motivo, fechaActualSql()]
      );
    }

    const row = await get(
      `
      SELECT *
      FROM horas_adicionales
      WHERE medico_id = ?
        AND fecha = ?
      `,
      [medico_id, fecha]
    );

    return ok(res, row);
  } catch (error) {
    return fail(res, error);
  }
});

/* ============================================================================
   PACIENTES A CARGO
============================================================================ */
app.get("/pacientes-cargo", requireAuth, async (req, res) => {
  try {
    await ensurePacientesCargoSchema();

    const medico_id = Number(req.query.medico_id || req.auth?.medico_id);

    if (!medico_id) {
      return fail(res, new Error("MÃ©dico requerido"), 400);
    }

    if (!canManageMedico(req, medico_id)) {
      return fail(res, new Error("No puedes ver pacientes de otro mÃ©dico"), 403);
    }

    const rows = await all(
      `
      SELECT *
      FROM pacientes_cargo
      WHERE medico_id = ?
      ORDER BY piso COLLATE NOCASE ASC,
               cama COLLATE NOCASE ASC,
               datetime(created_at) DESC,
               id DESC
      `,
      [medico_id]
    );

    return ok(res, rows);
  } catch (error) {
    return fail(res, error);
  }
});

app.post("/pacientes-cargo", requireAuth, async (req, res) => {
  try {
    await ensurePacientesCargoSchema();

    const medico_id = Number(req.body.medico_id || req.auth?.medico_id);
    const cama = cleanText(req.body.cama);
    const nombre_paciente = cleanText(req.body.nombre_paciente || req.body.nombre);
    const diagnostico = cleanText(req.body.diagnostico);
    const pendientes = cleanText(req.body.pendientes);

    if (!medico_id || !cama || !nombre_paciente) {
      return fail(res, new Error("MÃ©dico, cama y paciente son obligatorios"), 400);
    }

    if (!canManageMedico(req, medico_id)) {
      return fail(res, new Error("No puedes registrar pacientes a nombre de otro mÃ©dico"), 403);
    }

    const medico = await get(
      "SELECT id, torre_asignada, piso_asignado FROM medicos WHERE id = ? AND activo = 1",
      [medico_id]
    );

    if (!medico) {
      return fail(res, new Error("MÃ©dico no encontrado"), 404);
    }

    const result = await run(
      `
      INSERT INTO pacientes_cargo (
        medico_id,
        torre,
        piso,
        cama,
        nombre_paciente,
        diagnostico,
        pendientes,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        medico_id,
        medico.torre_asignada || "",
        medico.piso_asignado || "",
        cama,
        nombre_paciente,
        diagnostico,
        pendientes,
        fechaActualSql(),
      ]
    );

    const row = await get("SELECT * FROM pacientes_cargo WHERE id = ?", [result.id]);

    return ok(res, row);
  } catch (error) {
    return fail(res, error);
  }
});

app.delete("/pacientes-cargo/:id", requireAuth, async (req, res) => {
  try {
    await ensurePacientesCargoSchema();

    const id = Number(req.params.id);
    const paciente = await get("SELECT * FROM pacientes_cargo WHERE id = ?", [id]);

    if (!paciente) {
      return fail(res, new Error("Paciente no encontrado"), 404);
    }

    if (!canManageMedico(req, paciente.medico_id)) {
      return fail(res, new Error("No puedes borrar pacientes de otro mÃ©dico"), 403);
    }

    await run("DELETE FROM pacientes_cargo WHERE id = ?", [id]);

    return ok(res, {
      message: "Paciente eliminado correctamente",
      id,
    });
  } catch (error) {
    return fail(res, error);
  }
});

/* ============================================================================
   CONFIGURACION
============================================================================ */
app.get("/configuracion/tarifa-hora", async (req, res) => {
  try {
    let row = await get(
      `
      SELECT clave, valor
      FROM configuracion
      WHERE clave = ?
      `,
      ["tarifa_hora"]
    );

    if (!row) {
      await upsertConfig("tarifa_hora", "119800");

      row = {
        clave: "tarifa_hora",
        valor: "119800",
      };
    }

    return ok(res, {
      tarifaHora: Number(row.valor) || 119800,
    });
  } catch (error) {
    return fail(res, error);
  }
});

app.put("/configuracion/tarifa-hora", requireAdmin, async (req, res) => {
  try {
    const tarifaHora = Number(req.body.tarifaHora || req.body.valor);

    if (!tarifaHora || tarifaHora <= 0) {
      return fail(res, new Error("Tarifa por hora invÃ¡lida"), 400);
    }

    await upsertConfig("tarifa_hora", tarifaHora);

    return ok(res, {
      tarifaHora,
    });
  } catch (error) {
    return fail(res, error);
  }
});

/* ============================================================================
   SOLICITUDES CAMBIO DE TURNO
============================================================================ */
app.get("/solicitudes-cambio-turno", requireAuth, async (req, res) => {
  try {
    await ensureSolicitudesSchema();

    const medicoId = Number(req.auth?.medico_id);
    const filtroMedico = isAdminRol(req.auth?.rol)
      ? { where: "", params: [] }
      : {
          where: "WHERE medico_solicitante_id = ? OR medico_destino_id = ?",
          params: [medicoId, medicoId],
        };

    const rows = await all(
      `
      SELECT *
      FROM solicitudes_cambio_turno
      ${filtroMedico.where}
      ORDER BY datetime(fecha_solicitud) DESC, id DESC
      `,
      filtroMedico.params
    );

    return ok(res, rows);
  } catch (error) {
    return fail(res, error);
  }
});

app.post("/solicitudes-cambio-turno", requireAuth, async (req, res) => {
  try {
    await ensureSolicitudesSchema();

    const medico_solicitante_id = Number(
      req.body.medico_solicitante_id || req.body.medico_id
    );
    const medico_destino_id = Number(req.body.medico_destino_id);
    const fecha_origen = cleanText(req.body.fecha_origen);
    const tipo_turno_origen = cleanText(req.body.tipo_turno_origen);
    const fecha_destino = cleanText(req.body.fecha_destino);
    const tipo_turno_destino = cleanText(req.body.tipo_turno_destino);
    const mensaje = cleanText(req.body.mensaje);
    const estado = "pendiente";

    if (
      !medico_solicitante_id ||
      !medico_destino_id ||
      !fecha_origen ||
      !tipo_turno_origen ||
      !fecha_destino ||
      !tipo_turno_destino
    ) {
      return fail(res, new Error("Datos incompletos para solicitud de cambio"), 400);
    }

    if (!canManageMedico(req, medico_solicitante_id)) {
      return fail(res, new Error("No puedes solicitar cambios a nombre de otro mÃ©dico"), 403);
    }

    if (!isTipoTurnoValido(tipo_turno_origen) || !isTipoTurnoValido(tipo_turno_destino)) {
      return fail(res, new Error("Tipo de turno invÃ¡lido"), 400);
    }

    if (tipo_turno_origen !== tipo_turno_destino) {
      return fail(res, new Error("Solo se pueden cambiar turnos del mismo tipo"), 400);
    }

    const turnoOrigen = await get(
      `
      SELECT *
      FROM turnos
      WHERE medico_id = ?
        AND fecha = ?
        AND tipo_turno = ?
      `,
      [medico_solicitante_id, fecha_origen, tipo_turno_origen]
    );

    if (!turnoOrigen) {
      return fail(res, new Error("El turno origen no existe"), 400);
    }

    const turnoDestino = await get(
      `
      SELECT *
      FROM turnos
      WHERE medico_id = ?
        AND fecha = ?
        AND tipo_turno = ?
      `,
      [medico_destino_id, fecha_destino, tipo_turno_destino]
    );

    if (!turnoDestino) {
      return fail(res, new Error("El turno destino no existe"), 400);
    }

    const solicitanteYaTieneDestino = await get(
      `
      SELECT id
      FROM turnos
      WHERE medico_id = ?
        AND fecha = ?
        AND tipo_turno = ?
      `,
      [medico_solicitante_id, fecha_destino, tipo_turno_destino]
    );

    if (solicitanteYaTieneDestino) {
      return fail(res, new Error("Ya tienes ese turno en la fecha destino"), 400);
    }

    const destinoYaTieneOrigen = await get(
      `
      SELECT id
      FROM turnos
      WHERE medico_id = ?
        AND fecha = ?
        AND tipo_turno = ?
      `,
      [medico_destino_id, fecha_origen, tipo_turno_origen]
    );

    if (destinoYaTieneOrigen) {
      return fail(res, new Error("El medico destino ya tiene ese turno en tu fecha"), 400);
    }

    const result = await insertDynamic("solicitudes_cambio_turno", {
      medico_solicitante_id,
      medico_id: medico_solicitante_id,
      medico_destino_id,
      medico_receptor_id: medico_destino_id,
      fecha_origen,
      fecha_solicitante: fecha_origen,
      fecha_destino,
      fecha_receptor: fecha_destino,
      tipo_turno_origen,
      tipo_turno_solicitante: tipo_turno_origen,
      turno_solicitante: tipo_turno_origen,
      tipo_turno_destino,
      tipo_turno_receptor: tipo_turno_destino,
      turno_destino: tipo_turno_destino,
      mensaje,
      estado,
      fecha_solicitud: fechaActualSql(),
      created_at: fechaActualSql(),
      updated_at: fechaActualSql(),
    });

    const row = await get(
      "SELECT * FROM solicitudes_cambio_turno WHERE id = ?",
      [result.id]
    );

    return ok(res, row);
  } catch (error) {
    return fail(res, error);
  }
});

app.put("/solicitudes-cambio-turno/:id/aprobar", requireAdmin, async (req, res) => {
  try {
    await ensureSolicitudesSchema();

    const id = Number(req.params.id);

    const solicitud = normalizeSolicitudCambio(await get(
      "SELECT * FROM solicitudes_cambio_turno WHERE id = ?",
      [id]
    ));

    if (!solicitud) {
      return fail(res, new Error("Solicitud no encontrada"), 404);
    }

    if (solicitud.estado !== "pendiente") {
      return fail(res, new Error("Esta solicitud ya fue gestionada"), 400);
    }

    const conflictoSolicitante = await get(
      `
      SELECT id
      FROM turnos
      WHERE medico_id = ?
        AND fecha = ?
        AND tipo_turno = ?
        AND NOT (medico_id = ? AND fecha = ? AND tipo_turno = ?)
      `,
      [
        solicitud.medico_solicitante_id,
        solicitud.fecha_destino,
        solicitud.tipo_turno_destino,
        solicitud.medico_destino_id,
        solicitud.fecha_destino,
        solicitud.tipo_turno_destino,
      ]
    );

    if (conflictoSolicitante) {
      return fail(
        res,
        new Error("No se puede aprobar: el solicitante ya tiene ese turno en la fecha destino"),
        400
      );
    }

    const conflictoDestino = await get(
      `
      SELECT id
      FROM turnos
      WHERE medico_id = ?
        AND fecha = ?
        AND tipo_turno = ?
        AND NOT (medico_id = ? AND fecha = ? AND tipo_turno = ?)
      `,
      [
        solicitud.medico_destino_id,
        solicitud.fecha_origen,
        solicitud.tipo_turno_origen,
        solicitud.medico_solicitante_id,
        solicitud.fecha_origen,
        solicitud.tipo_turno_origen,
      ]
    );

    if (conflictoDestino) {
      return fail(
        res,
        new Error("No se puede aprobar: el medico destino ya tiene ese turno en la fecha origen"),
        400
      );
    }

    await run("BEGIN TRANSACTION");

    try {
      await run(
        `
        DELETE FROM turnos
        WHERE medico_id = ?
          AND fecha = ?
          AND tipo_turno = ?
        `,
        [
          solicitud.medico_solicitante_id,
          solicitud.fecha_origen,
          solicitud.tipo_turno_origen,
        ]
      );

      await run(
        `
        DELETE FROM turnos
        WHERE medico_id = ?
          AND fecha = ?
          AND tipo_turno = ?
        `,
        [
          solicitud.medico_destino_id,
          solicitud.fecha_destino,
          solicitud.tipo_turno_destino,
        ]
      );

      await run(
        `
        INSERT INTO turnos (
          medico_id,
          fecha,
          tipo_turno
        )
        VALUES (?, ?, ?)
        `,
        [
          solicitud.medico_solicitante_id,
          solicitud.fecha_destino,
          solicitud.tipo_turno_destino,
        ]
      );

      await run(
        `
        INSERT INTO turnos (
          medico_id,
          fecha,
          tipo_turno
        )
        VALUES (?, ?, ?)
        `,
        [
          solicitud.medico_destino_id,
          solicitud.fecha_origen,
          solicitud.tipo_turno_origen,
        ]
      );

      await run(
        `
        UPDATE solicitudes_cambio_turno
        SET estado = 'aprobado',
            updated_at = ?
        WHERE id = ?
        `,
        [fechaActualSql(), id]
      );

      await run("COMMIT");
    } catch (error) {
      await run("ROLLBACK");
      throw error;
    }

    const actualizada = await get(
      "SELECT * FROM solicitudes_cambio_turno WHERE id = ?",
      [id]
    );

    return ok(res, actualizada);
  } catch (error) {
    return fail(res, error);
  }
});

app.put("/solicitudes-cambio-turno/:id/rechazar", requireAdmin, async (req, res) => {
  try {
    await ensureSolicitudesSchema();

    const id = Number(req.params.id);

    const solicitud = await get(
      "SELECT * FROM solicitudes_cambio_turno WHERE id = ?",
      [id]
    );

    if (!solicitud) {
      return fail(res, new Error("Solicitud no encontrada"), 404);
    }

    if (solicitud.estado !== "pendiente") {
      return fail(res, new Error("Esta solicitud ya fue gestionada"), 400);
    }

    await run(
      `
      UPDATE solicitudes_cambio_turno
      SET estado = 'rechazado',
          updated_at = ?
      WHERE id = ?
      `,
      [fechaActualSql(), id]
    );

    const row = await get(
      "SELECT * FROM solicitudes_cambio_turno WHERE id = ?",
      [id]
    );

    return ok(res, row);
  } catch (error) {
    return fail(res, error);
  }
});

/* ============================================================================
   SOLICITUDES CESION DE TURNO
============================================================================ */
app.get("/solicitudes-cesion-turno", requireAuth, async (req, res) => {
  try {
    await ensureSolicitudesSchema();

    const medicoId = Number(req.auth?.medico_id);
    const filtroMedico = isAdminRol(req.auth?.rol)
      ? { where: "", params: [] }
      : {
          where: "WHERE medico_solicitante_id = ? OR medico_receptor_id = ?",
          params: [medicoId, medicoId],
        };

    const rows = await all(
      `
      SELECT *
      FROM solicitudes_cesion_turno
      ${filtroMedico.where}
      ORDER BY datetime(fecha_solicitud) DESC, id DESC
      `,
      filtroMedico.params
    );

    return ok(res, rows);
  } catch (error) {
    return fail(res, error);
  }
});

app.post("/solicitudes-cesion-turno", requireAuth, async (req, res) => {
  try {
    await ensureSolicitudesSchema();

    const medico_solicitante_id = Number(
      req.body.medico_solicitante_id || req.body.medico_id
    );
    const medico_receptor_id = Number(req.body.medico_receptor_id);
    const fecha = cleanText(req.body.fecha);
    const tipo_turno = cleanText(req.body.tipo_turno);
    const mensaje = cleanText(req.body.mensaje);
    const estado = "pendiente";

    if (!medico_solicitante_id || !medico_receptor_id || !fecha || !tipo_turno) {
      return fail(res, new Error("Datos incompletos para solicitud de cesiÃ³n"), 400);
    }

    if (!canManageMedico(req, medico_solicitante_id)) {
      return fail(res, new Error("No puedes ceder turnos a nombre de otro mÃ©dico"), 403);
    }

    if (!isTipoTurnoValido(tipo_turno)) {
      return fail(res, new Error("Tipo de turno invÃ¡lido"), 400);
    }

    const turnoOrigen = await get(
      `
      SELECT *
      FROM turnos
      WHERE medico_id = ?
        AND fecha = ?
        AND tipo_turno = ?
      `,
      [medico_solicitante_id, fecha, tipo_turno]
    );

    if (!turnoOrigen) {
      return fail(res, new Error("El turno a ceder no existe"), 400);
    }

    const receptor = await get("SELECT id FROM medicos WHERE id = ? AND activo = 1", [
      medico_receptor_id,
    ]);

    if (!receptor) {
      return fail(res, new Error("El mÃ©dico receptor no existe"), 400);
    }

    const turnoReceptorExistente = await get(
      `
      SELECT id
      FROM turnos
      WHERE medico_id = ?
        AND fecha = ?
        AND tipo_turno = ?
      `,
      [medico_receptor_id, fecha, tipo_turno]
    );

    if (turnoReceptorExistente) {
      return fail(res, new Error("El medico receptor ya tiene ese turno"), 400);
    }

    const result = await insertDynamic("solicitudes_cesion_turno", {
      medico_solicitante_id,
      medico_id: medico_solicitante_id,
      medico_receptor_id,
      medico_destino_id: medico_receptor_id,
      fecha,
      fecha_turno: fecha,
      fecha_solicitante: fecha,
      fecha_origen: fecha,
      tipo_turno,
      turno: tipo_turno,
      tipo_turno_solicitante: tipo_turno,
      tipo_turno_origen: tipo_turno,
      turno_solicitante: tipo_turno,
      mensaje,
      estado,
      fecha_solicitud: fechaActualSql(),
      created_at: fechaActualSql(),
      updated_at: fechaActualSql(),
    });

    const row = await get(
      "SELECT * FROM solicitudes_cesion_turno WHERE id = ?",
      [result.id]
    );

    return ok(res, row);
  } catch (error) {
    return fail(res, error);
  }
});

app.put("/solicitudes-cesion-turno/:id/aprobar", requireAdmin, async (req, res) => {
  try {
    await ensureSolicitudesSchema();

    const id = Number(req.params.id);

    const solicitud = normalizeSolicitudCesion(await get(
      "SELECT * FROM solicitudes_cesion_turno WHERE id = ?",
      [id]
    ));

    if (!solicitud) {
      return fail(res, new Error("Solicitud no encontrada"), 404);
    }

    if (solicitud.estado !== "pendiente") {
      return fail(res, new Error("Esta solicitud ya fue gestionada"), 400);
    }

    const conflictoReceptor = await get(
      `
      SELECT id
      FROM turnos
      WHERE medico_id = ?
        AND fecha = ?
        AND tipo_turno = ?
      `,
      [solicitud.medico_receptor_id, solicitud.fecha, solicitud.tipo_turno]
    );

    if (conflictoReceptor) {
      return fail(
        res,
        new Error("No se puede aprobar: el medico receptor ya tiene ese turno"),
        400
      );
    }

    await run("BEGIN TRANSACTION");

    try {
      await run(
        `
        DELETE FROM turnos
        WHERE medico_id = ?
          AND fecha = ?
          AND tipo_turno = ?
        `,
        [
          solicitud.medico_solicitante_id,
          solicitud.fecha,
          solicitud.tipo_turno,
        ]
      );

      await run(
        `
        INSERT INTO turnos (
          medico_id,
          fecha,
          tipo_turno
        )
        VALUES (?, ?, ?)
        `,
        [
          solicitud.medico_receptor_id,
          solicitud.fecha,
          solicitud.tipo_turno,
        ]
      );

      await run(
        `
        UPDATE solicitudes_cesion_turno
        SET estado = 'aprobado',
            updated_at = ?
        WHERE id = ?
        `,
        [fechaActualSql(), id]
      );

      await run("COMMIT");
    } catch (error) {
      await run("ROLLBACK");
      throw error;
    }

    const actualizada = await get(
      "SELECT * FROM solicitudes_cesion_turno WHERE id = ?",
      [id]
    );

    return ok(res, actualizada);
  } catch (error) {
    return fail(res, error);
  }
});

app.put("/solicitudes-cesion-turno/:id/rechazar", requireAdmin, async (req, res) => {
  try {
    await ensureSolicitudesSchema();

    const id = Number(req.params.id);

    const solicitud = await get(
      "SELECT * FROM solicitudes_cesion_turno WHERE id = ?",
      [id]
    );

    if (!solicitud) {
      return fail(res, new Error("Solicitud no encontrada"), 404);
    }

    if (solicitud.estado !== "pendiente") {
      return fail(res, new Error("Esta solicitud ya fue gestionada"), 400);
    }

    await run(
      `
      UPDATE solicitudes_cesion_turno
      SET estado = 'rechazado',
          updated_at = ?
      WHERE id = ?
      `,
      [fechaActualSql(), id]
    );

    const row = await get(
      "SELECT * FROM solicitudes_cesion_turno WHERE id = ?",
      [id]
    );

    return ok(res, row);
  } catch (error) {
    return fail(res, error);
  }
});

/* ============================================================================
   SOLICITUDES HORARIO
============================================================================ */
app.get("/solicitudes-horario", requireAuth, async (req, res) => {
  try {
    await ensureSolicitudesSchema();

    const medicoId = Number(req.auth?.medico_id);
    const filtroMedico = isAdminRol(req.auth?.rol)
      ? { where: "", params: [] }
      : { where: "WHERE medico_id = ?", params: [medicoId] };

    const rows = await all(
      `
      SELECT *
      FROM solicitudes_horario
      ${filtroMedico.where}
      ORDER BY datetime(fecha_solicitud) DESC, id DESC
      `,
      filtroMedico.params
    );

    return ok(res, rows);
  } catch (error) {
    return fail(res, error);
  }
});

app.post("/solicitudes-horario", requireAuth, async (req, res) => {
  try {
    await ensureSolicitudesSchema();

    const medico_id = Number(req.body.medico_id || req.body.medico_solicitante_id);
    const year = req.body.year ? Number(req.body.year) : null;
    const mes = req.body.mes ? Number(req.body.mes) : null;
    const mes_programacion = req.body.mes_programacion
      ? Number(req.body.mes_programacion)
      : mes;
    const mensaje = cleanText(req.body.mensaje);
    const estado = "pendiente";

    if (!medico_id || !mensaje) {
      return fail(res, new Error("MÃ©dico y mensaje son obligatorios"), 400);
    }

    if (!canManageMedico(req, medico_id)) {
      return fail(res, new Error("No puedes solicitar horarios a nombre de otro mÃ©dico"), 403);
    }

    const medico = await get("SELECT id FROM medicos WHERE id = ? AND activo = 1", [
      medico_id,
    ]);

    if (!medico) {
      return fail(res, new Error("MÃ©dico no encontrado"), 404);
    }

    const result = await insertDynamic("solicitudes_horario", {
      medico_id,
      medico_solicitante_id: medico_id,
      year,
      anio: year,
      mes,
      mes_programacion,
      mensaje,
      estado,
      fecha_solicitud: fechaActualSql(),
      created_at: fechaActualSql(),
      updated_at: fechaActualSql(),
    });

    const row = await get("SELECT * FROM solicitudes_horario WHERE id = ?", [
      result.id,
    ]);

    return ok(res, row);
  } catch (error) {
    return fail(res, error);
  }
});

app.put("/solicitudes-horario/:id/aprobar", requireAdmin, async (req, res) => {
  try {
    await ensureSolicitudesSchema();

    const id = Number(req.params.id);

    const solicitud = await get("SELECT * FROM solicitudes_horario WHERE id = ?", [
      id,
    ]);

    if (!solicitud) {
      return fail(res, new Error("Solicitud no encontrada"), 404);
    }

    if (solicitud.estado !== "pendiente") {
      return fail(res, new Error("Esta solicitud ya fue gestionada"), 400);
    }

    await run(
      `
      UPDATE solicitudes_horario
      SET estado = 'aprobado',
          updated_at = ?
      WHERE id = ?
      `,
      [fechaActualSql(), id]
    );

    const row = await get("SELECT * FROM solicitudes_horario WHERE id = ?", [
      id,
    ]);

    return ok(res, row);
  } catch (error) {
    return fail(res, error);
  }
});

app.put("/solicitudes-horario/:id/rechazar", requireAdmin, async (req, res) => {
  try {
    await ensureSolicitudesSchema();

    const id = Number(req.params.id);

    const solicitud = await get("SELECT * FROM solicitudes_horario WHERE id = ?", [
      id,
    ]);

    if (!solicitud) {
      return fail(res, new Error("Solicitud no encontrada"), 404);
    }

    if (solicitud.estado !== "pendiente") {
      return fail(res, new Error("Esta solicitud ya fue gestionada"), 400);
    }

    await run(
      `
      UPDATE solicitudes_horario
      SET estado = 'rechazado',
          updated_at = ?
      WHERE id = ?
      `,
      [fechaActualSql(), id]
    );

    const row = await get("SELECT * FROM solicitudes_horario WHERE id = ?", [
      id,
    ]);

    return ok(res, row);
  } catch (error) {
    return fail(res, error);
  }
});

/* ============================================================================
   FALLBACK
============================================================================ */
app.use((req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada",
    method: req.method,
    path: req.originalUrl,
  });
});

/* ============================================================================
   START
============================================================================ */
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor TurnosMed corriendo en puerto ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Error inicializando base de datos:", err);
    process.exit(1);
  });

