/**
 * A reference to the global `window` object, extended with additional properties
 * for React and ReactDOM.
 *
 * @type {Window & {React: typeof import('react'), ReactDOM: typeof import('react-dom/client')}}
 * @property {typeof import('react')} React - The React library, providing tools
 *     for building user interfaces.
 * @property {typeof import('react-dom/client')} ReactDOM - The ReactDOM library,
 *     allowing React components to be rendered into the DOM.
 */
declare const unsafeWindow: Window & {
  React: typeof import('react')
  ReactDOM: typeof import('react-dom/client')
}
