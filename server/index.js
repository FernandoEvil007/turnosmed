const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const dbPath = process.env.DB_PATH || path.join(__dirname, "turnosmed.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error abriendo la base de datos:", err.message);
  } else {
    console.log("Base de datos SQLite conectada");
  }
});

/* ============================================================================
   HELPERS SQLITE
============================================================================ */
function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({
        lastID: this.lastID,
        changes: this.changes,
      });
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function withTransaction(callback) {
  await runAsync("BEGIN TRANSACTION");
  try {
    const result = await callback();
    await runAsync("COMMIT");
    return result;
  } catch (error) {
    try {
      await runAsync("ROLLBACK");
    } catch (rollbackErr) {
      console.error("Error en rollback:", rollbackErr.message);
    }
    throw error;
  }
}

function texto(v) {
  return String(v || "").trim();
}

function numero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function validarTipoTurno(tipo) {
  return ["DIA", "CENIZO", "FDS"].includes(tipo);
}

function validarRol(rol) {
  return ["medico", "coordinador"].includes(rol);
}

function validarFecha(fecha) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(fecha || ""));
}

function validarEmail(email) {
  if (!email) return true;
  return /^\S+@\S+\.\S+$/.test(email);
}

function horasPorTipoTurno(tipo) {
  if (tipo === "DIA") return 8;
  if (tipo === "CENIZO") return 3;
  if (tipo === "FDS") return 6;
  return 0;
}

async function obtenerTurnosDia(medicoId, fecha) {
  return allAsync(
    "SELECT * FROM turnos WHERE medico_id = ? AND fecha = ? ORDER BY id ASC",
    [medicoId, fecha]
  );
}

function validarCombinacionTurnos(tiposActuales = [], tipoNuevo) {
  if (tiposActuales.includes(tipoNuevo)) {
    return { ok: false, error: "Ese turno ya está cargado en ese día" };
  }

  if (tiposActuales.length >= 2) {
    return { ok: false, error: "No se pueden cargar más de 2 turnos por día" };
  }

  if (tipoNuevo === "FDS" && tiposActuales.length > 0) {
    return { ok: false, error: "FDS no puede combinarse con otros turnos" };
  }

  if (tiposActuales.includes("FDS")) {
    return { ok: false, error: "Si ya existe FDS, no se puede agregar otro turno" };
  }

  return { ok: true };
}

async function existeMedico(id) {
  const row = await getAsync("SELECT id FROM medicos WHERE id = ? LIMIT 1", [id]);
  return !!row;
}

async function existeUsuarioPorUsername(username) {
  const row = await getAsync("SELECT id FROM usuarios WHERE username = ? LIMIT 1", [username]);
  return !!row;
}

async function getSolicitudCambio(id) {
  return getAsync("SELECT * FROM solicitudes_cambio_turno WHERE id = ? LIMIT 1", [id]);
}

async function getSolicitudCesion(id) {
  return getAsync("SELECT * FROM solicitudes_cesion_turno WHERE id = ? LIMIT 1", [id]);
}

/* ============================================================================
   INIT / MIGRACION
============================================================================ */
async function initDatabase() {
  await runAsync(`
    CREATE TABLE IF NOT EXISTS medicos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      documento TEXT NOT NULL UNIQUE,
      tipo_doc TEXT,
      especialidad TEXT,
      registro_medico TEXT,
      telefono TEXT,
      email TEXT,
      fecha_ingreso TEXT,
      cargo TEXT,
      color TEXT
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL,
      medico_id INTEGER
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS solicitudes_cambio_turno (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medico_solicitante_id INTEGER NOT NULL,
      medico_destino_id INTEGER NOT NULL,
      fecha_solicitante TEXT NOT NULL,
      fecha_destino TEXT NOT NULL,
      turno_solicitante TEXT NOT NULL,
      turno_destino TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      nota TEXT,
      fecha_solicitud TEXT NOT NULL
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS solicitudes_cesion_turno (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medico_solicitante_id INTEGER NOT NULL,
      medico_destino_id INTEGER NOT NULL,
      fecha_turno TEXT NOT NULL,
      turno TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      nota TEXT,
      fecha_solicitud TEXT NOT NULL
    )
  `);

  const turnosSchema = await getAsync(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'turnos'"
  );

  if (!turnosSchema) {
    await runAsync(`
      CREATE TABLE IF NOT EXISTS turnos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        medico_id INTEGER NOT NULL,
        fecha TEXT NOT NULL,
        tipo_turno TEXT NOT NULL,
        UNIQUE(medico_id, fecha, tipo_turno)
      )
    `);
  } else {
    const sql = String(turnosSchema.sql || "");
    const usaEsquemaViejo =
      sql.includes("UNIQUE(medico_id, fecha)") &&
      !sql.includes("UNIQUE(medico_id, fecha, tipo_turno)");

    if (usaEsquemaViejo) {
      console.log("Migrando tabla turnos al nuevo esquema...");
      await withTransaction(async () => {
        await runAsync("ALTER TABLE turnos RENAME TO turnos_old");

        await runAsync(`
          CREATE TABLE turnos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            medico_id INTEGER NOT NULL,
            fecha TEXT NOT NULL,
            tipo_turno TEXT NOT NULL,
            UNIQUE(medico_id, fecha, tipo_turno)
          )
        `);

        await runAsync(`
          INSERT OR IGNORE INTO turnos (medico_id, fecha, tipo_turno)
          SELECT medico_id, fecha, tipo_turno
          FROM turnos_old
        `);

        await runAsync("DROP TABLE turnos_old");
      });
      console.log("Migración de turnos completada");
    }
  }

  await runAsync(`
    CREATE TABLE IF NOT EXISTS horas_adicionales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medico_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      horas REAL NOT NULL DEFAULT 0,
      motivo TEXT,
      UNIQUE(medico_id, fecha)
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS configuracion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clave TEXT NOT NULL UNIQUE,
      valor TEXT NOT NULL,
      actualizado_en TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runAsync(`
    INSERT INTO configuracion (clave, valor)
    VALUES ('tarifa_hora', '119800')
    ON CONFLICT(clave) DO NOTHING
  `);

  const coordinador = await getAsync(
    "SELECT id FROM usuarios WHERE username = ? LIMIT 1",
    ["admin"]
  );

  if (!coordinador) {
    const passwordHash = await bcrypt.hash("admin123", 10);
    await runAsync(
      `
      INSERT INTO usuarios (username, password_hash, rol, medico_id)
      VALUES (?, ?, ?, ?)
      `,
      ["admin", passwordHash, "coordinador", null]
    );
    console.log("Usuario coordinador inicial creado: admin / admin123");
  }
}

/* ============================================================================
   MEDICOS
============================================================================ */
app.get("/medicos", async (req, res) => {
  try {
    const rows = await allAsync("SELECT * FROM medicos ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/medicos", async (req, res) => {
  try {
    const nombre = texto(req.body.nombre);
    const apellido = texto(req.body.apellido);
    const documento = texto(req.body.documento);
    const tipo_doc = texto(req.body.tipo_doc);
    const especialidad = texto(req.body.especialidad);
    const registro_medico = texto(req.body.registro_medico);
    const telefono = texto(req.body.telefono);
    const email = texto(req.body.email);
    const fecha_ingreso = texto(req.body.fecha_ingreso);
    const cargo = texto(req.body.cargo);
    const color = texto(req.body.color);

    if (!nombre || !apellido || !documento) {
      return res.status(400).json({ error: "Faltan campos obligatorios del médico" });
    }

    if (email && !validarEmail(email)) {
      return res.status(400).json({ error: "Correo electrónico inválido" });
    }

    const existe = await getAsync(
      "SELECT id FROM medicos WHERE documento = ? LIMIT 1",
      [documento]
    );

    if (existe) {
      return res.status(400).json({ error: "Ya existe un médico con ese documento" });
    }

    const result = await runAsync(
      `
      INSERT INTO medicos
      (nombre, apellido, documento, tipo_doc, especialidad, registro_medico, telefono, email, fecha_ingreso, cargo, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
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
      ]
    );

    res.json({
      id: result.lastID,
      message: "Médico guardado correctamente",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/medicos/:id", async (req, res) => {
  try {
    const id = numero(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const nombre = texto(req.body.nombre);
    const apellido = texto(req.body.apellido);
    const documento = texto(req.body.documento);
    const tipo_doc = texto(req.body.tipo_doc);
    const especialidad = texto(req.body.especialidad);
    const registro_medico = texto(req.body.registro_medico);
    const telefono = texto(req.body.telefono);
    const email = texto(req.body.email);
    const fecha_ingreso = texto(req.body.fecha_ingreso);
    const cargo = texto(req.body.cargo);
    const color = texto(req.body.color);

    const medico = await getAsync("SELECT * FROM medicos WHERE id = ? LIMIT 1", [id]);
    if (!medico) {
      return res.status(404).json({ error: "Médico no encontrado" });
    }

    if (email && !validarEmail(email)) {
      return res.status(400).json({ error: "Correo electrónico inválido" });
    }

    const otroConDocumento = await getAsync(
      "SELECT id FROM medicos WHERE documento = ? AND id <> ? LIMIT 1",
      [documento, id]
    );

    if (otroConDocumento) {
      return res.status(400).json({ error: "Ya existe otro médico con ese documento" });
    }

    const result = await runAsync(
      `
      UPDATE medicos
      SET
        nombre = ?,
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
        id,
      ]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: "Médico no encontrado" });
    }

    res.json({
      message: "Médico actualizado correctamente",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/medicos/:id", async (req, res) => {
  try {
    const id = numero(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const medico = await getAsync("SELECT id FROM medicos WHERE id = ? LIMIT 1", [id]);
    if (!medico) {
      return res.status(404).json({ error: "Médico no encontrado" });
    }

    await withTransaction(async () => {
      await runAsync("DELETE FROM turnos WHERE medico_id = ?", [id]);
      await runAsync("DELETE FROM horas_adicionales WHERE medico_id = ?", [id]);
      await runAsync("DELETE FROM usuarios WHERE medico_id = ?", [id]);
      await runAsync(
        "DELETE FROM solicitudes_cambio_turno WHERE medico_solicitante_id = ? OR medico_destino_id = ?",
        [id, id]
      );
      await runAsync(
        "DELETE FROM solicitudes_cesion_turno WHERE medico_solicitante_id = ? OR medico_destino_id = ?",
        [id, id]
      );
      await runAsync("DELETE FROM medicos WHERE id = ?", [id]);
    });

    res.json({
      message: "Médico eliminado correctamente",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================================
   USUARIOS
============================================================================ */
app.get("/usuarios", async (req, res) => {
  try {
    const rows = await allAsync(
      "SELECT id, username, rol, medico_id FROM usuarios ORDER BY id DESC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/usuarios", async (req, res) => {
  try {
    const username = texto(req.body.username);
    const password = texto(req.body.password);
    const rol = texto(req.body.rol);
    const medico_id = req.body.medico_id ? numero(req.body.medico_id) : null;

    if (!username || !password || !rol) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    if (!validarRol(rol)) {
      return res.status(400).json({ error: "Rol inválido" });
    }

    if (rol === "medico" && !medico_id) {
      return res.status(400).json({ error: "El usuario médico debe tener medico_id" });
    }

    if (rol === "medico") {
      const medicoExiste = await existeMedico(medico_id);
      if (!medicoExiste) {
        return res.status(400).json({ error: "El medico_id no existe" });
      }

      const usuarioMedico = await getAsync(
        "SELECT id FROM usuarios WHERE medico_id = ? AND rol = 'medico' LIMIT 1",
        [medico_id]
      );

      if (usuarioMedico) {
        return res.status(400).json({ error: "Ese médico ya tiene usuario creado" });
      }
    }

    const existe = await existeUsuarioPorUsername(username);
    if (existe) {
      return res.status(400).json({ error: "Ya existe un usuario con ese username" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await runAsync(
      `
      INSERT INTO usuarios (username, password_hash, rol, medico_id)
      VALUES (?, ?, ?, ?)
      `,
      [username, password_hash, rol, medico_id || null]
    );

    res.json({
      id: result.lastID,
      message: "Usuario creado correctamente",
    });
  } catch (error) {
    res.status(500).json({ error: "Error creando usuario" });
  }
});

app.put("/usuarios/:id/reset-password", async (req, res) => {
  try {
    const id = numero(req.params.id);
    const nuevaPassword = texto(req.body.nuevaPassword);

    if (!id) {
      return res.status(400).json({ error: "ID inválido" });
    }

    if (!nuevaPassword) {
      return res.status(400).json({ error: "La nueva contraseña es obligatoria" });
    }

    const usuario = await getAsync("SELECT id FROM usuarios WHERE id = ? LIMIT 1", [id]);
    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const password_hash = await bcrypt.hash(nuevaPassword, 10);

    await runAsync("UPDATE usuarios SET password_hash = ? WHERE id = ?", [
      password_hash,
      id,
    ]);

    res.json({
      message: "Contraseña actualizada correctamente",
    });
  } catch (error) {
    res.status(500).json({ error: "Error actualizando contraseña" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const username = texto(req.body.username);
    const password = texto(req.body.password);

    if (!username || !password) {
      return res.status(400).json({ error: "Usuario y contraseña son obligatorios" });
    }

    const usuario = await getAsync(
      "SELECT * FROM usuarios WHERE username = ? LIMIT 1",
      [username]
    );

    if (!usuario) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    }

    const coincide = await bcrypt.compare(password, usuario.password_hash);

    if (!coincide) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    }

    res.json({
      message: "Login correcto",
      usuario: {
        id: usuario.id,
        username: usuario.username,
        rol: usuario.rol,
        medico_id: usuario.medico_id,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Error validando credenciales" });
  }
});

/* ============================================================================
   CONFIGURACION GLOBAL
============================================================================ */
app.get("/configuracion/tarifa-hora", async (req, res) => {
  try {
    const row = await getAsync(
      "SELECT valor FROM configuracion WHERE clave = 'tarifa_hora' LIMIT 1"
    );

    const tarifaHora = row ? Number(row.valor) || 119800 : 119800;

    res.json({ tarifaHora });
  } catch (error) {
    res.status(500).json({ error: "No se pudo obtener la tarifa por hora" });
  }
});

app.put("/configuracion/tarifa-hora", async (req, res) => {
  try {
    const tarifaHora = numero(req.body.tarifaHora);

    if (!tarifaHora || tarifaHora <= 0) {
      return res.status(400).json({ error: "Tarifa por hora inválida" });
    }

    await runAsync(
      `
      INSERT INTO configuracion (clave, valor, actualizado_en)
      VALUES ('tarifa_hora', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(clave)
      DO UPDATE SET
        valor = excluded.valor,
        actualizado_en = CURRENT_TIMESTAMP
      `,
      [String(tarifaHora)]
    );

    res.json({
      ok: true,
      tarifaHora,
      message: "Tarifa por hora actualizada correctamente",
    });
  } catch (error) {
    res.status(500).json({ error: "No se pudo actualizar la tarifa por hora" });
  }
});

/* ============================================================================
   TURNOS
============================================================================ */
app.get("/turnos", async (req, res) => {
  try {
    const rows = await allAsync(
      "SELECT * FROM turnos ORDER BY fecha ASC, medico_id ASC, id ASC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/turnos", async (req, res) => {
  try {
    const medico_id = numero(req.body.medico_id);
    const fecha = texto(req.body.fecha);
    const tipo_turno = texto(req.body.tipo_turno);

    if (!medico_id || !fecha || !tipo_turno) {
      return res.status(400).json({ error: "Faltan campos obligatorios del turno" });
    }

    if (!validarFecha(fecha)) {
      return res.status(400).json({ error: "Fecha inválida" });
    }

    if (!validarTipoTurno(tipo_turno)) {
      return res.status(400).json({ error: "Tipo de turno inválido" });
    }

    const medicoExiste = await existeMedico(medico_id);
    if (!medicoExiste) {
      return res.status(400).json({ error: "El médico no existe" });
    }

    const turnosDia = await obtenerTurnosDia(medico_id, fecha);
    const validacion = validarCombinacionTurnos(
      turnosDia.map((t) => t.tipo_turno),
      tipo_turno
    );

    if (!validacion.ok) {
      return res.status(400).json({ error: validacion.error });
    }

    await runAsync(
      `
      INSERT INTO turnos (medico_id, fecha, tipo_turno)
      VALUES (?, ?, ?)
      `,
      [medico_id, fecha, tipo_turno]
    );

    const turnosActualizados = await obtenerTurnosDia(medico_id, fecha);

    res.json({
      message: "Turno guardado correctamente",
      turnos: turnosActualizados,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/turnos", async (req, res) => {
  try {
    const medico_id = numero(req.body.medico_id);
    const fecha = texto(req.body.fecha);
    const tipo_turno = texto(req.body.tipo_turno);

    if (!medico_id || !fecha || !tipo_turno) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const result = await runAsync(
      "DELETE FROM turnos WHERE medico_id = ? AND fecha = ? AND tipo_turno = ?",
      [medico_id, fecha, tipo_turno]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: "Turno no encontrado" });
    }

    res.json({ message: "Turno eliminado correctamente" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================================
   HORAS ADICIONALES
============================================================================ */
app.get("/horas-adicionales", async (req, res) => {
  try {
    const rows = await allAsync(
      "SELECT * FROM horas_adicionales ORDER BY fecha ASC, medico_id ASC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/horas-adicionales", async (req, res) => {
  try {
    const medico_id = numero(req.body.medico_id);
    const fecha = texto(req.body.fecha);
    const horas = Number(req.body.horas || 0);
    const motivo = texto(req.body.motivo);

    if (!medico_id || !fecha) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    if (!validarFecha(fecha)) {
      return res.status(400).json({ error: "Fecha inválida" });
    }

    if (Number.isNaN(horas) || horas < 0) {
      return res.status(400).json({ error: "Horas adicionales inválidas" });
    }

    const medicoExiste = await existeMedico(medico_id);
    if (!medicoExiste) {
      return res.status(400).json({ error: "El médico no existe" });
    }

    await runAsync(
      `
      INSERT INTO horas_adicionales (medico_id, fecha, horas, motivo)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(medico_id, fecha)
      DO UPDATE SET
        horas = excluded.horas,
        motivo = excluded.motivo
      `,
      [medico_id, fecha, horas, motivo]
    );

    res.json({
      message: "Horas adicionales guardadas correctamente",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================================
   SOLICITUDES CAMBIO DE TURNO
============================================================================ */
app.get("/solicitudes-cambio-turno", async (req, res) => {
  try {
    const rows = await allAsync(
      "SELECT * FROM solicitudes_cambio_turno ORDER BY id DESC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/solicitudes-cambio-turno", async (req, res) => {
  try {
    const medico_solicitante_id = numero(req.body.medico_solicitante_id);
    const medico_destino_id = numero(req.body.medico_destino_id);
    const fecha_solicitante = texto(req.body.fecha_solicitante);
    const fecha_destino = texto(req.body.fecha_destino);
    const turno_solicitante = texto(req.body.turno_solicitante);
    const turno_destino = texto(req.body.turno_destino);
    const nota = texto(req.body.nota);
    const fecha_solicitud = texto(req.body.fecha_solicitud);

    if (
      !medico_solicitante_id ||
      !medico_destino_id ||
      !fecha_solicitante ||
      !fecha_destino ||
      !turno_solicitante ||
      !turno_destino ||
      !fecha_solicitud
    ) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    if (medico_solicitante_id === medico_destino_id) {
      return res.status(400).json({ error: "No puedes solicitar cambio contigo mismo" });
    }

    if (!validarTipoTurno(turno_solicitante) || !validarTipoTurno(turno_destino)) {
      return res.status(400).json({ error: "Tipo de turno inválido" });
    }

    const turnoSolicitanteReal = await getAsync(
      "SELECT * FROM turnos WHERE medico_id = ? AND fecha = ? AND tipo_turno = ? LIMIT 1",
      [medico_solicitante_id, fecha_solicitante, turno_solicitante]
    );

    if (!turnoSolicitanteReal) {
      return res.status(400).json({
        error: "El médico solicitante no tiene ese turno guardado en esa fecha",
      });
    }

    const turnoDestinoReal = await getAsync(
      "SELECT * FROM turnos WHERE medico_id = ? AND fecha = ? AND tipo_turno = ? LIMIT 1",
      [medico_destino_id, fecha_destino, turno_destino]
    );

    if (!turnoDestinoReal) {
      return res.status(400).json({
        error: "El médico destino no tiene ese turno guardado en esa fecha",
      });
    }

    const result = await runAsync(
      `
      INSERT INTO solicitudes_cambio_turno (
        medico_solicitante_id,
        medico_destino_id,
        fecha_solicitante,
        fecha_destino,
        turno_solicitante,
        turno_destino,
        nota,
        fecha_solicitud
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        medico_solicitante_id,
        medico_destino_id,
        fecha_solicitante,
        fecha_destino,
        turno_solicitante,
        turno_destino,
        nota || "",
        fecha_solicitud,
      ]
    );

    res.json({
      id: result.lastID,
      message: "Solicitud de cambio de turno guardada correctamente",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/solicitudes-cambio-turno/:id/aprobar", async (req, res) => {
  try {
    const id = numero(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const solicitud = await getSolicitudCambio(id);

    if (!solicitud) {
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }

    if (solicitud.estado !== "pendiente") {
      return res.status(400).json({ error: "La solicitud ya fue procesada" });
    }

    await withTransaction(async () => {
      const turnoSolicitanteActual = await getAsync(
        "SELECT * FROM turnos WHERE medico_id = ? AND fecha = ? AND tipo_turno = ? LIMIT 1",
        [solicitud.medico_solicitante_id, solicitud.fecha_solicitante, solicitud.turno_solicitante]
      );

      const turnoDestinoActual = await getAsync(
        "SELECT * FROM turnos WHERE medico_id = ? AND fecha = ? AND tipo_turno = ? LIMIT 1",
        [solicitud.medico_destino_id, solicitud.fecha_destino, solicitud.turno_destino]
      );

      if (!turnoSolicitanteActual || !turnoDestinoActual) {
        throw new Error("No se pudo aprobar: uno de los turnos ya no existe");
      }

      const tiposSolicitanteDestino = (
        await obtenerTurnosDia(solicitud.medico_solicitante_id, solicitud.fecha_destino)
      ).map((t) => t.tipo_turno);

      const tiposDestinoSolicitante = (
        await obtenerTurnosDia(solicitud.medico_destino_id, solicitud.fecha_solicitante)
      ).map((t) => t.tipo_turno);

      const validacionA = validarCombinacionTurnos(tiposSolicitanteDestino, solicitud.turno_destino);
      const validacionB = validarCombinacionTurnos(tiposDestinoSolicitante, solicitud.turno_solicitante);

      if (!validacionA.ok) throw new Error(validacionA.error);
      if (!validacionB.ok) throw new Error(validacionB.error);

      await runAsync(
        "DELETE FROM turnos WHERE medico_id = ? AND fecha = ? AND tipo_turno = ?",
        [solicitud.medico_solicitante_id, solicitud.fecha_solicitante, solicitud.turno_solicitante]
      );

      await runAsync(
        "DELETE FROM turnos WHERE medico_id = ? AND fecha = ? AND tipo_turno = ?",
        [solicitud.medico_destino_id, solicitud.fecha_destino, solicitud.turno_destino]
      );

      await runAsync(
        `
        INSERT INTO turnos (medico_id, fecha, tipo_turno)
        VALUES (?, ?, ?)
        `,
        [solicitud.medico_solicitante_id, solicitud.fecha_destino, solicitud.turno_destino]
      );

      await runAsync(
        `
        INSERT INTO turnos (medico_id, fecha, tipo_turno)
        VALUES (?, ?, ?)
        `,
        [solicitud.medico_destino_id, solicitud.fecha_solicitante, solicitud.turno_solicitante]
      );

      await runAsync(
        "UPDATE solicitudes_cambio_turno SET estado = 'aprobado' WHERE id = ?",
        [id]
      );
    });

    res.json({
      message: "Cambio de turno aprobado y aplicado correctamente",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/solicitudes-cambio-turno/:id/rechazar", async (req, res) => {
  try {
    const id = numero(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const result = await runAsync(
      "UPDATE solicitudes_cambio_turno SET estado = 'rechazado' WHERE id = ? AND estado = 'pendiente'",
      [id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: "Solicitud no encontrada o ya procesada" });
    }

    res.json({
      message: "Solicitud rechazada correctamente",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================================
   SOLICITUDES CESION DE TURNO
============================================================================ */
app.get("/solicitudes-cesion-turno", async (req, res) => {
  try {
    const rows = await allAsync(
      "SELECT * FROM solicitudes_cesion_turno ORDER BY id DESC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/solicitudes-cesion-turno", async (req, res) => {
  try {
    const medico_solicitante_id = numero(req.body.medico_solicitante_id);
    const medico_destino_id = numero(req.body.medico_destino_id);
    const fecha_turno = texto(req.body.fecha_turno);
    const turno = texto(req.body.turno);
    const nota = texto(req.body.nota);
    const fecha_solicitud = texto(req.body.fecha_solicitud);

    if (!medico_solicitante_id || !medico_destino_id || !fecha_turno || !turno || !fecha_solicitud) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    if (medico_solicitante_id === medico_destino_id) {
      return res.status(400).json({ error: "No puedes cederte un turno a ti mismo" });
    }

    if (!validarTipoTurno(turno)) {
      return res.status(400).json({ error: "Tipo de turno inválido" });
    }

    const turnoReal = await getAsync(
      "SELECT * FROM turnos WHERE medico_id = ? AND fecha = ? AND tipo_turno = ? LIMIT 1",
      [medico_solicitante_id, fecha_turno, turno]
    );

    if (!turnoReal) {
      return res.status(400).json({
        error: "El médico solicitante no tiene ese turno guardado en esa fecha",
      });
    }

    const result = await runAsync(
      `
      INSERT INTO solicitudes_cesion_turno (
        medico_solicitante_id,
        medico_destino_id,
        fecha_turno,
        turno,
        nota,
        fecha_solicitud
      )
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        medico_solicitante_id,
        medico_destino_id,
        fecha_turno,
        turno,
        nota || "",
        fecha_solicitud,
      ]
    );

    res.json({
      id: result.lastID,
      message: "Solicitud de cesión de turno guardada correctamente",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/solicitudes-cesion-turno/:id/aprobar", async (req, res) => {
  try {
    const id = numero(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const solicitud = await getSolicitudCesion(id);

    if (!solicitud) {
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }

    if (solicitud.estado !== "pendiente") {
      return res.status(400).json({ error: "La solicitud ya fue procesada" });
    }

    await withTransaction(async () => {
      const turnoActual = await getAsync(
        "SELECT * FROM turnos WHERE medico_id = ? AND fecha = ? AND tipo_turno = ? LIMIT 1",
        [solicitud.medico_solicitante_id, solicitud.fecha_turno, solicitud.turno]
      );

      if (!turnoActual) {
        throw new Error("No se pudo aprobar: el turno ya no existe");
      }

      const turnosDestino = (
        await obtenerTurnosDia(solicitud.medico_destino_id, solicitud.fecha_turno)
      ).map((t) => t.tipo_turno);

      const validacion = validarCombinacionTurnos(turnosDestino, solicitud.turno);

      if (!validacion.ok) {
        throw new Error(validacion.error);
      }

      await runAsync(
        "DELETE FROM turnos WHERE medico_id = ? AND fecha = ? AND tipo_turno = ?",
        [solicitud.medico_solicitante_id, solicitud.fecha_turno, solicitud.turno]
      );

      await runAsync(
        `
        INSERT INTO turnos (medico_id, fecha, tipo_turno)
        VALUES (?, ?, ?)
        `,
        [solicitud.medico_destino_id, solicitud.fecha_turno, solicitud.turno]
      );

      await runAsync(
        "UPDATE solicitudes_cesion_turno SET estado = 'aprobado' WHERE id = ?",
        [id]
      );
    });

    res.json({
      message: "Cesión de turno aprobada y aplicada correctamente",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/solicitudes-cesion-turno/:id/rechazar", async (req, res) => {
  try {
    const id = numero(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const result = await runAsync(
      "UPDATE solicitudes_cesion_turno SET estado = 'rechazado' WHERE id = ? AND estado = 'pendiente'",
      [id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: "Solicitud no encontrada o ya procesada" });
    }

    res.json({
      message: "Solicitud de cesión rechazada correctamente",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/bootstrap-coordinador", async (req, res) => {
  try {
    const username = "admin";
    const passwordPlano = "Admin123*";
    const passwordHash = await bcrypt.hash(passwordPlano, 10);

    db.get(
      "SELECT id FROM usuarios WHERE username = ?",
      [username],
      (err, row) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        if (row) {
          return res.json({
            ok: true,
            mensaje: "El usuario coordinador ya existe",
            username,
          });
        }

        db.run(
          "INSERT INTO usuarios (username, password, rol, medico_id) VALUES (?, ?, ?, NULL)",
          [username, passwordHash, "coordinador"],
          function (err2) {
            if (err2) {
              return res.status(500).json({ error: err2.message });
            }

            return res.json({
              ok: true,
              mensaje: "Coordinador creado correctamente",
              username,
              passwordTemporal: passwordPlano,
            });
          }
        );
      }
    );
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

/* ============================================================================
   START
============================================================================ */
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Error inicializando la base de datos:", err.message);
    process.exit(1);
  });