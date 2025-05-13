const validateObjectField = (object, requiredFields, context) => {
  const missingFields = requiredFields.filter((field) => {
    if (typeof field === "string") {
      // Validación de campos simples
      const keys = field.split(".");
      let value = object;

      for (const key of keys) {
        value = value?.[key];
        if (value === undefined) return true;
      }
      return false;
    } else if (typeof field === "object") {
      // Validación de campos complejos con listas
      const { path, requiredNames } = field;
      const keys = path.split(".");
      let value = object;

      for (const key of keys) {
        value = value?.[key];
        if (value === undefined) return true;
      }

      if (Array.isArray(value)) {
        // Extrae los nombres internos presentes
        const existingNames = value.map(
          (item) => item?.CustomFieldDefinition?.InternalName
        );
        // Verifica si faltan nombres requeridos
        return !requiredNames.every((name) => existingNames.includes(name));
      }

      // Si no es un arreglo y se esperaba uno, falla
      return true;
    }

    return false;
  });

  if (missingFields.length > 0) {
    throw new Error(
      `Faltan los siguientes campos en ${context}: ${missingFields
        .map((field) => (typeof field === "string" ? field : field.path))
        .join(", ")}`
    );
  }
};

module.exports = { validateObjectField };
