const { z } = require('zod');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const excelStudents = require('../services/excelStudents');



const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional().default(''),
  className: z.string().optional().default(''),
  houseColor: z.string().optional().default(''),
  kitStatus: z.enum(['pending', 'ordered', '']).optional().default(''),
  isActive: z.enum(['true', 'false', '']).optional().default(''),
  sortBy: z.enum([
    'admission_number',
    'student_name',
    'parent_name',
    'class_name',
    'house_color',
    'created_at',
    'kit_status',
  ]).optional().default('admission_number'),
  sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
});



const studentBodySchema = z.object({
  admissionNumber: z.string().trim().min(1).max(50),
  studentName: z.string().trim().min(1).max(150),
  parentName: z.string().trim().min(1).max(150),
  address1: z.string().trim().min(1).max(255),
  address2: z.string().max(255).optional().default(''),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  zipcode: z.string().trim().min(1).max(10),
  houseColor: z.string().trim().min(1).max(30),
  phone: z.string().max(20).nullable().optional(),
  isActive: z.boolean().optional().default(true),

  className: z.string().trim().max(50).nullable().optional(),
  age: z.preprocess(
  (value) =>
    value === '' || value === null
      ? null
      : value,
  z.coerce.number().int().min(0).max(120).nullable().optional()
),
  // age: z.coerce.number().int().min(0).max(120).nullable().optional(),
  gender: z.enum(['Male', 'Female', 'Other', '']).nullable().optional(),
  email: z.union([
  z.literal(''),
  z.string().trim().email(),
]).nullable().optional(),
});



function mapStudent(row) {
  if (!row) return null;

  return {
    id: row.id,
    admissionNumber: row.admission_number,
    studentName: row.student_name,
    parentName: row.parent_name,
    className: row.class_name,
    age: row.age,
    gender: row.gender,
    email: row.email,
    address1: row.address1,
    address2: row.address2,
    city: row.city,
    state: row.state,
    zipcode: row.zipcode,
    houseColor: row.house_color,
    phone: row.phone,
    kitStatus: row.kit_status,
    catalogOverride: row.catalog_override,
    isActive: Boolean(row.is_active),
    firstLoginAt: row.first_login_at,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}


async function listStudents(req, res, next) {
  try {
    const q = listQuerySchema.parse(req.query);
    const query = db('students').select('*');

    if (q.search.trim()) {
      const search = `%${q.search.trim()}%`;

      query.where((builder) => {
        builder
          .where('admission_number', 'like', search)
          .orWhere('student_name', 'like', search)
          .orWhere('parent_name', 'like', search)
          .orWhere('class_name', 'like', search)
          .orWhere('gender', 'like', search)
          .orWhereRaw(
            'CAST(age AS CHAR) LIKE ?',
            [search]
          );
      });
    }

    if (q.className) {
      query.where('class_name', q.className);
    }

    if (q.houseColor) {
      query.where('house_color', q.houseColor);
    }

    if (q.kitStatus) {
      query.where('kit_status', q.kitStatus);
    }

    if (q.isActive === 'true') {
      query.where('is_active', 1);
    }

    if (q.isActive === 'false') {
      query.where('is_active', 0);
    }

    const countRow = await query
      .clone()
      .clearSelect()
      .count({ total: '*' })
      .first();

    const total = Number(countRow?.total || 0);

    const rows = await query
      .orderBy(q.sortBy, q.sortDir)
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize);

    res.json({
      success: true,
      data: {
        items: rows.map(mapStudent),
        pagination: {
          page: q.page,
          pageSize: q.pageSize,
          total,
          totalPages: Math.ceil(total / q.pageSize) || 1,
        },
      },
    });
  } catch (err) {
    next(
      err.name === 'ZodError'
        ? new AppError('Validation failed', 400, err.issues)
        : err
    );
  }
}


async function listStudentClasses(req, res, next) {
  try {
    const rows = await db('students')
      .distinct('class_name')
      .whereNotNull('class_name')
      .where('class_name', '<>', '');

    const classes = rows
      .map((row) => row.class_name)
      .sort((a, b) =>
        String(a).localeCompare(String(b), undefined, {
          numeric: true,
        })
      );

    res.json({
      success: true,
      data: {
        items: classes,
      },
    });
  } catch (err) {
    next(err);
  }
}


async function getStudent(req, res, next) {
  try {
    const student = await db('students')
      .where({ id: req.params.id })
      .first();

    if (!student) {
      throw new AppError('Student not found', 404);
    }

    const orders = await db('orders')
      .where({ student_id: student.id })
      .orderBy('created_at', 'desc')
      .limit(50);

    const extras = await db('student_extra_fields')
      .where({ student_id: student.id })
      .orderBy('field_name');

    const extraFields = Object.fromEntries(
      extras.map((row) => [
        row.field_name,
        row.field_value,
      ])
    );

    res.json({
      success: true,
      data: {
        student: mapStudent(student),
        extraFields,
        orders: orders.map((o) => ({
          id: o.id,
          orderNumber: o.order_number,
          type: o.type,
          status: o.status,
          paymentStatus: o.payment_status,
          total: o.total,
          createdAt: o.created_at,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function createStudent(req, res, next) {
  try {
    const body = studentBodySchema.parse(req.body);
    const existing = await db('students').where({ admission_number: body.admissionNumber }).first();
    if (existing) throw new AppError('Admission number already exists', 409);

    const [id] = await db('students').insert({
      admission_number: body.admissionNumber.trim(),
      student_name: body.studentName.trim(),
      parent_name: body.parentName.trim(),
      class_name: body.className || null,
      age: body.age ?? null,
      gender: body.gender || null,
      email: body.email || null,
      address1: body.address1.trim(),
      address2: (body.address2 || '').trim(),
      city: body.city.trim(),
      state: body.state.trim(),
      zipcode: body.zipcode.trim(),
      house_color: body.houseColor.trim(),
      phone: body.phone ? String(body.phone).trim() : null,
      is_active: body.isActive,
    });

    const student = await db('students').where({ id }).first();
    res.status(201).json({ success: true, data: { student: mapStudent(student) } });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
  }
}

async function updateStudent(req, res, next) {
  try {
    const body = studentBodySchema.partial().parse(req.body);
    const student = await db('students').where({ id: req.params.id }).first();
    if (!student) throw new AppError('Student not found', 404);

    if (body.admissionNumber && body.admissionNumber !== student.admission_number) {
      const clash = await db('students').where({ admission_number: body.admissionNumber }).first();
      if (clash) throw new AppError('Admission number already exists', 409);
    }


    const patch = {};
    if (body.admissionNumber !== undefined) patch.admission_number = body.admissionNumber.trim();
    if (body.studentName !== undefined) patch.student_name = body.studentName.trim();
    if (body.parentName !== undefined) patch.parent_name = body.parentName.trim();
    if (body.address1 !== undefined) patch.address1 = body.address1.trim();
    if (body.address2 !== undefined) patch.address2 = body.address2.trim();
    if (body.city !== undefined) patch.city = body.city.trim();
    if (body.state !== undefined) patch.state = body.state.trim();
    if (body.zipcode !== undefined) patch.zipcode = body.zipcode.trim();
    if (body.houseColor !== undefined) patch.house_color = body.houseColor.trim();
    if (body.phone !== undefined) patch.phone = body.phone ? String(body.phone).trim() : null;
    if (body.isActive !== undefined) patch.is_active = body.isActive;
    if (body.className !== undefined) {
  patch.class_name = body.className || null;
}

if (body.age !== undefined) {
  patch.age = body.age;
}

if (body.gender !== undefined) {
  patch.gender = body.gender || null;
}

if (body.email !== undefined) {
  patch.email = body.email || null;
}
    patch.updated_at = db.fn.now();

    await db('students').where({ id: student.id }).update(patch);
    const updated = await db('students').where({ id: student.id }).first();
    res.json({ success: true, data: { student: mapStudent(updated) } });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
  }
}

async function deleteStudent(req, res, next) {
  try {
    const student = await db('students').where({ id: req.params.id }).first();
    if (!student) throw new AppError('Student not found', 404);

    const orderCount = await db('orders').where({ student_id: student.id }).count({ c: '*' }).first();
    if (Number(orderCount.c) > 0) {
      throw new AppError('Cannot delete student with existing orders. Deactivate instead.', 400);
    }

    await db('students').where({ id: student.id }).del();
    res.json({ success: true, message: 'Student deleted' });
  } catch (err) {
    next(err);
  }
}

async function bulkActive(req, res, next) {
  try {
    const schema = z.object({
      ids: z.array(z.coerce.number().int().positive()).min(1),
      isActive: z.boolean(),
    });
    const { ids, isActive } = schema.parse(req.body);
    await db('students').whereIn('id', ids).update({ is_active: isActive, updated_at: db.fn.now() });
    res.json({ success: true, message: `Updated ${ids.length} students` });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
  }
}

async function updateControls(req, res, next) {
  try {
    const schema = z.object({
      kitStatus: z.enum(['pending', 'ordered']).optional(),
      catalogOverride: z.enum(['default', 'force_kit', 'force_individual']).optional(),
      isActive: z.boolean().optional(),
      phone: z.string().max(20).nullable().optional(),
    });
    const body = schema.parse(req.body);
    const student = await db('students').where({ id: req.params.id }).first();
    if (!student) throw new AppError('Student not found', 404);

    const patch = { updated_at: db.fn.now() };
    if (body.kitStatus !== undefined) patch.kit_status = body.kitStatus;
    if (body.catalogOverride !== undefined) patch.catalog_override = body.catalogOverride;
    if (body.isActive !== undefined) patch.is_active = body.isActive;
    if (body.phone !== undefined) patch.phone = body.phone;

    await db('students').where({ id: student.id }).update(patch);
    const updated = await db('students').where({ id: student.id }).first();
    res.json({ success: true, data: { student: mapStudent(updated) } });
  } catch (err) {
    next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
  }
}

async function exportCsv(req, res, next) {
  try {
    const rows = await db('students')
      .orderBy('admission_number', 'asc');

    const extras = await db('student_extra_fields')
      .select('student_id', 'field_name', 'field_value');

    const extrasByStudent = new Map();
    const extraHeaders = new Set();

    for (const item of extras) {
      const studentId = String(item.student_id);

if (!extrasByStudent.has(studentId)) {
  extrasByStudent.set(studentId, {});
}

extrasByStudent.get(studentId)[item.field_name] =
  item.field_value;

      extraHeaders.add(item.field_name);
    }

    const headers = [
      'AdmissionNumber',
      'StudentName',
      'ParentName',
      'Address1',
      'Address2',
      'City',
      'State',
      'Zipcode',
      'House Color',
      'Phone',
      'Class',
      'Age',
      'Gender',
      'Email',
      'KitStatus',
      'CatalogOverride',
      'IsActive',
    ];

    const dynamicHeaders = [...extraHeaders]
      .filter((h) => !headers.includes(h))
      .sort();

    const allHeaders = [...headers, ...dynamicHeaders];

    const csvValue = (value) => {
      let text = String(value ?? '');
      if (/^[=+\-@\t\r]/.test(text)) {
        text = "'" + text;
      }
      return `"${text.replace(/"/g, '""')}"`;
    };

    const lines = [
      allHeaders.map(csvValue).join(','),
    ];

    for (const row of rows) {
      const values = [
        row.admission_number,
        row.student_name,
        row.parent_name,
        row.address1,
        row.address2,
        row.city,
        row.state,
        row.zipcode,
        row.house_color,
        row.phone,
        row.class_name,
        row.age,
        row.gender,
        row.email,
        row.kit_status,
        row.catalog_override,
        row.is_active ? '1' : '0',
      ];

      const studentExtras =
  extrasByStudent.get(String(row.id)) || {};

      for (const header of dynamicHeaders) {
        values.push(studentExtras[header] ?? '');
      }

      lines.push(values.map(csvValue).join(','));
    }

    res.setHeader(
      'Content-Type',
      'text/csv; charset=utf-8'
    );

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="students.csv"'
    );

    res.send('\uFEFF' + lines.join('\r\n'));
  } catch (err) {
    next(err);
  }
}


async function downloadTemplate(req, res, next) {
  try {
    const buffer = excelStudents.buildSampleTemplateBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="students_template.xlsx"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

async function importPreview(req, res, next) {
  try {
    if (!req.file) throw new AppError('File is required', 400);
    const parsed = excelStudents.parseWorkbookBuffer(req.file.buffer, req.file.originalname);
    if (parsed.errors.length && !parsed.rows.length) {
      throw new AppError(parsed.errors[0].message, 400, parsed.errors);
    }

    const existing = await db('students').select('admission_number');
    const existingByAdmission = new Map(existing.map((e) => [e.admission_number, true]));
    const result = excelStudents.validateRows(parsed.rows, existingByAdmission);

    res.json({
      success: true,
      data: {
        fileName: parsed.fileName,
        previewRows: parsed.rows.slice(0, 20),
        counts: result.counts,
        rowErrors: result.rowErrors,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function importCommit(req, res, next) {
  try {
    if (!req.file) throw new AppError('File is required', 400);
    const parsed = excelStudents.parseWorkbookBuffer(req.file.buffer, req.file.originalname);
    if (parsed.errors.length && !parsed.rows.length) {
      throw new AppError(parsed.errors[0].message, 400, parsed.errors);
    }

    const existing = await db('students').select('admission_number');
    const existingByAdmission = new Map(existing.map((e) => [e.admission_number, true]));
    const result = excelStudents.validateRows(parsed.rows, existingByAdmission);

    const { created, updated } = await excelStudents.upsertStudents(db, result.validRows, 500);

    const [logId] = await db('import_logs').insert({
      file_name: parsed.fileName,
      total_rows: result.counts.total,
      created_count: created,
      updated_count: updated,
      failed_count: result.counts.invalid,
      error_report: JSON.stringify(result.rowErrors),
      admin_user_id: req.admin.id,
    });

    res.json({
      success: true,
      message: 'Import completed',
      data: {
        importLogId: logId,
        created,
        updated,
        failed: result.counts.invalid,
        rowErrors: result.rowErrors,
        errorReportCsv: excelStudents.errorsToCsv(result.rowErrors),
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listStudents,
  listStudentClasses,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  bulkActive,
  updateControls,
  exportCsv,
  downloadTemplate,
  importPreview,
  importCommit,
  listQuerySchema,
  studentBodySchema,
};










// const { z } = require('zod');
// const db = require('../config/db');
// const AppError = require('../utils/AppError');
// const excelStudents = require('../services/excelStudents');

// const listQuerySchema = z.object({
//   page: z.coerce.number().int().min(1).default(1),
//   pageSize: z.coerce.number().int().min(1).max(100).default(20),
//   search: z.string().optional().default(''),
//   houseColor: z.string().optional().default(''),
//   kitStatus: z.enum(['pending', 'ordered', '']).optional().default(''),
//   isActive: z.enum(['true', 'false', '']).optional().default(''),
//   sortBy: z
//     .enum(['admission_number', 'student_name', 'parent_name', 'house_color', 'created_at', 'kit_status'])
//     .optional()
//     .default('admission_number'),
//   sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
// });

// const studentBodySchema = z.object({
//   admissionNumber: z.string().min(1).max(50),
//   studentName: z.string().min(1).max(150),
//   parentName: z.string().min(1).max(150),
//   address1: z.string().min(1).max(255),
//   address2: z.string().max(255).optional().default(''),
//   city: z.string().min(1).max(100),
//   state: z.string().min(1).max(100),
//   zipcode: z.string().min(1).max(10),
//   houseColor: z.string().min(1).max(30),
//   phone: z.string().max(20).nullable().optional(),
//   isActive: z.boolean().optional().default(true),
// });

// function mapStudent(row) {
//   if (!row) return null;
//   return {
//     id: row.id,
//     admissionNumber: row.admission_number,
//     studentName: row.student_name,
//     parentName: row.parent_name,
//     address1: row.address1,
//     address2: row.address2,
//     city: row.city,
//     state: row.state,
//     zipcode: row.zipcode,
//     houseColor: row.house_color,
//     phone: row.phone,
//     kitStatus: row.kit_status,
//     catalogOverride: row.catalog_override,
//     isActive: Boolean(row.is_active),
//     firstLoginAt: row.first_login_at,
//     lastLoginAt: row.last_login_at,
//     createdAt: row.created_at,
//     updatedAt: row.updated_at,
//   };
// }

// async function listStudents(req, res, next) {
//   try {
//     const q = listQuerySchema.parse(req.query);
//     const query = db('students').select('*');

//     if (q.search) {
//       const s = `%${q.search}%`;
//       query.andWhere((builder) => {
//         builder
//           .where('admission_number', 'like', s)
//           .orWhere('student_name', 'like', s)
//           .orWhere('parent_name', 'like', s);
//       });
//     }
//     if (q.houseColor) query.andWhere('house_color', q.houseColor);
//     if (q.kitStatus) query.andWhere('kit_status', q.kitStatus);
//     if (q.isActive === 'true') query.andWhere('is_active', true);
//     if (q.isActive === 'false') query.andWhere('is_active', false);

//     const countQuery = query.clone().clearSelect().count({ total: '*' }).first();
//     const { total } = await countQuery;

//     const rows = await query
//       .orderBy(q.sortBy, q.sortDir)
//       .limit(q.pageSize)
//       .offset((q.page - 1) * q.pageSize);

//     res.json({
//       success: true,
//       data: {
//         items: rows.map(mapStudent),
//         pagination: {
//           page: q.page,
//           pageSize: q.pageSize,
//           total: Number(total),
//           totalPages: Math.ceil(Number(total) / q.pageSize) || 1,
//         },
//       },
//     });
//   } catch (err) {
//     next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
//   }
// }

// async function getStudent(req, res, next) {
//   try {
//     const student = await db('students').where({ id: req.params.id }).first();
//     if (!student) throw new AppError('Student not found', 404);

//     const orders = await db('orders')
//       .where({ student_id: student.id })
//       .orderBy('created_at', 'desc')
//       .limit(50);

//     res.json({
//       success: true,
//       data: {
//         student: mapStudent(student),
//         orders: orders.map((o) => ({
//           id: o.id,
//           orderNumber: o.order_number,
//           type: o.type,
//           status: o.status,
//           paymentStatus: o.payment_status,
//           total: o.total,
//           createdAt: o.created_at,
//         })),
//       },
//     });
//   } catch (err) {
//     next(err);
//   }
// }

// async function createStudent(req, res, next) {
//   try {
//     const body = studentBodySchema.parse(req.body);
//     const existing = await db('students').where({ admission_number: body.admissionNumber }).first();
//     if (existing) throw new AppError('Admission number already exists', 409);

//     const [id] = await db('students').insert({
//       admission_number: body.admissionNumber.trim(),
//       student_name: body.studentName.trim(),
//       parent_name: body.parentName.trim(),
//       address1: body.address1.trim(),
//       address2: (body.address2 || '').trim(),
//       city: body.city.trim(),
//       state: body.state.trim(),
//       zipcode: body.zipcode.trim(),
//       house_color: body.houseColor.trim(),
//       phone: body.phone ? String(body.phone).trim() : null,
//       is_active: body.isActive,
//     });

//     const student = await db('students').where({ id }).first();
//     res.status(201).json({ success: true, data: { student: mapStudent(student) } });
//   } catch (err) {
//     next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
//   }
// }

// async function updateStudent(req, res, next) {
//   try {
//     const body = studentBodySchema.partial().parse(req.body);
//     const student = await db('students').where({ id: req.params.id }).first();
//     if (!student) throw new AppError('Student not found', 404);

//     if (body.admissionNumber && body.admissionNumber !== student.admission_number) {
//       const clash = await db('students').where({ admission_number: body.admissionNumber }).first();
//       if (clash) throw new AppError('Admission number already exists', 409);
//     }

//     const patch = {};
//     if (body.admissionNumber !== undefined) patch.admission_number = body.admissionNumber.trim();
//     if (body.studentName !== undefined) patch.student_name = body.studentName.trim();
//     if (body.parentName !== undefined) patch.parent_name = body.parentName.trim();
//     if (body.address1 !== undefined) patch.address1 = body.address1.trim();
//     if (body.address2 !== undefined) patch.address2 = body.address2.trim();
//     if (body.city !== undefined) patch.city = body.city.trim();
//     if (body.state !== undefined) patch.state = body.state.trim();
//     if (body.zipcode !== undefined) patch.zipcode = body.zipcode.trim();
//     if (body.houseColor !== undefined) patch.house_color = body.houseColor.trim();
//     if (body.phone !== undefined) patch.phone = body.phone ? String(body.phone).trim() : null;
//     if (body.isActive !== undefined) patch.is_active = body.isActive;
//     patch.updated_at = db.fn.now();

//     await db('students').where({ id: student.id }).update(patch);
//     const updated = await db('students').where({ id: student.id }).first();
//     res.json({ success: true, data: { student: mapStudent(updated) } });
//   } catch (err) {
//     next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
//   }
// }

// async function deleteStudent(req, res, next) {
//   try {
//     const student = await db('students').where({ id: req.params.id }).first();
//     if (!student) throw new AppError('Student not found', 404);

//     const orderCount = await db('orders').where({ student_id: student.id }).count({ c: '*' }).first();
//     if (Number(orderCount.c) > 0) {
//       throw new AppError('Cannot delete student with existing orders. Deactivate instead.', 400);
//     }

//     await db('students').where({ id: student.id }).del();
//     res.json({ success: true, message: 'Student deleted' });
//   } catch (err) {
//     next(err);
//   }
// }

// async function bulkActive(req, res, next) {
//   try {
//     const schema = z.object({
//       ids: z.array(z.coerce.number().int().positive()).min(1),
//       isActive: z.boolean(),
//     });
//     const { ids, isActive } = schema.parse(req.body);
//     await db('students').whereIn('id', ids).update({ is_active: isActive, updated_at: db.fn.now() });
//     res.json({ success: true, message: `Updated ${ids.length} students` });
//   } catch (err) {
//     next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
//   }
// }

// async function updateControls(req, res, next) {
//   try {
//     const schema = z.object({
//       kitStatus: z.enum(['pending', 'ordered']).optional(),
//       catalogOverride: z.enum(['default', 'force_kit', 'force_individual']).optional(),
//       isActive: z.boolean().optional(),
//       phone: z.string().max(20).nullable().optional(),
//     });
//     const body = schema.parse(req.body);
//     const student = await db('students').where({ id: req.params.id }).first();
//     if (!student) throw new AppError('Student not found', 404);

//     const patch = { updated_at: db.fn.now() };
//     if (body.kitStatus !== undefined) patch.kit_status = body.kitStatus;
//     if (body.catalogOverride !== undefined) patch.catalog_override = body.catalogOverride;
//     if (body.isActive !== undefined) patch.is_active = body.isActive;
//     if (body.phone !== undefined) patch.phone = body.phone;

//     await db('students').where({ id: student.id }).update(patch);
//     const updated = await db('students').where({ id: student.id }).first();
//     res.json({ success: true, data: { student: mapStudent(updated) } });
//   } catch (err) {
//     next(err.name === 'ZodError' ? new AppError('Validation failed', 400, err.issues) : err);
//   }
// }

// async function exportCsv(req, res, next) {
//   try {
//     const rows = await db('students').orderBy('admission_number', 'asc');
//     const header = [
//       'AdmissionNumber',
//       'StudentName',
//       'ParentName',
//       'Address1',
//       'Address2',
//       'City',
//       'State',
//       'Zipcode',
//       'House Color',
//       'Phone',
//       'KitStatus',
//       'CatalogOverride',
//       'IsActive',
//     ];
//     const lines = [header.join(',')];
//     rows.forEach((r) => {
//       const vals = [
//         r.admission_number,
//         r.student_name,
//         r.parent_name,
//         r.address1,
//         r.address2,
//         r.city,
//         r.state,
//         r.zipcode,
//         r.house_color,
//         r.phone || '',
//         r.kit_status,
//         r.catalog_override,
//         r.is_active ? '1' : '0',
//       ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
//       lines.push(vals.join(','));
//     });
//     res.setHeader('Content-Type', 'text/csv');
//     res.setHeader('Content-Disposition', 'attachment; filename="students.csv"');
//     res.send(lines.join('\n'));
//   } catch (err) {
//     next(err);
//   }
// }

// async function downloadTemplate(req, res, next) {
//   try {
//     const buffer = excelStudents.buildSampleTemplateBuffer();
//     res.setHeader(
//       'Content-Type',
//       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
//     );
//     res.setHeader('Content-Disposition', 'attachment; filename="students_template.xlsx"');
//     res.send(buffer);
//   } catch (err) {
//     next(err);
//   }
// }

// async function importPreview(req, res, next) {
//   try {
//     if (!req.file) throw new AppError('File is required', 400);
//     const parsed = excelStudents.parseWorkbookBuffer(req.file.buffer, req.file.originalname);
//     if (parsed.errors.length && !parsed.rows.length) {
//       throw new AppError(parsed.errors[0].message, 400, parsed.errors);
//     }

//     const existing = await db('students').select('admission_number');
//     const existingByAdmission = new Map(existing.map((e) => [e.admission_number, true]));
//     const result = excelStudents.validateRows(parsed.rows, existingByAdmission);

//     res.json({
//       success: true,
//       data: {
//         fileName: parsed.fileName,
//         previewRows: parsed.rows.slice(0, 20),
//         counts: result.counts,
//         rowErrors: result.rowErrors,
//       },
//     });
//   } catch (err) {
//     next(err);
//   }
// }

// async function importCommit(req, res, next) {
//   try {
//     if (!req.file) throw new AppError('File is required', 400);
//     const parsed = excelStudents.parseWorkbookBuffer(req.file.buffer, req.file.originalname);
//     if (parsed.errors.length && !parsed.rows.length) {
//       throw new AppError(parsed.errors[0].message, 400, parsed.errors);
//     }

//     const existing = await db('students').select('admission_number');
//     const existingByAdmission = new Map(existing.map((e) => [e.admission_number, true]));
//     const result = excelStudents.validateRows(parsed.rows, existingByAdmission);

//     const { created, updated } = await excelStudents.upsertStudents(db, result.validRows, 500);

//     const [logId] = await db('import_logs').insert({
//       file_name: parsed.fileName,
//       total_rows: result.counts.total,
//       created_count: created,
//       updated_count: updated,
//       failed_count: result.counts.invalid,
//       error_report: JSON.stringify(result.rowErrors),
//       admin_user_id: req.admin.id,
//     });

//     res.json({
//       success: true,
//       message: 'Import completed',
//       data: {
//         importLogId: logId,
//         created,
//         updated,
//         failed: result.counts.invalid,
//         rowErrors: result.rowErrors,
//         errorReportCsv: excelStudents.errorsToCsv(result.rowErrors),
//       },
//     });
//   } catch (err) {
//     next(err);
//   }
// }

// module.exports = {
//   listStudents,
//   getStudent,
//   createStudent,
//   updateStudent,
//   deleteStudent,
//   bulkActive,
//   updateControls,
//   exportCsv,
//   downloadTemplate,
//   importPreview,
//   importCommit,
//   listQuerySchema,
//   studentBodySchema,
// };
