package cl.vigia.app.reminders

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.util.Log
import cl.vigia.app.AudioEvents
import cl.vigia.app.MainActivity
import cl.vigia.app.voice.Speaker

// Recordatorios, alarmas y temporizadores (ADR-009): SQLite es la fuente de verdad y AlarmManager los hace sonar
// aunque la app esté cerrada. Tras reiniciar, BootReceiver llama a rescheduleAll(). La lógica de qué decir vive en TS.

data class Reminder(val id: Long, val text: String, val at: Long, val kind: String)

private class Db(context: Context) : SQLiteOpenHelper(context, "vigia.db", null, 1) {
  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL("CREATE TABLE reminders (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, at INTEGER NOT NULL, kind TEXT NOT NULL, fired INTEGER NOT NULL DEFAULT 0)")
    db.execSQL("CREATE INDEX reminders_at ON reminders(at)")
  }
  // Migraciones futuras: un bloque por versión, sin perder datos.
  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {}
}

object Reminders {
  private const val TAG = "VigiaMetrics"
  private const val EXTRA_ID = "reminderId"
  @Volatile private var db: Db? = null
  /** Último aviso, para mostrarlo si la pantalla se abre después de que sonó. */
  @Volatile var lastAnnouncement: String? = null
    private set

  private fun db(context: Context): SQLiteDatabase =
    (db ?: synchronized(this) { db ?: Db(context.applicationContext).also { db = it } }).writableDatabase

  fun add(context: Context, text: String, at: Long, kind: String): Reminder {
    val id = db(context).insert("reminders", null, ContentValues().apply { put("text", text); put("at", at); put("kind", kind) })
    val reminder = Reminder(id, text, at, kind)
    schedule(context, reminder)
    log("reminder_add id=$id kind=$kind at=$at")
    return reminder
  }

  /** Pendientes (no sonados), por hora. */
  fun list(context: Context): List<Reminder> =
    db(context).rawQuery("SELECT id, text, at, kind FROM reminders WHERE fired = 0 ORDER BY at", null).use { c ->
      buildList { while (c.moveToNext()) add(Reminder(c.getLong(0), c.getString(1), c.getLong(2), c.getString(3))) }
    }

  fun remove(context: Context, id: Long) {
    alarms(context).cancel(pending(context, id))
    db(context).delete("reminders", "id = ?", arrayOf(id.toString()))
    log("reminder_remove id=$id")
  }

  /** Tras reiniciar: AlarmManager olvidó las alarmas. Las vencidas durante el apagado suenan de inmediato. */
  fun rescheduleAll(context: Context) {
    val pending = list(context)
    pending.forEach { schedule(context, it) }
    log("reminders_rescheduled n=${pending.size}")
  }

  private fun schedule(context: Context, reminder: Reminder) {
    val at = maxOf(reminder.at, System.currentTimeMillis() + 1000)
    // setAlarmClock: exacta, exenta de Doze y sin permiso especial en Android 11 (ADR-009).
    alarms(context).setAlarmClock(AlarmManager.AlarmClockInfo(at, null), pending(context, reminder.id))
  }

  internal fun fire(context: Context, id: Long) {
    val reminder = db(context).rawQuery("SELECT id, text, at, kind FROM reminders WHERE id = ? AND fired = 0", arrayOf(id.toString())).use { c ->
      if (c.moveToFirst()) Reminder(c.getLong(0), c.getString(1), c.getLong(2), c.getString(3)) else null
    } ?: return
    db(context).update("reminders", ContentValues().apply { put("fired", 1) }, "id = ?", arrayOf(id.toString()))
    val late = System.currentTimeMillis() - reminder.at
    log("reminder_fire id=$id kind=${reminder.kind} lateMs=$late")
    val message = when (reminder.kind) {
      "timer" -> "Se terminó el temporizador."
      "alarm" -> "Es hora de despertar."
      else -> if (late > 120_000) "Tenías un recordatorio: ${reminder.text}." else "Recordatorio: ${reminder.text}."
    }
    announce(context, message, ring = reminder.kind != "reminder")
  }

  // Recordatorio: muestra el texto sobre el bloqueo y lo dice dos veces.
  // Alarma y temporizador: suenan a pulsos hasta que se detienen con la voz, el botón o a los 2 min (Ringer).
  private fun announce(context: Context, message: String, ring: Boolean) {
    val app = context.applicationContext
    Speaker.init(app)
    // La pantalla principal muestra el aviso bajo la esfera (y el botón Detener si suena).
    lastAnnouncement = message
    MainActivity.bringToFront(app)
    AudioEvents.send("announce", "text" to message, "ringing" to ring)
    if (!ring) {
      Speaker.say(message) { Speaker.say(message) {} }
      return
    }
    Ringer.start(app) { Speaker.say("Listo.") {} }
  }

  private fun alarms(context: Context) = context.getSystemService(AlarmManager::class.java)

  private fun pending(context: Context, id: Long): PendingIntent = PendingIntent.getBroadcast(
    context, id.toInt(),
    Intent(context, ReminderReceiver::class.java).putExtra(EXTRA_ID, id),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
  )

  private fun log(event: String) = Log.i(TAG, "t=${System.currentTimeMillis()} $event")

  class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      val id = intent.getLongExtra(EXTRA_ID, -1)
      if (id >= 0) fire(context, id)
    }
  }
}
