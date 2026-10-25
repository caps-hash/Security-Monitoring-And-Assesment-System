const employeeNumberPattern = /^GGF-\d{6}$/;

export function formatEmployeeNumber(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 999_999) {
    throw new Error("Employee number source must be an integer from 0 through 999999.");
  }
  return `GGF-${String(value).padStart(6, "0")}`;
}

export function isGeneratedEmployeeNumber(value: string): boolean {
  return employeeNumberPattern.test(value);
}

export function generateEmployeeNumber(
  randomBelow: (exclusiveMax: number) => number,
): string {
  return formatEmployeeNumber(randomBelow(1_000_000));
}

export async function assignUniqueEmployeeNumber(
  save: (employeeNumber: string) => Promise<"ok" | "collision">,
  randomBelow: (exclusiveMax: number) => number,
  attempts = 5,
): Promise<string> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const employeeNumber = generateEmployeeNumber(randomBelow);
    if ((await save(employeeNumber)) === "ok") {
      return employeeNumber;
    }
  }
  throw new Error("Could not generate a unique employee ID.");
}
