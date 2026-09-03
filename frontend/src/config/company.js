// Seller identity printed on the invoice document.
//
// There is no Company/Organization model in the backend — the server-side
// ReportLab PDF and the invoice email use settings.COMPANY_NAME and
// settings.COMPANY_PHONE (backend/core/settings.py). Keep these values in sync
// with those, otherwise the emailed PDF and the on-screen document disagree.
export const COMPANY = {
  name:    'ShantanuJain',
  address: 'Tundla, Firozabad',
  city:    'Uttar Pradesh, India',
  pincode: '283204',
  email:   'shantanujain1507@gmail.com',
  phone:   '+91 98765 43210',
  gstin:   '',
}

export default COMPANY
