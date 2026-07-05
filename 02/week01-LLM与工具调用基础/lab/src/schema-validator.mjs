function valueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function matchesType(value, expected) {
  if (expected === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (expected === 'array') return Array.isArray(value);
  if (expected === 'integer') return Number.isInteger(value);
  if (expected === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (expected === 'null') return value === null;
  return typeof value === expected;
}

export function validateAgainstSchema(value, schema, path = '$') {
  const errors = [];

  if (schema.type && !matchesType(value, schema.type)) {
    errors.push({
      path,
      keyword: 'type',
      message: `expected ${schema.type}, received ${valueType(value)}`,
    });
    return errors;
  }

  if (schema.enum && !schema.enum.some((item) => Object.is(item, value))) {
    errors.push({
      path,
      keyword: 'enum',
      message: `expected one of ${JSON.stringify(schema.enum)}`,
    });
  }

  if (typeof value === 'string' && schema.minLength !== undefined && value.length < schema.minLength) {
    errors.push({
      path,
      keyword: 'minLength',
      message: `expected at least ${schema.minLength} character(s)`,
    });
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push({
        path,
        keyword: 'minItems',
        message: `expected at least ${schema.minItems} item(s)`,
      });
    }

    if (schema.items) {
      value.forEach((item, index) => {
        errors.push(...validateAgainstSchema(item, schema.items, `${path}[${index}]`));
      });
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const properties = schema.properties ?? {};

    for (const requiredKey of schema.required ?? []) {
      if (!Object.hasOwn(value, requiredKey)) {
        errors.push({
          path,
          keyword: 'required',
          message: `missing required property ${JSON.stringify(requiredKey)}`,
        });
      }
    }

    for (const [key, childValue] of Object.entries(value)) {
      const childSchema = properties[key];
      if (childSchema) {
        errors.push(...validateAgainstSchema(childValue, childSchema, `${path}.${key}`));
      } else if (schema.additionalProperties === false) {
        errors.push({
          path: `${path}.${key}`,
          keyword: 'additionalProperties',
          message: 'property is not allowed',
        });
      }
    }
  }

  return errors;
}
