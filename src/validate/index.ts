// Validacao estatica e de cenarios (F2-09, F3-07). O validador estrutural do
// documento Kayros fica em ../profile/validate-document.ts.
export { validateKayrosDocument } from '../profile/validate-document.js'
export { validateImportSafety, validateReferences } from './refs.js'
export { compareDocuments, type Comparison } from './compare.js'
