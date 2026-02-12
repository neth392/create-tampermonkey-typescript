/**
 * Optional utility file for easily accessing the React & ReactDOM objects at runtime.
 */

import type React from 'react'
import type ReactDOM from 'react-dom/client'

/**
 * Retrieves the React object from the global `unsafeWindow` scope.
 *
 * @return {typeof React} The React object from the global scope.
 */
export function getReact(): typeof React {
  return unsafeWindow.React
}

/**
 * Retrieves the ReactDOM object from the global `unsafeWindow` object.
 *
 * @return {typeof ReactDOM} The ReactDOM reference from the global scope.
 */
export function getReactDOM(): typeof ReactDOM {
  return unsafeWindow.ReactDOM
}
