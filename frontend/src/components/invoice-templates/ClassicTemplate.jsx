import InvoicePaper from './InvoicePaper'

/** Serif, monochrome treatment of the same document. */
export default function ClassicTemplate(props) {
  return <InvoicePaper {...props} variant="classic" />
}
