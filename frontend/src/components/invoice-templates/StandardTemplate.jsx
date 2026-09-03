import InvoicePaper from './InvoicePaper'

/** Clean sans-serif invoice — the default document template. */
export default function StandardTemplate(props) {
  return <InvoicePaper {...props} variant="standard" />
}
