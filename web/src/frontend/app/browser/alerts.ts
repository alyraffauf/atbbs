export function alertOnError(operation: string) {
  return (error: unknown) =>
    alert(
      `Could not ${operation}: ${error instanceof Error ? error.message : error}`,
    );
}
