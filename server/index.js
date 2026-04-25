const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "database.sqlite");

const ADMIN_CEDULA_FIJA = "6662672";
const ADMIN_PASSWORD_FIJA = "6662672";

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
        resolve(row);
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
    await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function ok(res, data) {
  return res.json(data);
}

function fail(res, error, status = 500) {
  console.error(error);

  return res.status(status).json({
    error: error?.message || "Ocurrió un error con el servidor",
  });
}

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeRol(rol) {
  const r = cleanText(rol).toLowerCase();

  if (r === "administrador") return "coordinador";
  if (r === "admin") return "coordinador";
  if (r === "coordinador") return "coordinador";
  if (r === "medico") return "medico";
  if (r === "médico") return "medico";

  return r || "medico";
}

function normalizeEstado(estado) {
  const e = cleanText(estado).toLowerCase();

  if (e === "aprobado") return "aprobado";
  if (e === "rechazado") return "rechazado";

  return "pendiente";
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
  };
}

function fechaActualSql() {
  return new Date().toISOString();
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
  await ensureColumn("medicos", "activo", "INTEGER DEFAULT 1");
  await ensureColumn("medicos", "created_at", "TEXT DEFAULT CURRENT_TIMESTAMP");

  await ensureColumn("usuarios", "medico_id", "INTEGER");
  await ensureColumn("usuarios", "cedula", "TEXT");
  await ensureColumn("usuarios", "nombre", "TEXT");
  await ensureColumn("usuarios", "activo", "INTEGER DEFAULT 1");
  await ensureColumn("usuarios", "created_at", "TEXT DEFAULT CURRENT_TIMESTAMP");

  await ensureColumn("turnos", "created_at", "TEXT DEFAULT CURRENT_TIMESTAMP");

  await ensureColumn("horas_adicionales", "motivo", "TEXT");
  await ensureColumn("horas_adicionales", "created_at", "TEXT DEFAULT CURRENT_TIMESTAMP");
  await ensureColumn("horas_adicionales", "updated_at", "TEXT");

  await ensureColumn("solicitudes_cambio_turno", "mensaje", "TEXT");
  await ensureColumn("solicitudes_cambio_turno", "estado", "TEXT DEFAULT 'pendiente'");
  await ensureColumn(
    "solicitudes_cambio_turno",
    "fecha_solicitud",
    "TEXT DEFAULT CURRENT_TIMESTAMP"
  );
  await ensureColumn("solicitudes_cambio_turno", "updated_at", "TEXT");

  await ensureColumn("solicitudes_cesion_turno", "mensaje", "TEXT");
  await ensureColumn("solicitudes_cesion_turno", "estado", "TEXT DEFAULT 'pendiente'");
  await ensureColumn(
    "solicitudes_cesion_turno",
    "fecha_solicitud",
    "TEXT DEFAULT CURRENT_TIMESTAMP"
  );
  await ensureColumn("solicitudes_cesion_turno", "updated_at", "TEXT");

  await ensureColumn("solicitudes_horario", "year", "INTEGER");
  await ensureColumn("solicitudes_horario", "mes", "INTEGER");
  await ensureColumn("solicitudes_horario", "mes_programacion", "INTEGER");
  await ensureColumn("solicitudes_horario", "estado", "TEXT DEFAULT 'pendiente'");
  await ensureColumn(
    "solicitudes_horario",
    "fecha_solicitud",
    "TEXT DEFAULT CURRENT_TIMESTAMP"
  );
  await ensureColumn("solicitudes_horario", "updated_at", "TEXT");

  const configTarifa = await get(
    "SELECT clave, valor FROM configuracion WHERE clave = ?",
    ["tarifa_hora"]
  );

  if (!configTarifa) {
    await run(
      "INSERT INTO configuracion (clave, valor, updated_at) VALUES (?, ?, ?)",
      ["tarifa_hora", "119800", fechaActualSql()]
    );
  }

  console.log("Tablas verificadas correctamente");
}

initDB().catch((err) => {
  console.error("Error inicializando base de datos:", err);
});

/* ============================================================================
   HEALTH
============================================================================ */
app.get("/", (req, res) => {
  res.json({
    ok: true,
    app: "TurnosMed Backend",
    status: "running",
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    status: "healthy",
    database: DB_PATH,
  });
});

/* ============================================================================
   LOGIN
============================================================================ */
app.post("/login", async (req, res) => {
  try {
    const username = cleanText(req.body.username);
    const password = cleanText(req.body.password);

    if (!username || !password) {
      return fail(res, new Error("Usuario y contraseña son obligatorios"), 400);
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

    if (!usuario || usuario.password !== password) {
      return fail(res, new Error("Usuario o contraseña incorrectos"), 401);
    }

    return ok(res, {
      usuario: publicUser(usuario),
    });
  } catch (error) {
    return fail(res, error);
  }
});

app.post("/login-admin", async (req, res) => {
  try {
    const cedula = cleanText(req.body.cedula);
    const password = cleanText(req.body.password);

    if (!cedula || !password) {
      return fail(res, new Error("Cédula y contraseña son obligatorias"), 400);
    }

    if (cedula === ADMIN_CEDULA_FIJA && password === ADMIN_PASSWORD_FIJA) {
      return ok(res, {
        usuario: {
          id: 0,
          username: "Fernando Rodriguez Bayona",
          nombre: "Fernando Rodriguez Bayona",
          rol: "coordinador",
          medico_id: null,
          cedula: ADMIN_CEDULA_FIJA,
          activo: 1,
          admin_fijo: true,
        },
      });
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

    if (!usuario || usuario.password !== password) {
      return fail(res, new Error("Administrador no válido"), 401);
    }

    return ok(res, {
      usuario: {
        ...publicUser(usuario),
        rol: "coordinador",
      },
    });
  } catch (error) {
    return fail(res, error);
  }
});

app.post("/login-admin-cedula", async (req, res) => {
  try {
    const cedula = cleanText(req.body.cedula);

    if (!cedula) {
      return fail(res, new Error("Cédula obligatoria"), 400);
    }

    if (cedula === ADMIN_CEDULA_FIJA) {
      return ok(res, {
        usuario: {
          id: 0,
          username: "Fernando Rodriguez Bayona",
          nombre: "Fernando Rodriguez Bayona",
          rol: "coordinador",
          medico_id: null,
          cedula: ADMIN_CEDULA_FIJA,
          activo: 1,
          admin_fijo: true,
        },
      });
    }

    const usuario = await get(
      `
      SELECT *
      FROM usuarios
      WHERE activo = 1
        AND cedula = ?
        AND (rol = 'coordinador' OR rol = 'administrador' OR rol = 'admin')
      `,
      [cedula]
    );

    if (!usuario) {
      return fail(res, new Error("Administrador no válido"), 401);
    }

    return ok(res, {
      usuario: {
        ...publicUser(usuario),
        rol: "coordinador",
      },
    });
  } catch (error) {
    return fail(res, error);
  }
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

app.post("/medicos", async (req, res) => {
  try {
    const payload = {
      nombre: cleanText(req.body.nombre),
      apellido: cleanText(req.body.apellido),
      documento: cleanText(req.body.documento),
      tipo_doc: cleanText(req.body.tipo_doc) || "CC",
      especialidad: cleanText(req.body.especialidad),
      registro_medico: cleanText(req.body.registro_medico),
      telefono: cleanText(req.body.telefono),
      email: cleanText(req.body.email),
      fecha_ingreso: cleanText(req.body.fecha_ingreso),
      cargo: cleanText(req.body.cargo),
      color: cleanText(req.body.color) || "#4f8ef7",
    };

    if (!payload.nombre || !payload.apellido || !payload.documento) {
      return fail(res, new Error("Nombre, apellido y documento son obligatorios"), 400);
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
        activo
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
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
      ]
    );

    const medico = await get("SELECT * FROM medicos WHERE id = ?", [result.id]);

    return ok(res, medico);
  } catch (error) {
    if (String(error.message || "").includes("UNIQUE")) {
      return fail(res, new Error("Ya existe un médico con ese documento"), 400);
    }

    return fail(res, error);
  }
});

app.put("/medicos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return fail(res, new Error("ID inválido"), 400);
    }

    const payload = {
      nombre: cleanText(req.body.nombre),
      apellido: cleanText(req.body.apellido),
      documento: cleanText(req.body.documento),
      tipo_doc: cleanText(req.body.tipo_doc) || "CC",
      especialidad: cleanText(req.body.especialidad),
      registro_medico: cleanText(req.body.registro_medico),
      telefono: cleanText(req.body.telefono),
      email: cleanText(req.body.email),
      fecha_ingreso: cleanText(req.body.fecha_ingreso),
      cargo: cleanText(req.body.cargo),
      color: cleanText(req.body.color) || "#4f8ef7",
    };

    if (!payload.nombre || !payload.apellido || !payload.documento) {
      return fail(res, new Error("Nombre, apellido y documento son obligatorios"), 400);
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
          color = ?
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
        id,
      ]
    );

    const medico = await get("SELECT * FROM medicos WHERE id = ?", [id]);

    return ok(res, medico);
  } catch (error) {
    if (String(error.message || "").includes("UNIQUE")) {
      return fail(res, new Error("Ya existe un médico con ese documento"), 400);
    }

    return fail(res, error);
  }
});

app.delete("/medicos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return fail(res, new Error("ID inválido"), 400);
    }

    await run("DELETE FROM turnos WHERE medico_id = ?", [id]);
    await run("DELETE FROM horas_adicionales WHERE medico_id = ?", [id]);

    await run(
      `
      UPDATE usuarios
      SET medico_id = NULL,
          activo = 0
      WHERE medico_id = ?
      `,
      [id]
    );

    await run("UPDATE medicos SET activo = 0 WHERE id = ?", [id]);

    return ok(res, {
      ok: true,
      message: "Médico eliminado correctamente",
    });
  } catch (error) {
    return fail(res, error);
  }
});

/* ============================================================================
   USUARIOS
============================================================================ */
app.get("/usuarios", async (req, res) => {
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

app.post("/usuarios", async (req, res) => {
  try {
    const username = cleanText(req.body.username);
    const password = cleanText(req.body.password);
    const rol = normalizeRol(req.body.rol);
    const medico_id = req.body.medico_id ? Number(req.body.medico_id) : null;
    const cedula = cleanText(req.body.cedula);
    const nombre = cleanText(req.body.nombre);

    if (!username || !password) {
      return fail(res, new Error("Usuario y contraseña son obligatorios"), 400);
    }

    if (rol === "medico" && !medico_id) {
      return fail(res, new Error("El usuario médico debe estar vinculado a un médico"), 400);
    }

    const result = await run(
      `
      INSERT INTO usuarios (
        username,
        password,
        rol,
        medico_id,
        cedula,
        nombre,
        activo
      )
      VALUES (?, ?, ?, ?, ?, ?, 1)
      `,
      [
        username,
        password,
        rol,
        medico_id,
        cedula || null,
        nombre || null,
      ]
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

app.put("/usuarios/:id/reset-password", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const nuevaPassword = cleanText(req.body.nuevaPassword || req.body.password);

    if (!id || !nuevaPassword) {
      return fail(res, new Error("Usuario y nueva contraseña son obligatorios"), 400);
    }

    await run(
      `
      UPDATE usuarios
      SET password = ?
      WHERE id = ?
      `,
      [nuevaPassword, id]
    );

    return ok(res, {
      ok: true,
      message: "Contraseña actualizada correctamente",
    });
  } catch (error) {
    return fail(res, error);
  }
});

app.delete("/usuarios/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return fail(res, new Error("ID inválido"), 400);
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

app.post("/turnos", async (req, res) => {
  try {
    const medico_id = Number(req.body.medico_id);
    const fecha = cleanText(req.body.fecha);
    const tipo_turno = cleanText(req.body.tipo_turno);

    if (!medico_id || !fecha || !tipo_turno) {
      return fail(res, new Error("Médico, fecha y tipo de turno son obligatorios"), 400);
    }

    await run(
      `
      INSERT OR IGNORE INTO turnos (
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

app.delete("/turnos", async (req, res) => {
  try {
    const medico_id = Number(req.body.medico_id);
    const fecha = cleanText(req.body.fecha);
    const tipo_turno = cleanText(req.body.tipo_turno);

    if (!medico_id || !fecha || !tipo_turno) {
      return fail(res, new Error("Médico, fecha y tipo de turno son obligatorios"), 400);
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

app.delete("/turnos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return fail(res, new Error("ID inválido"), 400);
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

app.post("/horas-adicionales", async (req, res) => {
  try {
    const medico_id = Number(req.body.medico_id);
    const fecha = cleanText(req.body.fecha);
    const horas = Number(req.body.horas || 0);
    const motivo = cleanText(req.body.motivo);

    if (!medico_id || !fecha) {
      return fail(res, new Error("Médico y fecha son obligatorios"), 400);
    }

    if (Number.isNaN(horas) || horas < 0) {
      return fail(res, new Error("Horas adicionales inválidas"), 400);
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
      await run(
        "INSERT INTO configuracion (clave, valor, updated_at) VALUES (?, ?, ?)",
        ["tarifa_hora", "119800", fechaActualSql()]
      );

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

app.put("/configuracion/tarifa-hora", async (req, res) => {
  try {
    const tarifaHora = Number(req.body.tarifaHora || req.body.valor);

    if (!tarifaHora || tarifaHora <= 0) {
      return fail(res, new Error("Tarifa por hora inválida"), 400);
    }

    const existente = await get(
      `
      SELECT *
      FROM configuracion
      WHERE clave = ?
      `,
      ["tarifa_hora"]
    );

    if (existente) {
      await run(
        `
        UPDATE configuracion
        SET valor = ?,
            updated_at = ?
        WHERE clave = ?
        `,
        [String(tarifaHora), fechaActualSql(), "tarifa_hora"]
      );
    } else {
      await run(
        `
        INSERT INTO configuracion (
          clave,
          valor,
          updated_at
        )
        VALUES (?, ?, ?)
        `,
        ["tarifa_hora", String(tarifaHora), fechaActualSql()]
      );
    }

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
app.get("/solicitudes-cambio-turno", async (req, res) => {
  try {
    const rows = await all(
      `
      SELECT *
      FROM solicitudes_cambio_turno
      ORDER BY datetime(fecha_solicitud) DESC, id DESC
      `
    );

    return ok(res, rows);
  } catch (error) {
    return fail(res, error);
  }
});

app.post("/solicitudes-cambio-turno", async (req, res) => {
  try {
    const medico_solicitante_id = Number(
      req.body.medico_solicitante_id || req.body.medico_id
    );
    const medico_destino_id = Number(req.body.medico_destino_id);
    const fecha_origen = cleanText(req.body.fecha_origen);
    const tipo_turno_origen = cleanText(req.body.tipo_turno_origen);
    const fecha_destino = cleanText(req.body.fecha_destino);
    const tipo_turno_destino = cleanText(req.body.tipo_turno_destino);
    const mensaje = cleanText(req.body.mensaje);
    const estado = normalizeEstado(req.body.estado);

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

    const result = await run(
      `
      INSERT INTO solicitudes_cambio_turno (
        medico_solicitante_id,
        medico_destino_id,
        fecha_origen,
        tipo_turno_origen,
        fecha_destino,
        tipo_turno_destino,
        mensaje,
        estado,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        medico_solicitante_id,
        medico_destino_id,
        fecha_origen,
        tipo_turno_origen,
        fecha_destino,
        tipo_turno_destino,
        mensaje,
        estado,
        fechaActualSql(),
      ]
    );

    const row = await get(
      "SELECT * FROM solicitudes_cambio_turno WHERE id = ?",
      [result.id]
    );

    return ok(res, row);
  } catch (error) {
    return fail(res, error);
  }
});

app.put("/solicitudes-cambio-turno/:id/aprobar", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const solicitud = await get(
      "SELECT * FROM solicitudes_cambio_turno WHERE id = ?",
      [id]
    );

    if (!solicitud) {
      return fail(res, new Error("Solicitud no encontrada"), 404);
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
        INSERT OR IGNORE INTO turnos (
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
        INSERT OR IGNORE INTO turnos (
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

app.put("/solicitudes-cambio-turno/:id/rechazar", async (req, res) => {
  try {
    const id = Number(req.params.id);

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
app.get("/solicitudes-cesion-turno", async (req, res) => {
  try {
    const rows = await all(
      `
      SELECT *
      FROM solicitudes_cesion_turno
      ORDER BY datetime(fecha_solicitud) DESC, id DESC
      `
    );

    return ok(res, rows);
  } catch (error) {
    return fail(res, error);
  }
});

app.post("/solicitudes-cesion-turno", async (req, res) => {
  try {
    const medico_solicitante_id = Number(
      req.body.medico_solicitante_id || req.body.medico_id
    );
    const medico_receptor_id = Number(req.body.medico_receptor_id);
    const fecha = cleanText(req.body.fecha);
    const tipo_turno = cleanText(req.body.tipo_turno);
    const mensaje = cleanText(req.body.mensaje);
    const estado = normalizeEstado(req.body.estado);

    if (!medico_solicitante_id || !medico_receptor_id || !fecha || !tipo_turno) {
      return fail(res, new Error("Datos incompletos para solicitud de cesión"), 400);
    }

    const result = await run(
      `
      INSERT INTO solicitudes_cesion_turno (
        medico_solicitante_id,
        medico_receptor_id,
        fecha,
        tipo_turno,
        mensaje,
        estado,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        medico_solicitante_id,
        medico_receptor_id,
        fecha,
        tipo_turno,
        mensaje,
        estado,
        fechaActualSql(),
      ]
    );

    const row = await get(
      "SELECT * FROM solicitudes_cesion_turno WHERE id = ?",
      [result.id]
    );

    return ok(res, row);
  } catch (error) {
    return fail(res, error);
  }
});

app.put("/solicitudes-cesion-turno/:id/aprobar", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const solicitud = await get(
      "SELECT * FROM solicitudes_cesion_turno WHERE id = ?",
      [id]
    );

    if (!solicitud) {
      return fail(res, new Error("Solicitud no encontrada"), 404);
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
        INSERT OR IGNORE INTO turnos (
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

app.put("/solicitudes-cesion-turno/:id/rechazar", async (req, res) => {
  try {
    const id = Number(req.params.id);

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
app.get("/solicitudes-horario", async (req, res) => {
  try {
    const rows = await all(
      `
      SELECT *
      FROM solicitudes_horario
      ORDER BY datetime(fecha_solicitud) DESC, id DESC
      `
    );

    return ok(res, rows);
  } catch (error) {
    return fail(res, error);
  }
});

app.post("/solicitudes-horario", async (req, res) => {
  try {
    const medico_id = Number(req.body.medico_id || req.body.medico_solicitante_id);
    const year = req.body.year ? Number(req.body.year) : null;
    const mes = req.body.mes ? Number(req.body.mes) : null;
    const mes_programacion = req.body.mes_programacion
      ? Number(req.body.mes_programacion)
      : mes;
    const mensaje = cleanText(req.body.mensaje);
    const estado = normalizeEstado(req.body.estado);

    if (!medico_id || !mensaje) {
      return fail(res, new Error("Médico y mensaje son obligatorios"), 400);
    }

    const result = await run(
      `
      INSERT INTO solicitudes_horario (
        medico_id,
        year,
        mes,
        mes_programacion,
        mensaje,
        estado,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        medico_id,
        year,
        mes,
        mes_programacion,
        mensaje,
        estado,
        fechaActualSql(),
      ]
    );

    const row = await get("SELECT * FROM solicitudes_horario WHERE id = ?", [
      result.id,
    ]);

    return ok(res, row);
  } catch (error) {
    return fail(res, error);
  }
});

app.put("/solicitudes-horario/:id/aprobar", async (req, res) => {
  try {
    const id = Number(req.params.id);

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

app.put("/solicitudes-horario/:id/rechazar", async (req, res) => {
  try {
    const id = Number(req.params.id);

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
app.listen(PORT, () => {
  console.log(`Servidor TurnosMed corriendo en puerto ${PORT}`);
});