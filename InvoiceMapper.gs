function normalizeInvoiceFields_(invoice) {
  invoice.supplier_tax_id.value = normalizeTaxId_(invoice.supplier_tax_id.value);
  invoice.invoice_date.value = normalizeDate_(invoice.invoice_date.value);
  invoice.due_date.value = normalizeDate_(invoice.due_date.value);
  invoice.subtotal.value = normalizeAmount_(invoice.subtotal.value);
  invoice.vat.value = normalizeAmount_(invoice.vat.value);
  invoice.total.value = normalizeAmount_(invoice.total.value);
  invoice.currency.value = invoice.currency.value || 'THB';

  return invoice;
}

function createField_(value, confidence) {
  return {
    value: value || '',
    confidence: typeof confidence === 'number' ? confidence : 0
  };
}
