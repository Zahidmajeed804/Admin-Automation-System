import { stringify } from "csv-stringify";

/**
 * Turns `rows` into a CSV string via csv-stringify, given `columns` as
 * [{ key, header }]. Shared by every report's CSV export so the delimiter,
 * header row and quoting stay consistent across the Reports module.
 */
export function rowsToCsv(rows, columns) {
  return new Promise((resolve, reject) => {
    stringify(rows, { header: true, columns }, (err, output) => {
      if (err) return reject(err);
      resolve(output);
    });
  });
}
