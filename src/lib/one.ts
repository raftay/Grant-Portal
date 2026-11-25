export function one<T>(rows: readonly T[]): T {
  const [row] = rows;
  if (rows.length !== 1 || row === undefined) throw new Error(`Expected one row, found ${rows.length}`);
  return row;
}
