/**
 * cssModules.d.ts — TypeScript type declarations for CSS Module files.
 *
 * CSS Modules (*.module.css) are transformed by Vite at build time into
 * an object whose keys are the class names defined in the CSS file.
 * This ambient module declaration tells TypeScript to treat any
 * `*.module.css` import as an object of string-keyed class names.
 */
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
