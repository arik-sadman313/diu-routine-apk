import { dbService } from './databaseService';
import type {
  VersionsResponse,
  RoutineVersion,
  OptionsResponse,
  ClassesResponse,
  SearchResponse,
  UploadResponse,
  OverrideRequest,
} from '../types/api';

/**
 * Port of Python src/course_parser.py _parse_batch_section() +
 * src/json_importer.py RoutineJSONClass.derive_group_info().
 *
 * Derives batch, section, subgroup, special_group from the group_code stored
 * in the canonical JSON format (which has NO batch/section fields).
 *
 * Python regex: ^(\d+)_([A-Za-z]+?)(\d*)$
 *   batch    = group 1  (leading digits)
 *   section  = group 2  (letters, non-greedy)
 *   subgroup = group 3  (trailing digits, empty string → null)
 *
 * RE_ groups: special_group = full group_code, batch/section = null.
 *
 * Examples:
 *   '66_E'       → batch='66', section='E',  subgroup=null,  special_group=null
 *   '65_A1'      → batch='65', section='A',  subgroup='1',   special_group=null
 *   '65_H2'      → batch='65', section='H',  subgroup='2',   special_group=null
 *   'RE_B(3C)'   → batch=null, section=null, subgroup=null,  special_group='RE_B(3C)'
 */
function parseBatchSection(groupCode: string): {
  batch: string | null;
  section: string | null;
  subgroup: string | null;
  special_group: string | null;
} {
  // RE_ groups → special_group only, no batch/section
  if (groupCode.startsWith('RE_')) {
    return { batch: null, section: null, subgroup: null, special_group: groupCode };
  }

  // Standard numeric batch groups: e.g. 66_E, 65_A1, 65_H2
  const m = /^(\d+)_([A-Za-z]+?)(\d*)$/.exec(groupCode);
  if (m) {
    const batch = m[1];
    const section = m[2].toUpperCase();
    const subgroup = m[3] !== '' ? m[3] : null;
    return { batch, section, subgroup, special_group: null };
  }

  // Groups with parentheses not starting with RE_ (e.g. future formats)
  if (groupCode.includes('(') || groupCode.includes(')')) {
    return { batch: null, section: null, subgroup: null, special_group: groupCode };
  }

  // Unrecognised format: store as-is, no batch/section
  return { batch: null, section: null, subgroup: null, special_group: null };
}

class LocalRepository {
  async getVersions(): Promise<VersionsResponse> {
    const db = dbService.getDb();
    const result = await db.query('SELECT * FROM routine_versions ORDER BY id DESC');
    return { versions: result.values || [] };
  }

  async getVersion(id: number): Promise<RoutineVersion> {
    const db = dbService.getDb();
    const result = await db.query('SELECT * FROM routine_versions WHERE id = ?', [id]);
    if (!result.values || result.values.length === 0) {
      throw new Error('Routine version not found');
    }
    return result.values[0] as RoutineVersion;
  }

  async getOptions(versionId?: number): Promise<OptionsResponse> {
    const db = dbService.getDb();
    let version = versionId;
    if (!version) {
      const vResult = await db.query('SELECT id FROM routine_versions ORDER BY id DESC LIMIT 1');
      if (vResult.values && vResult.values.length > 0) {
        version = vResult.values[0].id;
      } else {
        throw new Error('No routine imported');
      }
    }

    const getValues = async (column: string) => {
      const res = await db.query(`SELECT DISTINCT ${column} FROM effective_classes WHERE routine_version_id=? AND record_type != 'hidden' AND ${column} IS NOT NULL AND ${column} != '' ORDER BY ${column}`, [version]);
      return (res.values || []).map((r: any) => r[column]);
    };

    const pairsRes = await db.query(`SELECT DISTINCT batch, section FROM effective_classes WHERE routine_version_id=? AND record_type != 'hidden' AND batch IS NOT NULL AND section IS NOT NULL ORDER BY CAST(batch AS INTEGER), section`, [version]);
    
    return {
      version_id: version!,
      batches: await getValues('batch'),
      sections: await getValues('section'),
      courses: await getValues('course_code'),
      teachers: await getValues('teacher'),
      rooms: await getValues('room'),
      groups: await getValues('group_code'),
      batch_sections: (pairsRes.values || []).map((r: any) => ({ batch: r.batch, section: r.section }))
    };
  }

  async getRoutine(batch: string, section: string, versionId?: number): Promise<ClassesResponse> {
    const db = dbService.getDb();
    let version = versionId;
    if (!version) {
      const vResult = await db.query('SELECT id FROM routine_versions ORDER BY id DESC LIMIT 1');
      if (vResult.values && vResult.values.length > 0) version = vResult.values[0].id;
      else throw new Error('No routine imported');
    }

    const res = await db.query(`
      SELECT id, record_type, page, day, start_time, end_time, room, course_code,
             group_code, batch, section, subgroup, special_group, teacher
      FROM effective_classes 
      WHERE routine_version_id=? 
        AND UPPER(batch)=UPPER(?) 
        AND UPPER(section)=UPPER(?)
        AND record_type != 'hidden'
      ORDER BY CASE day
        WHEN 'Saturday' THEN 1 WHEN 'Sunday' THEN 2 WHEN 'Monday' THEN 3
        WHEN 'Tuesday' THEN 4 WHEN 'Wednesday' THEN 5 WHEN 'Thursday' THEN 6
        WHEN 'Friday' THEN 7 ELSE 99 END,
        start_time, room, course_code, group_code LIMIT 5000
    `, [version, batch, section]);

    return {
      version_id: version!,
      count: res.values?.length || 0,
      classes: res.values || []
    };
  }

  async search(query: string, versionId?: number): Promise<SearchResponse> {
    const db = dbService.getDb();
    let version = versionId;
    if (!version) {
      const vResult = await db.query('SELECT id FROM routine_versions ORDER BY id DESC LIMIT 1');
      if (vResult.values && vResult.values.length > 0) version = vResult.values[0].id;
      else throw new Error('No routine imported');
    }

    const pattern = `%${query}%`;
    const res = await db.query(`
      SELECT id, record_type, page, day, start_time, end_time, room, course_code,
             group_code, batch, section, subgroup, special_group, teacher
      FROM effective_classes
      WHERE routine_version_id=?
        AND (course_code LIKE ? 
             OR group_code LIKE ? 
             OR batch LIKE ? 
             OR section LIKE ? 
             OR teacher LIKE ? 
             OR room LIKE ?)
        AND record_type != 'hidden'
      ORDER BY CASE day
        WHEN 'Saturday' THEN 1 WHEN 'Sunday' THEN 2 WHEN 'Monday' THEN 3
        WHEN 'Tuesday' THEN 4 WHEN 'Wednesday' THEN 5 WHEN 'Thursday' THEN 6
        WHEN 'Friday' THEN 7 ELSE 99 END,
        start_time LIMIT 100
    `, [version, pattern, pattern, pattern, pattern, pattern, pattern]);

    return {
      version_id: version!,
      query,
      count: res.values?.length || 0,
      classes: res.values || []
    };
  }

  async saveOverride(versionId: number, payload: OverrideRequest): Promise<{ status: string }> {
    const db = dbService.getDb();
    
    await db.beginTransaction();
    try {
      if (payload.target_class_id !== undefined && payload.target_class_id !== null && payload.target_class_id > 0) {
        // transaction=false: we own the transaction via beginTransaction()
        await db.run("DELETE FROM personal_overrides WHERE routine_version_id=? AND target_class_id=?", [versionId, payload.target_class_id], false);
        
        if (payload.override_type === 'hidden') {
          await db.run(
            "INSERT INTO personal_overrides (routine_version_id, target_class_id, override_type) VALUES (?, ?, ?)",
            [versionId, payload.target_class_id, 'hidden'],
            false
          );
        } else {
          await db.run(
            `INSERT INTO personal_overrides 
             (routine_version_id, target_class_id, override_type, day, start_time, end_time, room, course_code, group_code, batch, section, subgroup, special_group, teacher)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [versionId, payload.target_class_id, payload.override_type, payload.day, payload.start_time, payload.end_time, payload.room, payload.course_code, payload.group_code, payload.batch, payload.section, payload.subgroup, payload.special_group, payload.teacher],
            false
          );
        }
      } else {
        if (payload.target_class_id !== undefined && payload.target_class_id !== null && payload.target_class_id < 0) {
          await db.run("DELETE FROM personal_overrides WHERE routine_version_id=? AND id=? AND override_type='manually_added'", [versionId, -payload.target_class_id], false);
        }
        await db.run(
          `INSERT INTO personal_overrides 
           (routine_version_id, override_type, day, start_time, end_time, room, course_code, group_code, batch, section, subgroup, special_group, teacher)
           VALUES (?, 'manually_added', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [versionId, payload.day, payload.start_time, payload.end_time, payload.room, payload.course_code, payload.group_code, payload.batch, payload.section, payload.subgroup, payload.special_group, payload.teacher],
          false
        );
      }
      await db.commitTransaction();
      return { status: 'success' };
    } catch (e) {
      await db.rollbackTransaction();
      throw e;
    }
  }

  async deleteOverride(versionId: number, classId: number): Promise<{ status: string }> {
    const db = dbService.getDb();
    if (classId > 0) {
      await db.run("DELETE FROM personal_overrides WHERE routine_version_id=? AND target_class_id=?", [versionId, classId]);
    } else {
      await db.run("DELETE FROM personal_overrides WHERE routine_version_id=? AND id=? AND override_type='manually_added'", [versionId, -classId]);
    }
    return { status: 'success' };
  }

  async deleteRoutine(versionId: number): Promise<{ status: string }> {
    const db = dbService.getDb();
    
    await db.beginTransaction();
    try {
      // Due to PRAGMA foreign_keys = ON, deleting from routine_versions will safely cascade and delete 
      // all associated classes and personal_overrides.
      await db.run("DELETE FROM routine_versions WHERE id=?", [versionId], false);
      await db.commitTransaction();
      return { status: 'success' };
    } catch (e) {
      await db.rollbackTransaction();
      throw e;
    }
  }

  async getCustomCourses(): Promise<{ courses: { course_code: string; course_name: string }[] }> {
    const db = dbService.getDb();
    const result = await db.query("SELECT course_code, course_name FROM custom_courses ORDER BY course_code");
    return { courses: (result.values as any[]) || [] };
  }

  async addCustomCourse(payload: { course_code: string; course_name: string }): Promise<{ status: string }> {
    const db = dbService.getDb();
    const code = payload.course_code.trim().toUpperCase();
    const name = payload.course_name.trim();
    if (!code || !name) throw new Error("Course code and name cannot be empty.");
    
    // SQLite doesn't have ON CONFLICT DO UPDATE without a UNIQUE constraint properly setup sometimes,
    // so we can use INSERT OR REPLACE which is functionally equivalent since course_code is PRIMARY KEY.
    await db.run(
      "INSERT OR REPLACE INTO custom_courses (course_code, course_name, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
      [code, name]
    );
    return { status: 'success' };
  }

  async deleteCustomCourse(courseCode: string): Promise<{ status: string }> {
    const db = dbService.getDb();
    await db.run("DELETE FROM custom_courses WHERE course_code=?", [courseCode.toUpperCase()]);
    return { status: 'success' };
  }

  async importJson(jsonContent: any): Promise<UploadResponse> {
    if (jsonContent.format !== 'diu-routine-v1' || !Array.isArray(jsonContent.classes)) {
      throw new Error("Invalid format. Only 'diu-routine-v1' is supported.");
    }
    
    // Hash computation
    const str = JSON.stringify(jsonContent);
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const db = dbService.getDb();
    
    // Check duplicate (no transaction needed for a read)
    const dupCheck = await db.query('SELECT id FROM routine_versions WHERE file_hash = ?', [hashHex]);
    if (dupCheck.values && dupCheck.values.length > 0) {
      throw { status: 409, message: 'Routine already exists.', data: { version_id: dupCheck.values[0].id } };
    }

    // Use the dedicated Capacitor SQLite transaction API.
    // db.execute('BEGIN TRANSACTION') is WRONG: execute() auto-wraps in its own
    // transaction (transaction=true by default), causing a nested-transaction error.
    // db.run() inside a manual transaction must pass transaction=false for the same reason.
    await db.beginTransaction();
    try {
      const now = new Date().toISOString();
      // transaction=false: we own the transaction via beginTransaction()
      const res = await db.run(
        `INSERT INTO routine_versions (name, source_filename, semester, created_at, pages_processed, record_count, warning_count, repair_count, file_hash) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `Imported Routine ${now.split('T')[0]}`,
          'imported.json',
          jsonContent.semester || null,
          now,
          1,
          jsonContent.classes.length,
          0,
          0,
          hashHex
        ],
        false
      );
      
      const versionId = res.changes?.lastId;
      
      // Batch insert classes — all within the same open transaction.
      // IMPORTANT: The canonical JSON format does NOT carry batch/section fields.
      // We must derive them from group_code here, exactly as Python's
      // json_importer.py RoutineJSONClass.derive_group_info() does.
      let i = 0;
      for (const c of jsonContent.classes) {
        i++;
        // Derive batch/section/subgroup/special_group from group_code
        const derived = parseBatchSection(c.group_code || '');
        // Prefer explicit fields if present (round-tripped exports may include them)
        const batch        = c.batch         ?? derived.batch;
        const section      = c.section       ?? derived.section;
        const subgroup     = c.subgroup      ?? derived.subgroup;
        const special_group = c.special_group ?? derived.special_group;

        await db.run(
          `INSERT INTO classes (routine_version_id, source_record_id, page, day, start_time, end_time, room, course_code, group_code, batch, section, subgroup, special_group, teacher)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            versionId,
            `json-${i}`,
            1,
            c.day,
            c.start_time,
            c.end_time,
            c.room || '',
            c.course_code,
            c.group_code || '',
            batch,
            section,
            subgroup,
            special_group,
            c.teacher || ''
          ],
          false
        );
      }
      
      await db.commitTransaction();
      
      return {
        status: 'success',
        message: 'Import successful',
        version_id: versionId!,
        semester: jsonContent.semester || null,
        record_count: jsonContent.classes.length,
        pages_processed: 1,
        warning_count: 0,
        repair_count: 0,
        unresolved: [],
        repairs: [],
        warnings: []
      };
    } catch (e) {
      await db.rollbackTransaction();
      throw e;
    }
  }

  async exportJson(versionId: number): Promise<any> {
    const db = dbService.getDb();
    
    // Get version info
    const vRes = await db.query('SELECT semester FROM routine_versions WHERE id=?', [versionId]);
    if (!vRes.values || vRes.values.length === 0) throw new Error("Version not found");
    const semester = vRes.values[0].semester;

    // Get effective classes
    const cRes = await db.query(`
      SELECT course_code, group_code, teacher, room, day, start_time, end_time
      FROM effective_classes WHERE routine_version_id=? AND record_type != 'hidden'
      ORDER BY id
    `, [versionId]);
    
    return {
      format: "diu-routine-v1",
      semester: semester || null,
      department: null,
      classes: cRes.values || []
    };
  }

  async checkDuplicateJson(jsonContent: any): Promise<boolean> {
    if (jsonContent.format !== 'diu-routine-v1' || !Array.isArray(jsonContent.classes)) {
      return false;
    }
    const str = JSON.stringify(jsonContent);
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const db = dbService.getDb();
    const dupCheck = await db.query('SELECT id FROM routine_versions WHERE file_hash = ?', [hashHex]);
    return !!(dupCheck.values && dupCheck.values.length > 0);
  }
}

export const localRepository = new LocalRepository();
